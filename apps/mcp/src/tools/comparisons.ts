import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { VisionTestApiClient } from '../client.js';
import { jsonToolResult, z } from '../server.js';

function isFailedComparison(status: string | undefined): boolean {
  return status !== 'APPROVED' && status !== 'AUTO_APPROVED';
}

export function registerComparisonTools(server: McpServer, client: VisionTestApiClient) {
  server.registerTool(
    'list_failed_comparisons',
    {
      description: 'List VisionTest comparisons that still require review or represent a failure condition.',
      inputSchema: {
        project_id: z.string().optional(),
        execution_id: z.string().optional(),
        page: z.number().int().positive().optional(),
        limit: z.number().int().positive().max(100).optional(),
      },
    },
    async ({ project_id, execution_id, page, limit }) => {
      if (!project_id && !execution_id) {
        throw new Error('project_id or execution_id is required');
      }

      const result = await client.listComparisons({
        project_id,
        execution_id,
        page,
        limit,
      });

      const comparisons = result.data;
      return jsonToolResult({
        comparisons: comparisons.filter((comparison: any) => isFailedComparison(comparison.status)),
        meta: result.meta ?? null,
      });
    },
  );

  server.registerTool(
    'get_comparison',
    {
      description: 'Fetch a single VisionTest comparison with diff metadata and artifact references.',
      inputSchema: {
        comparison_id: z.string(),
      },
    },
    async ({ comparison_id }) => {
      const comparison = await client.getComparison(comparison_id);
      return jsonToolResult({ comparison });
    },
  );
}
