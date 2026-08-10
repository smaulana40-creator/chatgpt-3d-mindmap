import test from 'node:test';
import assert from 'node:assert/strict';

import {
  repositoryRootId,
  nodeIdForPath,
  mapGitHubEntryToNode,
} from '../src/shared/graph.mjs';

test('repositoryRootId is deterministic', () => {
  assert.equal(repositoryRootId('openai', 'demo'), 'repo:openai/demo');
  assert.equal(repositoryRootId('openai', 'demo'), 'repo:openai/demo');
});

test('nodeIdForPath normalizes leading and repeated slashes', () => {
  assert.equal(nodeIdForPath('/src//lib/index.js'), 'path:src/lib/index.js');
});

test('mapGitHubEntryToNode maps directories and files', () => {
  const dir = mapGitHubEntryToNode({
    name: 'src',
    path: 'src',
    type: 'dir',
    size: 0,
    sha: 'abc',
    htmlUrl: 'https://github.com/acme/demo/tree/main/src',
  }, 'repo:acme/demo');

  const file = mapGitHubEntryToNode({
    name: 'README.md',
    path: 'README.md',
    type: 'file',
    size: 123,
    sha: 'def',
    htmlUrl: 'https://github.com/acme/demo/blob/main/README.md',
  }, 'repo:acme/demo');

  assert.deepEqual(dir, {
    id: 'path:src',
    name: 'src',
    path: 'src',
    kind: 'dir',
    size: 0,
    sha: 'abc',
    url: 'https://github.com/acme/demo/tree/main/src',
    parentId: 'repo:acme/demo',
    hasChildren: true,
  });

  assert.equal(file.kind, 'file');
  assert.equal(file.hasChildren, false);
  assert.equal(file.id, 'path:README.md');
});
