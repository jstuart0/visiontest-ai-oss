// VisionTest.ai - API Test Execution Engine
// REST executor, GraphQL executor, assertion engine, contract validation

import { prisma } from '@visiontest/database';
import { logger } from '../utils/logger';
import Redis from 'ioredis';

const PUBSUB_CHANNEL = 'visiontest:api-executions';

interface ApiTestJobData {
  apiExecutionId: string;
  apiTestId: string;
  environmentName?: string;
  variableOverrides?: Record<string, string>;
}

interface ResolvedRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  timeoutMs: number;
}

interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
  bodySize: number;
  durationMs: number;
  latencyMs: number;
}

interface AssertionResult {
  assertionId: string;
  passed: boolean;
  actual: string | null;
  expected: string | null;
  message: string;
  type: string;
}

export class ApiTestExecutor {
  private publisher: Redis;

  constructor(publisher: Redis) {
    this.publisher = publisher;
  }

  async processApiTest(data: ApiTestJobData): Promise<void> {
    const { apiExecutionId, apiTestId } = data;
    logger.info(`Starting API test execution: ${apiExecutionId}`);

    try {
      // Load test definition with assertions
      const testDef = await prisma.apiTestDefinition.findUnique({
        where: { id: apiTestId },
        include: {
          assertions: { where: { isActive: true }, orderBy: { order: 'asc' } },
          authBinding: true,
          environmentBinding: true,
        },
      });

      if (!testDef) {
        await this.failExecution(apiExecutionId, 'API test definition not found');
        return;
      }

      // Mark as running
      await prisma.apiExecution.update({
        where: { id: apiExecutionId },
        data: { status: 'RUNNING', startedAt: new Date() },
      });
      await this.publishEvent(apiExecutionId, 'running', 'Test started');

      // Resolve environment variables and build request
      const variables = await this.resolveVariables(testDef, data.environmentName, data.variableOverrides);
      const request = await this.buildRequest(testDef, variables);

      // Store request snapshot
      await prisma.apiExecution.update({
        where: { id: apiExecutionId },
        data: {
          requestMethod: request.method,
          requestUrl: request.url,
          requestHeaders: request.headers,
          requestBody: request.body,
        },
      });

      // Execute the request
      let response: HttpResponse;
      let retryCount = 0;
      const maxRetries = testDef.retries;

      while (true) {
        try {
          response = await this.executeRequest(request);
          break;
        } catch (error) {
          if (retryCount >= maxRetries) {
            await this.failExecution(apiExecutionId, `Request failed after ${retryCount + 1} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return;
          }
          retryCount++;
          logger.warn(`API test retry ${retryCount}/${maxRetries}: ${apiTestId}`);
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }

      // Store response snapshot
      const truncatedBody = response.body.length > 100000 ? response.body.substring(0, 100000) + '...(truncated)' : response.body;
      await prisma.apiExecution.update({
        where: { id: apiExecutionId },
        data: {
          responseStatus: response.status,
          responseHeaders: response.headers,
          responseBody: truncatedBody,
          responseBodySize: response.bodySize,
          durationMs: response.durationMs,
          latencyMs: response.latencyMs,
        },
      });

      // Run assertions
      const assertionResults = await this.runAssertions(testDef.assertions, response, testDef.protocol);
      const passedCount = assertionResults.filter(r => r.passed).length;
      const failedCount = assertionResults.filter(r => !r.passed).length;
      const allPassed = failedCount === 0;

      // Generate failure summary if failed
      let failureSummary: string | null = null;
      if (!allPassed) {
        const failedAssertions = assertionResults.filter(r => !r.passed);
        failureSummary = failedAssertions.map(r => r.message).join('; ');
      }

      // Complete execution
      await prisma.apiExecution.update({
        where: { id: apiExecutionId },
        data: {
          status: allPassed ? 'PASSED' : 'FAILED',
          completedAt: new Date(),
          assertionResults: assertionResults as any,
          passedAssertions: passedCount,
          failedAssertions: failedCount,
          totalAssertions: assertionResults.length,
          failureSummary,
        },
      });

      // Create artifacts
      await prisma.apiExecutionArtifact.createMany({
        data: [
          {
            apiExecutionId,
            type: 'REQUEST',
            name: 'Request',
            content: JSON.stringify({ method: request.method, url: request.url, headers: request.headers, body: request.body }, null, 2),
            mimeType: 'application/json',
          },
          {
            apiExecutionId,
            type: 'RESPONSE',
            name: 'Response',
            content: JSON.stringify({ status: response.status, headers: response.headers, body: truncatedBody }, null, 2),
            mimeType: 'application/json',
          },
        ],
      });

      await this.publishEvent(apiExecutionId, allPassed ? 'passed' : 'failed', `${passedCount}/${assertionResults.length} assertions passed`);
      logger.info(`API test completed: ${apiExecutionId} - ${allPassed ? 'PASSED' : 'FAILED'}`);

    } catch (error) {
      logger.error(`API test execution failed: ${apiExecutionId}`, error);
      await this.failExecution(apiExecutionId, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  // =========================================================================
  // VARIABLE RESOLUTION
  // =========================================================================

  private async resolveVariables(
    testDef: any,
    environmentName?: string,
    overrides?: Record<string, string>
  ): Promise<Record<string, string>> {
    const vars: Record<string, string> = {};

    // 1. Project defaults from test definition
    if (testDef.variablesTemplate) {
      Object.assign(vars, testDef.variablesTemplate);
    }

    // 2. Environment binding defaults
    if (testDef.environmentBinding) {
      if (testDef.environmentBinding.defaultVariables) {
        Object.assign(vars, testDef.environmentBinding.defaultVariables);
      }
      if (testDef.environmentBinding.baseUrl) {
        vars['BASE_URL'] = testDef.environmentBinding.baseUrl;
      }
    }

    // 3. Named environment if different from binding
    if (environmentName && !testDef.environmentBindingId) {
      const env = await prisma.apiEnvironmentBinding.findUnique({
        where: { projectId_name: { projectId: testDef.projectId, name: environmentName } },
      });
      if (env) {
        if (env.defaultVariables) Object.assign(vars, env.defaultVariables as Record<string, string>);
        if (env.baseUrl) vars['BASE_URL'] = env.baseUrl;
      }
    }

    // 4. Overrides (from CLI, CI, or request body)
    if (overrides) {
      Object.assign(vars, overrides);
    }

    return vars;
  }

  // =========================================================================
  // REQUEST BUILDING
  // =========================================================================

  private async buildRequest(testDef: any, variables: Record<string, string>): Promise<ResolvedRequest> {
    const interpolate = (template: string): string => {
      return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || `{{${key}}}`);
    };

    // Build URL
    let url = interpolate(testDef.urlTemplate);
    const baseUrl = variables['BASE_URL'];
    if (baseUrl && !url.startsWith('http')) {
      url = baseUrl.replace(/\/$/, '') + '/' + url.replace(/^\//, '');
    }

    // Add query params
    if (testDef.queryTemplate) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(testDef.queryTemplate as Record<string, string>)) {
        params.set(key, interpolate(value));
      }
      const queryStr = params.toString();
      if (queryStr) {
        url += (url.includes('?') ? '&' : '?') + queryStr;
      }
    }

    // Build headers
    const headers: Record<string, string> = { 'User-Agent': 'VisionTest-API/1.0' };

    // Add environment default headers
    if (testDef.environmentBinding?.defaultHeaders) {
      for (const [k, v] of Object.entries(testDef.environmentBinding.defaultHeaders as Record<string, string>)) {
        headers[k] = interpolate(v);
      }
    }

    // Add test-level headers
    if (testDef.headersTemplate) {
      for (const [k, v] of Object.entries(testDef.headersTemplate as Record<string, string>)) {
        headers[k] = interpolate(v);
      }
    }

    // Add auth header
    if (testDef.authBinding) {
      const authHeader = this.resolveAuth(testDef.authBinding, variables);
      if (authHeader) {
        Object.assign(headers, authHeader);
      }
    }

    // Build body
    let body: string | undefined;
    if (testDef.protocol === 'GRAPHQL') {
      const graphqlBody: any = {
        query: testDef.graphqlQuery || testDef.bodyTemplate,
      };
      if (testDef.graphqlVariables) {
        graphqlBody.variables = testDef.graphqlVariables;
      }
      if (testDef.graphqlOperationName) {
        graphqlBody.operationName = testDef.graphqlOperationName;
      }
      body = JSON.stringify(graphqlBody);
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    } else if (testDef.bodyTemplate) {
      body = interpolate(testDef.bodyTemplate);
      if (!headers['Content-Type']) {
        try {
          JSON.parse(body);
          headers['Content-Type'] = 'application/json';
        } catch {
          headers['Content-Type'] = 'text/plain';
        }
      }
    }

    return {
      method: testDef.protocol === 'GRAPHQL' ? 'POST' : testDef.method,
      url,
      headers,
      body,
      timeoutMs: testDef.timeoutMs || 30000,
    };
  }

  private resolveAuth(authBinding: any, variables: Record<string, string>): Record<string, string> | null {
    switch (authBinding.authType) {
      case 'BEARER': {
        const token = authBinding.secretRef ? variables[authBinding.secretRef] || authBinding.secretRef : '';
        const prefix = authBinding.tokenPrefix || 'Bearer';
        const header = authBinding.headerName || 'Authorization';
        return { [header]: `${prefix} ${token}` };
      }
      case 'API_KEY': {
        const key = authBinding.secretRef ? variables[authBinding.secretRef] || authBinding.secretRef : '';
        const header = authBinding.headerName || 'X-API-Key';
        return { [header]: key };
      }
      case 'BASIC': {
        const creds = authBinding.secretRef ? variables[authBinding.secretRef] || authBinding.secretRef : '';
        return { Authorization: `Basic ${Buffer.from(creds).toString('base64')}` };
      }
      case 'NONE':
      default:
        return null;
    }
  }

  // =========================================================================
  // HTTP EXECUTION
  // =========================================================================

  private async executeRequest(request: ResolvedRequest): Promise<HttpResponse> {
    const startTime = Date.now();
    let latencyMs = 0;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeoutMs);

    try {
      const fetchOptions: RequestInit = {
        method: request.method,
        headers: request.headers,
        signal: controller.signal,
      };
      if (request.body && !['GET', 'HEAD'].includes(request.method.toUpperCase())) {
        fetchOptions.body = request.body;
      }

      const response = await fetch(request.url, fetchOptions);
      latencyMs = Date.now() - startTime;

      const bodyText = await response.text();
      const durationMs = Date.now() - startTime;

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      return {
        status: response.status,
        headers: responseHeaders,
        body: bodyText,
        bodySize: bodyText.length,
        durationMs,
        latencyMs,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  // =========================================================================
  // ASSERTION ENGINE
  // =========================================================================

  private async runAssertions(
    assertions: any[],
    response: HttpResponse,
    protocol: string
  ): Promise<AssertionResult[]> {
    const results: AssertionResult[] = [];

    for (const assertion of assertions) {
      const result = this.evaluateAssertion(assertion, response, protocol);
      results.push(result);
    }

    return results;
  }

  private evaluateAssertion(assertion: any, response: HttpResponse, protocol: string): AssertionResult {
    try {
      switch (assertion.type) {
        case 'STATUS_CODE':
          return this.assertStatusCode(assertion, response);
        case 'HEADER':
          return this.assertHeader(assertion, response);
        case 'JSON_PATH':
          return this.assertJsonPath(assertion, response);
        case 'BODY_CONTAINS':
          return this.assertBodyContains(assertion, response);
        case 'BODY_REGEX':
          return this.assertBodyRegex(assertion, response);
        case 'LATENCY':
        case 'RESPONSE_TIME':
          return this.assertLatency(assertion, response);
        case 'GRAPHQL_ERROR_ABSENT':
          return this.assertGraphqlNoErrors(assertion, response);
        case 'SCHEMA':
          return this.assertSchema(assertion, response);
        default:
          return {
            assertionId: assertion.id,
            passed: false,
            actual: null,
            expected: null,
            message: `Unknown assertion type: ${assertion.type}`,
            type: assertion.type,
          };
      }
    } catch (error) {
      return {
        assertionId: assertion.id,
        passed: false,
        actual: null,
        expected: assertion.expectedValue,
        message: `Assertion error: ${error instanceof Error ? error.message : 'Unknown'}`,
        type: assertion.type,
      };
    }
  }

  private assertStatusCode(assertion: any, response: HttpResponse): AssertionResult {
    const expected = parseInt(assertion.expectedValue || '200');
    const actual = response.status;
    const passed = this.compareValues(assertion.operator, actual, expected);
    return {
      assertionId: assertion.id,
      passed,
      actual: String(actual),
      expected: String(expected),
      message: passed ? `Status code ${actual} matches expected ${expected}` : `Expected status ${expected}, got ${actual}`,
      type: 'STATUS_CODE',
    };
  }

  private assertHeader(assertion: any, response: HttpResponse): AssertionResult {
    const headerName = (assertion.target || '').toLowerCase();
    const actual = response.headers[headerName] || null;
    const expected = assertion.expectedValue;

    if (assertion.operator === 'EXISTS') {
      return {
        assertionId: assertion.id,
        passed: actual !== null,
        actual,
        expected: '(exists)',
        message: actual !== null ? `Header "${headerName}" exists` : `Header "${headerName}" not found`,
        type: 'HEADER',
      };
    }

    const passed = this.compareValues(assertion.operator, actual || '', expected || '');
    return {
      assertionId: assertion.id,
      passed,
      actual,
      expected,
      message: passed ? `Header "${headerName}" matches` : `Header "${headerName}": expected "${expected}", got "${actual}"`,
      type: 'HEADER',
    };
  }

  private assertJsonPath(assertion: any, response: HttpResponse): AssertionResult {
    const jsonPath = assertion.target || '$';
    let body: any;
    try {
      body = JSON.parse(response.body);
    } catch {
      return {
        assertionId: assertion.id,
        passed: false,
        actual: null,
        expected: assertion.expectedValue,
        message: 'Response body is not valid JSON',
        type: 'JSON_PATH',
      };
    }

    // Simple JSONPath evaluation (supports dot notation and array indexing)
    const actual = this.evaluateSimpleJsonPath(body, jsonPath);
    const actualStr = actual === undefined ? null : JSON.stringify(actual);
    const passed = this.compareValues(assertion.operator, actualStr || '', assertion.expectedValue || '');

    return {
      assertionId: assertion.id,
      passed,
      actual: actualStr,
      expected: assertion.expectedValue,
      message: passed ? `JSONPath "${jsonPath}" matches` : `JSONPath "${jsonPath}": expected "${assertion.expectedValue}", got "${actualStr}"`,
      type: 'JSON_PATH',
    };
  }

  private assertBodyContains(assertion: any, response: HttpResponse): AssertionResult {
    const searchStr = assertion.expectedValue || '';
    const passed = response.body.includes(searchStr);
    return {
      assertionId: assertion.id,
      passed,
      actual: passed ? '(found)' : '(not found)',
      expected: searchStr,
      message: passed ? `Body contains "${searchStr}"` : `Body does not contain "${searchStr}"`,
      type: 'BODY_CONTAINS',
    };
  }

  private assertBodyRegex(assertion: any, response: HttpResponse): AssertionResult {
    const pattern = assertion.expectedValue || '';
    try {
      const regex = new RegExp(pattern);
      const passed = regex.test(response.body);
      return {
        assertionId: assertion.id,
        passed,
        actual: passed ? '(matches)' : '(no match)',
        expected: pattern,
        message: passed ? `Body matches regex "${pattern}"` : `Body does not match regex "${pattern}"`,
        type: 'BODY_REGEX',
      };
    } catch {
      return {
        assertionId: assertion.id,
        passed: false,
        actual: null,
        expected: pattern,
        message: `Invalid regex pattern: "${pattern}"`,
        type: 'BODY_REGEX',
      };
    }
  }

  private assertLatency(assertion: any, response: HttpResponse): AssertionResult {
    const maxMs = parseInt(assertion.expectedValue || '5000');
    const actual = response.durationMs;
    const passed = actual <= maxMs;
    return {
      assertionId: assertion.id,
      passed,
      actual: String(actual),
      expected: `<= ${maxMs}ms`,
      message: passed ? `Response time ${actual}ms within ${maxMs}ms limit` : `Response time ${actual}ms exceeds ${maxMs}ms limit`,
      type: 'LATENCY',
    };
  }

  private assertGraphqlNoErrors(assertion: any, response: HttpResponse): AssertionResult {
    try {
      const body = JSON.parse(response.body);
      const errors = body.errors;
      const passed = !errors || (Array.isArray(errors) && errors.length === 0);
      return {
        assertionId: assertion.id,
        passed,
        actual: errors ? JSON.stringify(errors) : null,
        expected: 'no errors',
        message: passed ? 'No GraphQL errors in response' : `GraphQL errors: ${JSON.stringify(errors)}`,
        type: 'GRAPHQL_ERROR_ABSENT',
      };
    } catch {
      return {
        assertionId: assertion.id,
        passed: false,
        actual: null,
        expected: 'no errors',
        message: 'Response body is not valid JSON',
        type: 'GRAPHQL_ERROR_ABSENT',
      };
    }
  }

  private assertSchema(assertion: any, response: HttpResponse): AssertionResult {
    // Basic JSON schema validation - checks structure matches expected shape
    try {
      const body = JSON.parse(response.body);
      const schema = JSON.parse(assertion.expectedValue || '{}');
      const errors = this.validateJsonSchema(body, schema);
      const passed = errors.length === 0;
      return {
        assertionId: assertion.id,
        passed,
        actual: passed ? '(valid)' : errors.join('; '),
        expected: 'schema valid',
        message: passed ? 'Response matches schema' : `Schema validation failed: ${errors.join('; ')}`,
        type: 'SCHEMA',
      };
    } catch (e) {
      return {
        assertionId: assertion.id,
        passed: false,
        actual: null,
        expected: 'schema valid',
        message: `Schema validation error: ${e instanceof Error ? e.message : 'parse error'}`,
        type: 'SCHEMA',
      };
    }
  }

  // =========================================================================
  // HELPERS
  // =========================================================================

  private compareValues(operator: string, actual: any, expected: any): boolean {
    switch (operator) {
      case 'EQUALS': return String(actual) === String(expected);
      case 'NOT_EQUALS': return String(actual) !== String(expected);
      case 'GREATER_THAN': return Number(actual) > Number(expected);
      case 'LESS_THAN': return Number(actual) < Number(expected);
      case 'CONTAINS': return String(actual).includes(String(expected));
      case 'NOT_CONTAINS': return !String(actual).includes(String(expected));
      case 'MATCHES_REGEX': return new RegExp(String(expected)).test(String(actual));
      case 'EXISTS': return actual !== null && actual !== undefined;
      case 'NOT_EXISTS': return actual === null || actual === undefined;
      default: return String(actual) === String(expected);
    }
  }

  private evaluateSimpleJsonPath(obj: any, path: string): any {
    if (path === '$' || path === '') return obj;
    const cleanPath = path.replace(/^\$\.?/, '');
    const parts = cleanPath.split(/\.|\[|\]/).filter(Boolean);
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }
    return current;
  }

  private validateJsonSchema(data: any, schema: any, path = ''): string[] {
    const errors: string[] = [];
    if (!schema || typeof schema !== 'object') return errors;

    if (schema.type) {
      const actualType = Array.isArray(data) ? 'array' : typeof data;
      if (schema.type !== actualType) {
        errors.push(`${path || 'root'}: expected type "${schema.type}", got "${actualType}"`);
      }
    }

    if (schema.required && Array.isArray(schema.required)) {
      for (const field of schema.required) {
        if (data === null || data === undefined || !(field in data)) {
          errors.push(`${path || 'root'}: missing required field "${field}"`);
        }
      }
    }

    if (schema.properties && typeof data === 'object' && data !== null) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in data) {
          errors.push(...this.validateJsonSchema(data[key], propSchema, `${path}.${key}`));
        }
      }
    }

    return errors;
  }

  private async failExecution(executionId: string, errorMessage: string): Promise<void> {
    await prisma.apiExecution.update({
      where: { id: executionId },
      data: {
        status: 'ERROR',
        completedAt: new Date(),
        errorMessage,
      },
    });
    await this.publishEvent(executionId, 'error', errorMessage);
  }

  private async publishEvent(executionId: string, status: string, message: string): Promise<void> {
    try {
      await this.publisher.publish(PUBSUB_CHANNEL, JSON.stringify({
        type: 'api:execution:update',
        apiExecutionId: executionId,
        status,
        message,
        timestamp: Date.now(),
      }));
    } catch (error) {
      logger.warn('Failed to publish API test event:', error);
    }
  }
}
