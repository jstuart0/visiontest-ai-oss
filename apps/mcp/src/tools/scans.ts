import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { VisionTestApiClient } from '../client.js';
import { jsonToolResult, z } from '../server.js';

export function registerScanTools(server: McpServer, client: VisionTestApiClient) {
  server.registerTool(
    'start_smoke_explore',
    {
      description: 'Start a lightweight read-only Smoke Explore run for a single URL.',
      inputSchema: {
        start_url: z.string().url(),
        project_id: z.string().optional(),
        session_mode: z.enum(['auto', 'anonymous', 'project']).optional(),
      },
    },
    async (input) => {
      const execution = await client.startSmokeExplore(input);
      return jsonToolResult({
        execution_id: execution.executionId ?? execution.id,
        status: execution.status,
        tier: execution.tier ?? 'smoke',
        session_mode: execution.sessionMode ?? input.session_mode ?? 'project',
        execution,
      });
    },
  );

  server.registerTool(
    'start_project_scan',
    {
      description: 'Start a full exploratory project scan in VisionTest.',
      inputSchema: {
        project_id: z.string(),
        start_url: z.string().url(),
        max_pages: z.number().int().positive().max(200).optional(),
        max_clicks_per_page: z.number().int().positive().max(100).optional(),
        login_steps: z.array(z.unknown()).optional(),
        safety: z
          .object({
            mode: z.enum(['read-only', 'allow-destructive', 'sandbox']).optional(),
            destructivePhrases: z.array(z.string()).optional(),
            allowedSelectors: z.array(z.string()).optional(),
            blockedSelectors: z.array(z.string()).optional(),
            allowFormSubmit: z.boolean().optional(),
            stubNetworkWrites: z.boolean().optional(),
            resetHookUrl: z.string().url().nullable().optional(),
          })
          .optional(),
      },
    },
    async (input) => {
      const execution = await client.startProjectScan(input);
      return jsonToolResult({
        execution_id: execution.executionId ?? execution.id,
        status: execution.status,
        execution,
      });
    },
  );

  server.registerTool(
    'get_scan_tree',
    {
      description: 'Fetch the ExploreNode tree for a VisionTest exploratory execution.',
      inputSchema: {
        execution_id: z.string(),
      },
    },
    async ({ execution_id }) => {
      const tree = await client.getScanTree(execution_id);
      return jsonToolResult(tree);
    },
  );

  server.registerTool(
    'promote_scan_finding_to_test',
    {
      description: 'Create a durable VisionTest test from an exploratory scan finding.',
      inputSchema: {
        execution_id: z.string(),
        node_id: z.string(),
        project_id: z.string().optional(),
        name: z.string().optional(),
      },
    },
    async ({ execution_id, node_id, project_id, name }) => {
      const promoted = await client.promoteScanFinding(execution_id, node_id, {
        projectId: project_id,
        name,
      });
      return jsonToolResult(promoted);
    },
  );
}
