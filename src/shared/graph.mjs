function cleanSegment(value) {
  return String(value ?? '').trim().replace(/^\/+|\/+$/g, '');
}

export function normalizePath(path = '') {
  return String(path)
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
    .join('/');
}

export function repositoryRootId(owner, repo) {
  const cleanOwner = cleanSegment(owner);
  const cleanRepo = cleanSegment(repo);
  if (!cleanOwner || !cleanRepo) {
    throw new Error('owner and repo are required');
  }
  return `repo:${cleanOwner}/${cleanRepo}`;
}

export function nodeIdForPath(path) {
  const normalized = normalizePath(path);
  if (!normalized) throw new Error('path is required for a non-root node');
  return `path:${normalized}`;
}

export function mapGitHubEntryToNode(entry, parentId) {
  const kind = entry.type === 'dir' ? 'dir' : 'file';
  return {
    id: nodeIdForPath(entry.path),
    name: entry.name,
    path: normalizePath(entry.path),
    kind,
    size: Number.isFinite(entry.size) ? entry.size : undefined,
    sha: entry.sha || undefined,
    url: entry.htmlUrl || undefined,
    parentId,
    hasChildren: kind === 'dir',
  };
}

export function makeRepositoryNode(owner, repo, ref) {
  return {
    id: repositoryRootId(owner, repo),
    name: repo,
    path: '',
    kind: 'repo',
    parentId: undefined,
    hasChildren: true,
    url: `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}${ref ? `/tree/${encodeURIComponent(ref)}` : ''}`,
  };
}
