import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createVisionTestMcpServer } from './server.js';

async function main() {
  const server = createVisionTestMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('[visiontest-mcp] fatal:', error);
  process.exit(1);
});
