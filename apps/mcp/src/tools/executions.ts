import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { VisionTestApiClient } from '../client.js';
import { jsonToolResult, z } from '../server.js';

const TERMINAL_STATUSES = new Set([
  'PASSED',
  'FAILED',
  'CANCELLED',
  'TIMEOUT',
  'SKIPPED',
]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function registerExecutionTools(server: McpServer, client: VisionTestApiClient) {
  server.registerTool(
    'run_test',
    {
      description: 'Queue a VisionTest execution for a single test.',
      inputSchema: {
        project_id: z.string(),
        test_id: z.string(),
        browser: z.enum(['chromium', 'firefox', 'webkit']).optional(),
        headless: z.boolean().optional(),
        base_url: z.string().url().optional(),
        device_profile_id: z.string().optional(),
      },
    },
    async (input) => {
      const execution = await client.runTest(input);
      return jsonToolResult({
        execution_id: execution.id ?? execution.executionId ?? execution.id,
        status: execution.status,
        execution,
      });
    },
  );

  server.registerTool(
    'run_suite',
    {
      description: 'Queue a VisionTest execution for a suite.',
      inputSchema: {
        project_id: z.string(),
        suite_id: z.string(),
        browser: z.enum(['chromium', 'firefox', 'webkit']).optional(),
        headless: z.boolean().optional(),
        base_url: z.string().url().optional(),
        device_profile_id: z.string().optional(),
      },
    },
    async (input) => {
      const execution = await client.runSuite(input);
      return jsonToolResult({
        execution_id: execution.id ?? execution.executionId ?? execution.id,
        status: execution.status,
        execution,
      });
    },
  );

  server.registerTool(
    'get_execution',
    {
      description: 'Fetch the current VisionTest execution record.',
      inputSchema: {
        execution_id: z.string(),
      },
    },
    async ({ execution_id }) => {
      const execution = await client.getExecution(execution_id);
      return jsonToolResult({ execution });
    },
  );

  server.registerTool(
    'wait_for_execution',
    {
      description: 'Wait for a VisionTest execution to reach a terminal state using bounded polling.',
      inputSchema: {
        execution_id: z.string(),
        timeout_seconds: z.number().int().positive().max(3600).optional(),
      },
    },
    async ({ execution_id, timeout_seconds }) => {
      const timeoutMs = (timeout_seconds ?? 120) * 1000;
      const startedAt = Date.now();
      let delayMs = 1000;

      while (Date.now() - startedAt < timeoutMs) {
        const execution = await client.getExecution(execution_id);
        const status = execution.status as string | undefined;
        if (status && TERMINAL_STATUSES.has(status)) {
          return jsonToolResult({
            execution,
            terminal: true,
            timed_out: false,
            retry_after_ms: null,
          });
        }

        await sleep(delayMs);
        delayMs = Math.min(delayMs * 2, 5000);
      }

      const execution = await client.getExecution(execution_id);
      return jsonToolResult({
        execution,
        terminal: false,
        timed_out: true,
        retry_after_ms: delayMs,
      });
    },
  );

  server.registerTool(
    'get_failure_summary',
    {
      description: 'Return a compact failure-oriented summary for a VisionTest execution.',
      inputSchema: {
        execution_id: z.string(),
      },
    },
    async ({ execution_id }) => {
      const summary = await client.getFailureSummary(execution_id);
      return jsonToolResult(summary);
    },
  );
}
