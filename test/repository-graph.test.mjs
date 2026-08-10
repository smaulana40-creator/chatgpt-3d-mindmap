import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getRepositoryRoot,
  expandRepositoryNode,
} from '../src/server/repository-graph.mjs';

function fakeClient(entriesByPath) {
  return {
    calls: [],
    async listDirectory(input) {
      this.calls.push(input);
      return entriesByPath[input.path ?? ''] ?? [];
    },
  };
}

const rootEntries = [
  {
    name: 'src',
    path: 'src',
    type: 'dir',
    size: 0,
    sha: 'srcsha',
    htmlUrl: 'https://github.com/acme/demo/tree/main/src',
  },
  {
    name: 'README.md',
    path: 'README.md',
    type: 'file',
    size: 9,
    sha: 'readmesha',
    htmlUrl: 'https://github.com/acme/demo/blob/main/README.md',
  },
];

test('getRepositoryRoot returns root plus direct children only', async () => {
  const client = fakeClient({ '': rootEntries });
  const result = await getRepositoryRoot({ owner: 'acme', repo: 'demo', ref: 'main' }, client);

  assert.deepEqual(client.calls, [{ owner: 'acme', repo: 'demo', path: '', ref: 'main' }]);
  assert.equal(result.owner, 'acme');
  assert.equal(result.repo, 'demo');
  assert.equal(result.ref, 'main');
  assert.equal(result.parentId, 'repo:acme/demo');
  assert.equal(result.nodes.length, 3);
  assert.equal(result.nodes[0].id, 'repo:acme/demo');
  assert.deepEqual(result.links, [
    { source: 'repo:acme/demo', target: 'path:src' },
    { source: 'repo:acme/demo', target: 'path:README.md' },
  ]);
});

test('expandRepositoryNode returns only children of requested directory', async () => {
  const client = fakeClient({
    src: [
      {
        name: 'index.js',
        path: 'src/index.js',
        type: 'file',
        size: 100,
        sha: 'indexsha',
        htmlUrl: 'https://github.com/acme/demo/blob/main/src/index.js',
      },
      {
        name: 'lib',
        path: 'src/lib',
        type: 'dir',
        size: 0,
        sha: 'libsha',
        htmlUrl: 'https://github.com/acme/demo/tree/main/src/lib',
      },
    ],
  });

  const result = await expandRepositoryNode(
    { owner: 'acme', repo: 'demo', path: 'src', ref: 'main' },
    client,
  );

  assert.equal(result.parentId, 'path:src');
  assert.deepEqual(result.nodes.map((node) => node.id), ['path:src/index.js', 'path:src/lib']);
  assert.deepEqual(result.links, [
    { source: 'path:src', target: 'path:src/index.js' },
    { source: 'path:src', target: 'path:src/lib' },
  ]);
  assert.equal(result.nodes.some((node) => node.id === 'path:src'), false);
});

test('expandRepositoryNode rejects an empty path', async () => {
  const client = fakeClient({});
  await assert.rejects(
    () => expandRepositoryNode({ owner: 'acme', repo: 'demo', path: '' }, client),
    /path is required/i,
  );
});
