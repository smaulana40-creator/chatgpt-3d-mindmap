import ForceGraph3D from 'https://esm.sh/3d-force-graph?bundle';
import {
  App,
  PostMessageTransport,
  applyDocumentTheme,
  applyHostStyleVariables,
  applyHostFonts,
} from 'https://esm.sh/@modelcontextprotocol/ext-apps@1.7.5?bundle';

const graphEl = document.getElementById('graph');
const inspectorEl = document.getElementById('inspector');
const statusEl = document.getElementById('status');
const repoLabelEl = document.getElementById('repo-label');
const resetBtn = document.getElementById('reset-camera');
const fullscreenBtn = document.getElementById('fullscreen');

let state;
let busyNodeId;
let lastHostContext = {};

const app = new App(
  { name: 'GitHub 3D Mind Map', version: '0.1.0' },
  { availableDisplayModes: ['inline', 'fullscreen'] },
);

const Graph = ForceGraph3D()(graphEl)
  .backgroundColor('rgba(0,0,0,0)')
  .showNavInfo(false)
  .nodeRelSize(5)
  .nodeVal((node) => node.kind === 'repo' ? 7 : node.kind === 'dir' ? 4 : 1.6)
  .nodeColor((node) => node.kind === 'repo' ? '#59d9ff' : node.kind === 'dir' ? '#a98cff' : '#b9c7d4')
  .nodeOpacity(0.95)
  .nodeLabel((node) => `<strong>${escapeHtml(node.name)}</strong><br><span>${escapeHtml(node.path || 'repository root')}</span>`)
  .linkColor(() => 'rgba(127, 188, 235, .42)')
  .linkOpacity(0.52)
  .linkWidth(0.8)
  .linkDirectionalParticles(1)
  .linkDirectionalParticleWidth(0.8)
  .linkDirectionalParticleSpeed(0.003)
  .enableNodeDrag(true)
  .onNodeClick((node) => handleNodeClick(node))
  .onNodeHover((node) => { graphEl.style.cursor = node ? 'pointer' : 'grab'; });

Graph.d3Force('charge')?.strength?.(-95);
Graph.d3Force('link')?.distance?.((link) => {
  const sourceKind = typeof link.source === 'object' ? link.source.kind : undefined;
  return sourceKind === 'repo' ? 70 : 48;
});

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[char]);
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) { value /= 1024; index += 1; }
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

function setStatus(message, { error = false, loading = false } = {}) {
  statusEl.classList.toggle('error', error);
  statusEl.innerHTML = `${loading ? '<span class="loading-dot"></span>' : ''}${escapeHtml(message)}`;
}

function updateGraph() {
  if (!state) return;
  const data = GraphState.visibleGraph(state);
  Graph.graphData({
    nodes: data.nodes,
    links: data.links.map((link) => ({ ...link })),
  });
  updateInspector();
  repoLabelEl.textContent = `${state.owner}/${state.repo}${state.ref ? ` · ${state.ref}` : ''}`;
  setStatus(`${data.nodes.length} visible nodes · ${Object.keys(state.nodesById).length} cached`);
}

function updateInspector() {
  if (!state) {
    inspectorEl.innerHTML = '<div class="empty">Load a repository graph to begin.</div>';
    return;
  }
  const node = state.nodesById[state.selectedId] || state.nodesById[state.rootId];
  if (!node) return;
  const isDirectory = node.kind === 'dir';
  const isExpanded = Boolean(state.expandedIds[node.id]);
  const isLoaded = Boolean(state.loadedIds[node.id]);
  const childrenCount = Object.values(state.linksByKey).filter((link) => link.source === node.id).length;
  const actionLabel = isExpanded ? 'Collapse branch' : isLoaded ? 'Expand cached branch' : 'Load children';

  inspectorEl.innerHTML = `
    <div class="kicker">Selected node</div>
    <h2 class="node-title">${escapeHtml(node.name)}</h2>
    <div class="path">${escapeHtml(node.path || `${state.owner}/${state.repo}`)}</div>
    <div class="badges">
      <span class="badge ${node.kind}">${escapeHtml(node.kind.toUpperCase())}</span>
      ${isDirectory ? `<span class="badge">${isLoaded ? `${childrenCount} cached children` : 'lazy'}</span>` : ''}
    </div>
    <dl class="meta">
      <dt>Size</dt><dd>${formatBytes(node.size)}</dd>
      <dt>SHA</dt><dd>${escapeHtml(node.sha ? node.sha.slice(0, 12) : '—')}</dd>
      <dt>State</dt><dd>${node.kind === 'repo' ? 'Root' : isDirectory ? (isExpanded ? 'Expanded' : isLoaded ? 'Cached' : 'Not loaded') : 'Leaf'}</dd>
    </dl>
    <div class="inspector-actions">
      ${isDirectory ? `<button class="action-btn primary" id="toggle-node">${actionLabel}</button>` : ''}
      <button class="action-btn" id="focus-node">Focus camera</button>
      <button class="action-btn" id="copy-path">Copy path</button>
    </div>
    <div class="legend">
      <span><i class="dot" style="background:#59d9ff"></i>repo</span>
      <span><i class="dot" style="background:#a98cff"></i>folder</span>
      <span><i class="dot" style="background:#b9c7d4"></i>file</span>
    </div>
    <div class="hint">Click a folder node to lazy-load or collapse its direct descendants. Drag nodes, drag the background to orbit, and scroll to zoom.</div>
  `;

  document.getElementById('toggle-node')?.addEventListener('click', () => toggleDirectory(node));
  document.getElementById('focus-node')?.addEventListener('click', () => focusNode(node));
  document.getElementById('copy-path')?.addEventListener('click', async () => {
    const value = node.path || `${state.owner}/${state.repo}`;
    try {
      await navigator.clipboard.writeText(value);
      setStatus('Path copied.');
    } catch {
      setStatus(value);
    }
  });
}

