(function attachGraphState(global) {
  function linkEndpointId(value) {
    return typeof value === 'object' && value !== null ? value.id : value;
  }

  function linkKey(link) {
    return `${linkEndpointId(link.source)}→${linkEndpointId(link.target)}`;
  }

  function emptyState() {
    return {
      owner: '',
      repo: '',
      ref: undefined,
      rootId: undefined,
      nodesById: Object.create(null),
      linksByKey: Object.create(null),
      expandedIds: Object.create(null),
      loadedIds: Object.create(null),
      selectedId: undefined,
    };
  }

  function mergeNodesAndLinks(state, slice) {
    for (const node of slice.nodes || []) {
      if (!node?.id) continue;
      state.nodesById[node.id] = { ...(state.nodesById[node.id] || {}), ...node };
    }
    for (const link of slice.links || []) {
      if (!link?.source || !link?.target) continue;
      const normalized = {
        source: linkEndpointId(link.source),
        target: linkEndpointId(link.target),
      };
      state.linksByKey[linkKey(normalized)] = normalized;
    }
  }

  function createState(slice) {
    const state = emptyState();
    state.owner = slice.owner || '';
    state.repo = slice.repo || '';
    state.ref = slice.ref || undefined;
    state.rootId = (slice.nodes || []).find((node) => node.kind === 'repo')?.id || slice.parentId;
    mergeNodesAndLinks(state, slice);
    if (state.rootId) {
      state.loadedIds[state.rootId] = true;
      state.expandedIds[state.rootId] = true;
      state.selectedId = state.rootId;
    }
    return state;
  }

  function mergeSlice(state, slice) {
    state.owner = slice.owner || state.owner;
    state.repo = slice.repo || state.repo;
    state.ref = slice.ref || state.ref;
    mergeNodesAndLinks(state, slice);
    if (slice.parentId) {
      state.loadedIds[slice.parentId] = true;
      state.expandedIds[slice.parentId] = true;
    }
    return state;
  }

  function collapse(state, nodeId) {
    if (nodeId && nodeId !== state.rootId) delete state.expandedIds[nodeId];
    return state;
  }

  function expandCached(state, nodeId) {
    if (state.loadedIds[nodeId]) state.expandedIds[nodeId] = true;
    return state;
  }

  function needsFetch(state, nodeId) {
    return !Boolean(state.loadedIds[nodeId]);
  }

  function select(state, nodeId) {
    if (nodeId && state.nodesById[nodeId]) state.selectedId = nodeId;
    return state;
  }

  function visibleGraph(state) {
    if (!state.rootId || !state.nodesById[state.rootId]) return { nodes: [], links: [] };

    const outgoing = Object.create(null);
    const storedLinks = Object.values(state.linksByKey);
    for (const link of storedLinks) {
      const source = linkEndpointId(link.source);
      if (!outgoing[source]) outgoing[source] = [];
      outgoing[source].push({ source, target: linkEndpointId(link.target) });
    }

    const visibleIds = new Set();
    const visibleLinks = [];
    const queue = [state.rootId];

    while (queue.length) {
      const id = queue.shift();
      if (visibleIds.has(id)) continue;
      visibleIds.add(id);
      if (!state.expandedIds[id]) continue;

      for (const link of outgoing[id] || []) {
        if (!state.nodesById[link.target]) continue;
        visibleLinks.push({ source: link.source, target: link.target });
        if (!visibleIds.has(link.target)) queue.push(link.target);
      }
    }

    const nodes = Object.values(state.nodesById).filter((node) => visibleIds.has(node.id));
    return { nodes, links: visibleLinks };
  }

  global.GraphState = Object.freeze({
    createState,
    mergeSlice,
    collapse,
    expandCached,
    needsFetch,
    select,
    visibleGraph,
  });
})(globalThis);
