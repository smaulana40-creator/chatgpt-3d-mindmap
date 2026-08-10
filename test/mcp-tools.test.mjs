import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TOOL_NAMES,
  createToolHandlers,
  makeToolSuccess,
  makeToolError,
} from '../src/server/tool-handlers.mjs';

function fakeClient() {
  return {
    async listDirectory({ path }) {
      if (!path) {
        return [{
          name: 'src', path: 'src', type: 'dir', size: 0, sha: 'srcsha',
          htmlUrl: 'https://github.com/acme/demo/tree/main/src',
        }];
      }
      return [{
        name: 'index.js', path: `${path}/index.js`, type: 'file', size: 7, sha: 'idx',
        htmlUrl: `https://github.com/acme/demo/blob/main/${path}/index.js`,
      }];
    },
  };
}

test('tool names are stable and explicit', () => {
  assert.deepEqual(TOOL_NAMES, {
    root: 'get_repository_root',
    expand: 'expand_repository_node',
    render: 'render_repository_graph',
  });
});

test('root and expand handlers return structuredContent with text fallback', async () => {
  const handlers = createToolHandlers(fakeClient());
  const root = await handlers.getRepositoryRoot({ owner: 'acme', repo: 'demo', ref: 'main' });
  assert.equal(root.isError, undefined);
  assert.equal(root.structuredContent.nodes.length, 2);
  assert.match(root.content[0].text, /acme\/demo/i);

  const expand = await handlers.expandRepositoryNode({ owner: 'acme', repo: 'demo', path: 'src', ref: 'main' });
  assert.equal(expand.structuredContent.parentId, 'path:src');
  assert.equal(expand.structuredContent.nodes[0].id, 'path:src/index.js');
});

test('render handler echoes graph data for the UI without secrets', async () => {
  const handlers = createToolHandlers(fakeClient());
  const result = await handlers.renderRepositoryGraph({
    owner: 'acme', repo: 'demo', ref: 'main', parentId: 'repo:acme/demo',
    nodes: [{ id: 'repo:acme/demo', name: 'demo', path: '', kind: 'repo', hasChildren: true }],
    links: [],
  });
  assert.equal(result.structuredContent.owner, 'acme');
  assert.equal(result.structuredContent.nodes[0].kind, 'repo');
  assert.match(result.content[0].text, /interactive 3d/i);
});

test('tool result helpers shape success and error payloads', () => {
  const success = makeToolSuccess({ ok: true }, 'done');
  assert.deepEqual(success, {
    structuredContent: { ok: true },
    content: [{ type: 'text', text: 'done' }],
  });

  const error = makeToolError(new Error('boom'));
  assert.equal(error.isError, true);
  assert.equal(error.structuredContent.error, 'boom');
  assert.match(error.content[0].text, /boom/);
});