function focusNode(node) {
  if (![node.x, node.y, node.z].every(Number.isFinite)) return;
  const distance = 95;
  const length = Math.hypot(node.x, node.y, node.z) || 1;
  const ratio = 1 + distance / length;
  Graph.cameraPosition(
    { x: node.x * ratio, y: node.y * ratio, z: node.z * ratio },
    node,
    650,
  );
}

async function handleNodeClick(node) {
  if (!state) return;
  GraphState.select(state, node.id);
  updateInspector();
  focusNode(node);
  if (node.kind === 'dir') await toggleDirectory(node);
}

async function toggleDirectory(node) {
  if (!state || node.kind !== 'dir' || busyNodeId) return;

  if (state.expandedIds[node.id]) {
    GraphState.collapse(state, node.id);
    updateGraph();
    return;
  }

  if (!GraphState.needsFetch(state, node.id)) {
    GraphState.expandCached(state, node.id);
    updateGraph();
    return;
  }

  busyNodeId = node.id;
  setStatus(`Loading ${node.path}…`, { loading: true });
  try {
    const result = await app.callServerTool({
      name: 'expand_repository_node',
      arguments: {
        owner: state.owner,
        repo: state.repo,
        path: node.path,
        ...(state.ref ? { ref: state.ref } : {}),
      },
    });
    if (result.isError) throw new Error(result.structuredContent?.error || 'Failed to expand directory.');
    const slice = result.structuredContent;
    if (!slice?.nodes || !slice?.links) throw new Error('The expansion tool returned no graph data.');
    GraphState.mergeSlice(state, slice);
    updateGraph();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), { error: true });
  } finally {
    busyNodeId = undefined;
  }
}

function ingestGraph(payload) {
  if (!payload?.nodes || !payload?.links) return;
  if (!state || payload.nodes.some((node) => node.kind === 'repo')) {
    state = GraphState.createState(payload);
  } else {
    GraphState.mergeSlice(state, payload);
  }
  updateGraph();
  setTimeout(() => Graph.zoomToFit(700, 44), 120);
}

app.ontoolinput = (params) => {
  if (params?.arguments?.nodes && params?.arguments?.links) ingestGraph(params.arguments);
};

app.ontoolresult = (result) => {
  if (result?.isError) {
    const message = result.structuredContent?.error || result.content?.find((part) => part.type === 'text')?.text || 'Tool failed.';
    setStatus(message, { error: true });
    return;
  }
  if (result?.structuredContent?.nodes && result?.structuredContent?.links) ingestGraph(result.structuredContent);
};

app.onhostcontextchanged = (ctx) => {
  lastHostContext = { ...lastHostContext, ...ctx };
  if (ctx.theme) applyDocumentTheme(ctx.theme);
  if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
  if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
};

resetBtn.addEventListener('click', () => Graph.zoomToFit(700, 44));
fullscreenBtn.addEventListener('click', async () => {
  try {
    const supported = lastHostContext.availableDisplayModes;
    if (Array.isArray(supported) && !supported.includes('fullscreen')) {
      setStatus('Fullscreen is not offered by this host.');
      return;
    }
    const result = await app.requestDisplayMode({ mode: 'fullscreen' });
    setStatus(`Display mode: ${result.mode}`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Fullscreen request failed.', { error: true });
  }
});

const resizeObserver = new ResizeObserver(() => {
  Graph.width(graphEl.clientWidth).height(graphEl.clientHeight);
});
resizeObserver.observe(graphEl);

setStatus('Waiting for repository graph…', { loading: true });
await app.connect(new PostMessageTransport());
