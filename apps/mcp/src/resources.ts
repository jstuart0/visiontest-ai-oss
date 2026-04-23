import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { VisionTestApiClient } from './client.js';

function toJsonText(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function firstParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

export function registerResources(server: McpServer, client: VisionTestApiClient) {
  server.registerResource(
    'project-summary',
    new ResourceTemplate('visiontest://project/{projectId}/summary', { list: undefined }),
    {
      title: 'VisionTest Project Summary',
      mimeType: 'application/json',
    },
    async (_uri, { projectId }) => {
      const projectIdValue = firstParam(projectId);
      const project = await client.getProject(projectIdValue);
      return {
        contents: [
          {
            uri: `visiontest://project/${projectIdValue}/summary`,
            mimeType: 'application/json',
            text: toJsonText(project),
          },
        ],
      };
    },
  );

  server.registerResource(
    'test',
    new ResourceTemplate('visiontest://test/{testId}', { list: undefined }),
    {
      title: 'VisionTest Test',
      mimeType: 'application/json',
    },
    async (_uri, { testId }) => {
      const testIdValue = firstParam(testId);
      const test = await client.getTest(testIdValue);
      return {
        contents: [
          {
            uri: `visiontest://test/${testIdValue}`,
            mimeType: 'application/json',
            text: toJsonText(test),
          },
        ],
      };
    },
  );

  server.registerResource(
    'execution-summary',
    new ResourceTemplate('visiontest://execution/{executionId}/summary', { list: undefined }),
    {
      title: 'VisionTest Execution Summary',
      mimeType: 'application/json',
    },
    async (_uri, { executionId }) => {
      const executionIdValue = firstParam(executionId);
      const execution = await client.getExecution(executionIdValue);
      return {
        contents: [
          {
            uri: `visiontest://execution/${executionIdValue}/summary`,
            mimeType: 'application/json',
            text: toJsonText({
              id: execution.id,
              status: execution.status,
              duration: execution.duration,
              goalAchieved: execution.goalAchieved,
              goalReasoning: execution.goalReasoning,
              errorMessage: execution.errorMessage,
            }),
          },
        ],
      };
    },
  );

  server.registerResource(
    'execution-timeline',
    new ResourceTemplate('visiontest://execution/{executionId}/timeline', { list: undefined }),
    {
      title: 'VisionTest Execution Timeline',
      mimeType: 'application/json',
    },
    async (_uri, { executionId }) => {
      const executionIdValue = firstParam(executionId);
      const execution = await client.getExecution(executionIdValue);
      const steps = Array.isArray(execution?.result?.steps) ? execution.result.steps : [];
      return {
        contents: [
          {
            uri: `visiontest://execution/${executionIdValue}/timeline`,
            mimeType: 'application/json',
            text: toJsonText({ steps }),
          },
        ],
      };
    },
  );

  server.registerResource(
    'execution-artifacts',
    new ResourceTemplate('visiontest://execution/{executionId}/artifacts', { list: undefined }),
    {
      title: 'VisionTest Execution Artifacts',
      mimeType: 'application/json',
    },
    async (_uri, { executionId }) => {
      const executionIdValue = firstParam(executionId);
      const execution = await client.getExecution(executionIdValue);
      return {
        contents: [
          {
            uri: `visiontest://execution/${executionIdValue}/artifacts`,
            mimeType: 'application/json',
            text: toJsonText({
              screenshots: execution.screenshots ?? [],
              videos: execution.videos ?? [],
              checkpoints: execution.checkpoints ?? [],
              comparisons: execution.comparisons ?? [],
            }),
          },
        ],
      };
    },
  );

  server.registerResource(
    'comparison',
    new ResourceTemplate('visiontest://comparison/{comparisonId}', { list: undefined }),
    {
      title: 'VisionTest Comparison',
      mimeType: 'application/json',
    },
    async (_uri, { comparisonId }) => {
      const comparisonIdValue = firstParam(comparisonId);
      const comparison = await client.getComparison(comparisonIdValue);
      return {
        contents: [
          {
            uri: `visiontest://comparison/${comparisonIdValue}`,
            mimeType: 'application/json',
            text: toJsonText(comparison),
          },
        ],
      };
    },
  );

  server.registerResource(
    'comparison-diff',
    new ResourceTemplate('visiontest://comparison/{comparisonId}/diff', { list: undefined }),
    {
      title: 'VisionTest Comparison Diff',
      mimeType: 'application/json',
    },
    async (_uri, { comparisonId }) => {
      const comparisonIdValue = firstParam(comparisonId);
      const comparison = await client.getComparison(comparisonIdValue);
      return {
        contents: [
          {
            uri: `visiontest://comparison/${comparisonIdValue}/diff`,
            mimeType: 'application/json',
            text: toJsonText({
              comparisonId: comparisonIdValue,
              diffUrl: comparison.diffUrl ?? null,
              diffScore: comparison.diffScore ?? null,
              status: comparison.status ?? null,
              aiClassification: comparison.aiClassification ?? null,
              aiExplanation: comparison.aiExplanation ?? null,
            }),
          },
        ],
      };
    },
  );

  server.registerResource(
    'scan-summary',
    new ResourceTemplate('visiontest://scan/{executionId}/summary', { list: undefined }),
    {
      title: 'VisionTest Scan Summary',
      mimeType: 'application/json',
    },
    async (_uri, { executionId }) => {
      const executionIdValue = firstParam(executionId);
      const tree = await client.getScanTree(executionIdValue);
      return {
        contents: [
          {
            uri: `visiontest://scan/${executionIdValue}/summary`,
            mimeType: 'application/json',
            text: toJsonText(tree.summary ?? {}),
          },
        ],
      };
    },
  );

  server.registerResource(
    'scan-nodes',
    new ResourceTemplate('visiontest://scan/{executionId}/nodes', { list: undefined }),
    {
      title: 'VisionTest Scan Nodes',
      mimeType: 'application/json',
    },
    async (_uri, { executionId }) => {
      const executionIdValue = firstParam(executionId);
      const tree = await client.getScanTree(executionIdValue);
      return {
        contents: [
          {
            uri: `visiontest://scan/${executionIdValue}/nodes`,
            mimeType: 'application/json',
            text: toJsonText(tree.nodes ?? []),
          },
        ],
      };
    },
  );
}
