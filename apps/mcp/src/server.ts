import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v4';
import { loadVisionTestConfig } from './auth.js';
import { VisionTestApiClient } from './client.js';
import { registerComparisonTools } from './tools/comparisons.js';
import { registerExecutionTools } from './tools/executions.js';
import { registerProjectTools } from './tools/projects.js';
import { registerScanTools } from './tools/scans.js';
import { registerTestTools } from './tools/tests.js';
import { registerResources } from './resources.js';

export function createVisionTestMcpServer() {
  const config = loadVisionTestConfig();
  const client = new VisionTestApiClient(config);
  const server = new McpServer({
    name: 'visiontest',
    version: '0.1.0',
  });

  registerProjectTools(server, client);
  registerTestTools(server, client);
  registerExecutionTools(server, client);
  registerComparisonTools(server, client);
  registerScanTools(server, client);
  registerResources(server, client);

  server.registerTool(
    'get_server_info',
    {
      description: 'Return VisionTest MCP server configuration metadata.',
      inputSchema: {},
    },
    async () => ({
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              name: 'visiontest',
              version: '0.1.0',
              apiBaseUrl: config.baseUrl,
              authMode: config.apiKey ? 'x-api-key' : 'bearer',
              capabilities: [
                'story authoring',
                'test execution',
                'comparison inspection',
                'exploratory scans',
                'scan finding promotion',
              ],
            },
            null,
            2,
          ),
        },
      ],
      structuredContent: {
        name: 'visiontest',
        version: '0.1.0',
        apiBaseUrl: config.baseUrl,
        authMode: config.apiKey ? 'x-api-key' : 'bearer',
      },
    }),
  );

  return server;
}

export function jsonToolResult<T extends Record<string, unknown>>(data: T) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
    structuredContent: data,
  };
}

export function jsonArrayToolResult<T>(key: string, items: T[]) {
  return jsonToolResult({ [key]: items } as Record<string, unknown>);
}

export { z };
