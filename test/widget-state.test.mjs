import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadGraphState() {
  const source = await fs.readFile(new URL('../src/widget/state-core.js', import.meta.url), 'utf8');
  const context = { console };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: 'state-core.js' });
  return context.GraphState;
}

function rootSlice() {
  return {
    owner: 'acme', repo: 'demo', ref: 'main', parentId: 'repo:acme/demo',
    nodes: [
      { id: 'repo:acme/demo', name: 'demo', path: '', kind: 'repo', hasChildren: true },
      { id: 'path:src', name: 'src', path: 'src', kind: 'dir', parentId: 'repo:acme/demo', hasChildren: true },
      { id: 'path:README.md', name: 'README.md', path: 'README.md', kind: 'file', parentId: 'repo:acme/demo', hasChildren: false },
    ],
    links: [
      { source: 'repo:acme/demo', target: 'path:src' },
      { source: 'repo:acme/demo', target: 'path:README.md' },
    ],
  };
}

test('createState exposes root children and marks root as loaded/expanded', async () => {
  const GraphState = await loadGraphState();
  const state = GraphState.createState(rootSlice());
  const visible = GraphState.visibleGraph(state);
  assert.equal(state.rootId, 'repo:acme/demo');
  assert.equal(state.loadedIds['repo:acme/demo'], true);
  assert.equal(state.expandedIds['repo:acme/demo'], true);
  assert.deepEqual(Array.from(visible.nodes, (node) => node.id), ['repo:acme/demo', 'path:src', 'path:README.md']);
});

test('mergeSlice de-duplicates cached nodes and links', async () => {
  const GraphState = await loadGraphState();
  const state = GraphState.createState(rootSlice());
  const slice = {
    owner: 'acme', repo: 'demo', ref: 'main', parentId: 'path:src',
    nodes: [{ id: 'path:src/index.js', name: 'index.js', path: 'src/index.js', kind: 'file', parentId: 'path:src', hasChildren: false }],
    links: [{ source: 'path:src', target: 'path:src/index.js' }],
  };
  GraphState.mergeSlice(state, slice);
  GraphState.mergeSlice(state, slice);
  assert.equal(Object.keys(state.nodesById).length, 4);
  assert.equal(Object.keys(state.linksByKey).length, 3);
  assert.equal(state.loadedIds['path:src'], true);
  assert.equal(state.expandedIds['path:src'], true);
});

test('collapse hides descendants but keeps them cached for instant re-expand', async () => {
  const GraphState = await loadGraphState();
  const state = GraphState.createState(rootSlice());
  GraphState.mergeSlice(state, {
    owner: 'acme', repo: 'demo', parentId: 'path:src',
    nodes: [
      { id: 'path:src/lib', name: 'lib', path: 'src/lib', kind: 'dir', parentId: 'path:src', hasChildren: true },
      { id: 'path:src/index.js', name: 'index.js', path: 'src/index.js', kind: 'file', parentId: 'path:src', hasChildren: false },
    ],
    links: [
      { source: 'path:src', target: 'path:src/lib' },
      { source: 'path:src', target: 'path:src/index.js' },
    ],
  });

  assert.equal(GraphState.visibleGraph(state).nodes.length, 5);
  GraphState.collapse(state, 'path:src');
  assert.deepEqual(
    Array.from(GraphState.visibleGraph(state).nodes, (node) => node.id),
    ['repo:acme/demo', 'path:src', 'path:README.md'],
  );
  assert.equal(Boolean(state.nodesById['path:src/lib']), true);
  assert.equal(GraphState.needsFetch(state, 'path:src'), false);

  GraphState.expandCached(state, 'path:src');
  assert.equal(GraphState.visibleGraph(state).nodes.length, 5);
});

test('select tracks the inspector target', async () => {
  const GraphState = await loadGraphState();
  const state = GraphState.createState(rootSlice());
  GraphState.select(state, 'path:README.md');
  assert.equal(state.selectedId, 'path:README.md');
});
