import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { VisionTestApiClient } from '../client.js';
import { jsonArrayToolResult } from '../server.js';

export function registerProjectTools(server: McpServer, client: VisionTestApiClient) {
  server.registerTool(
    'list_projects',
    {
      description: 'List VisionTest projects available to the authenticated user.',
      inputSchema: {},
    },
    async () => {
      const projects = await client.listProjects();
      return jsonArrayToolResult('projects', projects);
    },
  );
}
