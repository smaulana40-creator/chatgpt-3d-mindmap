import { getRepositoryRoot, expandRepositoryNode } from './repository-graph.mjs';

export const TOOL_NAMES = Object.freeze({
  root: 'get_repository_root',
  expand: 'expand_repository_node',
  render: 'render_repository_graph',
});

export function makeToolSuccess(structuredContent, text) {
  return {
    structuredContent,
    content: [{ type: 'text', text }],
  };
}

export function makeToolError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    isError: true,
    structuredContent: { error: message },
    content: [{ type: 'text', text: message }],
  };
}

export function createToolHandlers(client) {
  return {
    async getRepositoryRoot(input) {
      try {
        const graph = await getRepositoryRoot(input, client);
        return makeToolSuccess(
          graph,
          `Loaded ${graph.owner}/${graph.repo} with ${Math.max(0, graph.nodes.length - 1)} top-level items. Call ${TOOL_NAMES.render} with this graph data to display the interactive 3D explorer.`,
        );
      } catch (error) {
        return makeToolError(error);
      }
    },

    async expandRepositoryNode(input) {
      try {
        const graph = await expandRepositoryNode(input, client);
        return makeToolSuccess(
          graph,
          `Expanded ${input.path}: ${graph.nodes.length} direct children.`,
        );
      } catch (error) {
        return makeToolError(error);
      }
    },

    async renderRepositoryGraph(input) {
      try {
        const graph = {
          owner: input.owner,
          repo: input.repo,
          ref: input.ref || undefined,
          parentId: input.parentId,
          nodes: Array.isArray(input.nodes) ? input.nodes : [],
          links: Array.isArray(input.links) ? input.links : [],
        };
        return makeToolSuccess(
          graph,
          `Interactive 3D repository graph ready for ${graph.owner}/${graph.repo}.`,
        );
      } catch (error) {
        return makeToolError(error);
      }
    },
  };
}
