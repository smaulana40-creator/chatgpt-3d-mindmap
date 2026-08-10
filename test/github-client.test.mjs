import test from 'node:test';
import assert from 'node:assert/strict';

import { createGitHubClient } from '../src/server/github-client.mjs';

function jsonResponse(body, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

test('listDirectory builds encoded Contents API URL and normalizes entries', async () => {
  let seenUrl;
  let seenInit;
  const fetchImpl = async (url, init) => {
    seenUrl = String(url);
    seenInit = init;
    return jsonResponse([
      {
        name: 'My File.md',
        path: 'docs/My File.md',
        type: 'file',
        size: 42,
        sha: 'abc123',
        html_url: 'https://github.com/acme/demo/blob/dev/docs/My%20File.md',
      },
      {
        name: 'src',
        path: 'docs/src',
        type: 'dir',
        size: 0,
        sha: 'dirsha',
        html_url: 'https://github.com/acme/demo/tree/dev/docs/src',
      },
    ]);
  };

  const client = createGitHubClient(fetchImpl, 'secret-token');
  const entries = await client.listDirectory({
    owner: 'acme org',
    repo: 'demo repo',
    path: 'docs/My Folder',
    ref: 'feature/test',
  });

  const url = new URL(seenUrl);
  assert.equal(url.pathname, '/repos/acme%20org/demo%20repo/contents/docs/My%20Folder');
  assert.equal(url.searchParams.get('ref'), 'feature/test');
  assert.equal(seenInit.headers.Authorization, 'Bearer secret-token');
  assert.equal(seenInit.headers.Accept, 'application/vnd.github+json');
  assert.deepEqual(entries[0], {
    name: 'My File.md',
    path: 'docs/My File.md',
    type: 'file',
    size: 42,
    sha: 'abc123',
    htmlUrl: 'https://github.com/acme/demo/blob/dev/docs/My%20File.md',
  });
  assert.equal(entries[1].type, 'dir');
});

test('listDirectory omits Authorization when token is empty', async () => {
  let seenInit;
  const fetchImpl = async (_url, init) => {
    seenInit = init;
    return jsonResponse([]);
  };
  const client = createGitHubClient(fetchImpl, '');
  await client.listDirectory({ owner: 'acme', repo: 'demo', path: '' });
  assert.equal('Authorization' in seenInit.headers, false);
});

test('listDirectory converts 404 into a useful error', async () => {
  const client = createGitHubClient(async () => jsonResponse({ message: 'Not Found' }, { status: 404 }));
  await assert.rejects(
    () => client.listDirectory({ owner: 'acme', repo: 'missing', path: '' }),
    /repository, ref, or path not found/i,
  );
});

test('listDirectory distinguishes rate limits from access denied', async () => {
  const rateLimited = createGitHubClient(async () => jsonResponse(
    { message: 'API rate limit exceeded' },
    { status: 403, headers: { 'x-ratelimit-remaining': '0' } },
  ));
  await assert.rejects(
    () => rateLimited.listDirectory({ owner: 'acme', repo: 'demo', path: '' }),
    /rate limit/i,
  );

  const denied = createGitHubClient(async () => jsonResponse({ message: 'Forbidden' }, { status: 403 }));
  await assert.rejects(
    () => denied.listDirectory({ owner: 'acme', repo: 'private', path: '' }),
    /access denied/i,
  );
});

test('listDirectory rejects file-shaped API responses', async () => {
  const client = createGitHubClient(async () => jsonResponse({ type: 'file', name: 'a.js' }));
  await assert.rejects(
    () => client.listDirectory({ owner: 'acme', repo: 'demo', path: 'a.js' }),
    /not a directory/i,
  );
});
