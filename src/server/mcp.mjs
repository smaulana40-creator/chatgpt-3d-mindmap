import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';

import { createGitHubClient } from './github-client.mjs';
import { createToolHandlers, TOOL_NAMES } from './tool-handlers.mjs';
import {
  WIDGET_RESOURCE_URI,
  WIDGET_MIME_TYPE,
  WIDGET_RESOURCE_META,
  buildWidgetHtml,
} from './widget-resource.mjs';

const ownerSchema = z.string().trim().min(1).max(100);
const repoSchema = z.string().trim().min(1).max(100);
const refSchema = z.string().trim().min(1).max(512).optional();
const pathSchema = z.string().trim().min(1).max(4096);

const nodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  kind: z.enum(['repo', 'dir', 'file']),
  size: z.number().optional(),
  sha: z.string().optional(),
  url: z.string().optional(),
  parentId: z.string().optional(),
  hasChildren: z.boolean(),
}).passthrough();

const linkSchema = z.object({
  source: z.string(),
  target: z.string(),
});

const readOnlyAnnotations = Object.freeze({
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
});

export function createMcpServer({ fetchImpl = globalThis.fetch, token = process.env.GITHUB_TOKEN ?? '' } = {}) {
  if (RESOURCE_MIME_TYPE !== WIDGET_MIME_TYPE) {
    throw new Error(`Unexpected MCP Apps MIME type: ${RESOURCE_MIME_TYPE}`);
  }

  const server = new McpServer({
    name: 'GitHub 3D Mind Map',
    version: '0.1.0',
  });
  const client = createGitHubClient(fetchImpl, token);
  const handlers = createToolHandlers(client);

  server.registerTool(
    TOOL_NAMES.root,
    {
      title: 'Load GitHub repository graph',
      description: `Read the root of a GitHub repository and return its direct children as graph data. After this succeeds, call ${TOOL_NAMES.render} with the returned structuredContent to show the interactive 3D mind map.`,
      inputSchema: {
        owner: ownerSchema,
        repo: repoSchema,
        ref: refSchema,
      },
      annotations: readOnlyAnnotations,
    },
    handlers.getRepositoryRoot,
  );

  server.registerTool(
    TOOL_NAMES.expand,
    {
      title: 'Expand repository directory',
      description: 'Read exactly one directory level from GitHub. Intended for lazy expansion from the interactive graph.',
      inputSchema: {
        owner: ownerSchema,
        repo: repoSchema,
        path: pathSchema,
        ref: refSchema,
      },
      annotations: readOnlyAnnotations,
      _meta: {
        ui: {
          visibility: ['app'],
        },
      },
    },
    handlers.expandRepositoryNode,
  );

  registerAppTool(
    server,
    TOOL_NAMES.render,
    {
      title: 'Render GitHub repository in 3D',
      description: 'Render previously loaded GitHub graph data as an interactive 3D mind map with lazy directory expansion.',
      inputSchema: {
        owner: ownerSchema,
        repo: repoSchema,
        ref: refSchema,
        parentId: z.string(),
        nodes: z.array(nodeSchema),
        links: z.array(linkSchema),
      },
      annotations: readOnlyAnnotations,
      _meta: {
        ui: {
          resourceUri: WIDGET_RESOURCE_URI,
          visibility: ['model', 'app'],
        },
      },
    },
    handlers.renderRepositoryGraph,
  );

  registerAppResource(
    server,
    WIDGET_RESOURCE_URI,
    WIDGET_RESOURCE_URI,
    {
      mimeType: RESOURCE_MIME_TYPE,
      _meta: WIDGET_RESOURCE_META,
    },
    async () => {
      const html = await buildWidgetHtml();
      return {
        contents: [
          {
            uri: WIDGET_RESOURCE_URI,
            mimeType: RESOURCE_MIME_TYPE,
            text: html,
            _meta: WIDGET_RESOURCE_META,
          },
        ],
      };
    },
  );

  return server;
}
