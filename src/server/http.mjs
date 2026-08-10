import cors from 'cors';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createMcpServer } from './mcp.mjs';

export async function startHttpServer({ port = Number.parseInt(process.env.PORT ?? '3001', 10) } = {}) {
  const app = createMcpExpressApp({ host: '0.0.0.0' });
  app.use(cors());

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'chatgpt-3d-mindmap' });
  });

  app.all('/mcp', async (req, res) => {
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on('close', () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('MCP request failed:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  });

  return await new Promise((resolve, reject) => {
    const httpServer = app.listen(port, '0.0.0.0', (error) => {
      if (error) {
        reject(error);
        return;
      }
      console.log(`GitHub 3D Mind Map MCP listening on http://0.0.0.0:${port}/mcp`);
      resolve(httpServer);
    });
  });
}

export async function startStdioServer() {
  await createMcpServer().connect(new StdioServerTransport());
}

async function main() {
  if (process.argv.includes('--stdio')) {
    await startStdioServer();
    return;
  }

  const server = await startHttpServer();
  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
