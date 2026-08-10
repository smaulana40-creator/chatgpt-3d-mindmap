import {
  makeRepositoryNode,
  mapGitHubEntryToNode,
  nodeIdForPath,
  repositoryRootId,
  normalizePath,
} from '../shared/graph.mjs';

function makeLinks(parentId, nodes) {
  return nodes.map((node) => ({ source: parentId, target: node.id }));
}

export async function getRepositoryRoot({ owner, repo, ref } = {}, client) {
  if (!client?.listDirectory) throw new Error('GitHub client is required');
  const entries = await client.listDirectory({ owner, repo, path: '', ref });
  const root = makeRepositoryNode(owner, repo, ref);
  const childNodes = entries.map((entry) => mapGitHubEntryToNode(entry, root.id));

  return {
    owner,
    repo,
    ref: ref || undefined,
    parentId: repositoryRootId(owner, repo),
    nodes: [root, ...childNodes],
    links: makeLinks(root.id, childNodes),
  };
}

export async function expandRepositoryNode({ owner, repo, path, ref } = {}, client) {
  if (!client?.listDirectory) throw new Error('GitHub client is required');
  const normalizedPath = normalizePath(path);
  if (!normalizedPath) throw new Error('path is required to expand a directory');

  const entries = await client.listDirectory({ owner, repo, path: normalizedPath, ref });
  const parentId = nodeIdForPath(normalizedPath);
  const nodes = entries.map((entry) => mapGitHubEntryToNode(entry, parentId));

  return {
    owner,
    repo,
    ref: ref || undefined,
    parentId,
    nodes,
    links: makeLinks(parentId, nodes),
  };
}
