import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { VisionTestApiClient } from '../client.js';
import { jsonToolResult, z } from '../server.js';

export function registerTestTools(server: McpServer, client: VisionTestApiClient) {
  server.registerTool(
    'list_tests',
    {
      description: 'List tests for a VisionTest project.',
      inputSchema: {
        project_id: z.string(),
        status: z.string().optional(),
        tags: z.array(z.string()).optional(),
        search: z.string().optional(),
        page: z.number().int().positive().optional(),
        limit: z.number().int().positive().max(100).optional(),
      },
    },
    async (input) => {
      const result = await client.listTests(input);
      return jsonToolResult({
        tests: result.data ?? result,
        meta: result.meta ?? null,
      });
    },
  );

  server.registerTool(
    'get_test',
    {
      description: 'Fetch a single VisionTest test with its current steps and metadata.',
      inputSchema: {
        test_id: z.string(),
      },
    },
    async ({ test_id }) => {
      const test = await client.getTest(test_id);
      return jsonToolResult({ test });
    },
  );

  server.registerTool(
    'parse_story_to_steps',
    {
      description: 'Preview how VisionTest will parse a natural-language use case into steps and goal checks.',
      inputSchema: {
        project_id: z.string(),
        story: z.string(),
        goal: z.string().optional(),
        start_url: z.string().url().optional(),
        story_format: z.enum(['natural', 'yaml', 'json']).optional(),
      },
    },
    async (input) => {
      const preview = await client.previewStory(input);
      return jsonToolResult(preview);
    },
  );

  server.registerTool(
    'create_test_from_story',
    {
      description: 'Create a durable VisionTest test from a natural-language story.',
      inputSchema: {
        project_id: z.string(),
        name: z.string(),
        story: z.string(),
        goal: z.string().optional(),
        start_url: z.string().url().optional(),
        story_format: z.enum(['natural', 'yaml', 'json']).optional(),
        description: z.string().optional(),
        suite_id: z.string().optional(),
        feature_id: z.string().optional(),
        tags: z.array(z.string()).optional(),
        environment: z.string().optional(),
        credential_ref: z.string().optional(),
      },
    },
    async (input) => {
      const created = await client.createTestFromStory(input);
      return jsonToolResult(created);
    },
  );

  server.registerTool(
    'update_test',
    {
      description: 'Patch an existing VisionTest test.',
      inputSchema: {
        test_id: z.string(),
        patch: z.record(z.string(), z.unknown()),
      },
    },
    async ({ test_id, patch }) => {
      const test = await client.updateTest(test_id, patch);
      return jsonToolResult({ test });
    },
  );
}
