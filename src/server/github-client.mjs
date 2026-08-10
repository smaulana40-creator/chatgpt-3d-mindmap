const API_ROOT = 'https://api.github.com';

function requiredSegment(value, label) {
  const clean = String(value ?? '').trim().replace(/^\/+|\/+$/g, '');
  if (!clean) throw new Error(`${label} is required`);
  return clean;
}

function encodedPath(path = '') {
  return String(path)
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
}

function normalizeEntry(entry) {
  return {
    name: entry.name,
    path: entry.path,
    type: entry.type === 'dir' ? 'dir' : 'file',
    size: Number.isFinite(entry.size) ? entry.size : 0,
    sha: entry.sha,
    htmlUrl: entry.html_url,
  };
}

export function createGitHubClient(fetchImpl = globalThis.fetch, token = process.env.GITHUB_TOKEN ?? '') {
  if (typeof fetchImpl !== 'function') throw new Error('fetch implementation is required');

  return {
    async listDirectory({ owner, repo, path = '', ref } = {}) {
      const cleanOwner = requiredSegment(owner, 'owner');
      const cleanRepo = requiredSegment(repo, 'repo');
      const suffix = encodedPath(path);
      const url = new URL(
        `${API_ROOT}/repos/${encodeURIComponent(cleanOwner)}/${encodeURIComponent(cleanRepo)}/contents${suffix ? `/${suffix}` : ''}`,
      );
      if (ref) url.searchParams.set('ref', ref);

      const headers = {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'chatgpt-3d-mindmap',
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetchImpl(url, { headers });

      if (response.status === 404) {
        throw new Error('GitHub repository, ref, or path not found.');
      }
      if (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') {
        throw new Error('GitHub API rate limit reached. Set GITHUB_TOKEN or retry after the rate limit resets.');
      }
      if (response.status === 401 || response.status === 403) {
        throw new Error('GitHub access denied. Set GITHUB_TOKEN for private repositories and verify token permissions.');
      }
      if (!response.ok) {
        let detail = '';
        try {
          const body = await response.json();
          detail = body?.message ? ` ${body.message}` : '';
        } catch {
          // Preserve the status-only error if GitHub returned a non-JSON body.
        }
        throw new Error(`GitHub API request failed (${response.status}).${detail}`);
      }

      const body = await response.json();
      if (!Array.isArray(body)) {
        throw new Error('Requested GitHub path is not a directory.');
      }

      return body.map(normalizeEntry);
    },
  };
}
