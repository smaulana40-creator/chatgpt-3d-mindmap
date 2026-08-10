# ChatGPT 3D Mind Map

A read-only ChatGPT MCP App that turns a GitHub repository into an interactive 3D knowledge graph. Rotate, zoom and drag the graph; click a directory to lazy-load one level of children; click it again to collapse the branch while keeping the data cached.

## What the MVP does

- Loads a GitHub repository root through the GitHub Contents API.
- Renders repository, directory and file nodes in a 3D force-directed graph.
- Lazy-loads only the directory you click, one level at a time.
- Keeps loaded descendants cached when a branch is collapsed.
- Shows a node inspector with path, SHA, size and expansion state.
- Supports camera focus, fit-to-graph and fullscreen requests.
- Keeps `GITHUB_TOKEN` on the MCP server. The iframe never receives the token.
- Uses the MCP Apps UI resource MIME type `text/html;profile=mcp-app`.

The UI uses `3d-force-graph` and the MCP Apps browser SDK from `esm.sh`. The MCP server uses the official MCP TypeScript SDK packages from JavaScript/ESM, so there is no frontend build step in this MVP.

## Architecture

```text
ChatGPT
  │
  │ Streamable HTTP / MCP Apps
  ▼
GitHub 3D Mind Map MCP server
  ├─ get_repository_root        model-visible data tool
  ├─ expand_repository_node     app-only lazy loading tool
  └─ render_repository_graph    UI render tool
             │
             ▼
      sandboxed MCP App iframe
      ├─ 3d-force-graph / WebGL
      ├─ inspector panel
      └─ cached expand/collapse state
             │
             └─ tools/call → expand_repository_node

MCP server ── server-side GITHUB_TOKEN ──► GitHub Contents API
```

## Requirements

- Node.js 20+; Node 22 recommended.
- An HTTPS URL reachable by ChatGPT for remote testing, or OpenAI Secure MCP Tunnel.
- `GITHUB_TOKEN` for private repositories. Public repositories can work without a token, but authenticated requests have better rate limits.

For a fine-grained GitHub personal access token, grant only the repository access you need and read-only **Contents** permission. Never commit the token.

## Install

```bash
cp .env.example .env
# edit .env and set GITHUB_TOKEN if needed
npm install
```

Node does not automatically load `.env`, so either export the variables in your shell or use your deployment platform's environment settings:

```bash
export GITHUB_TOKEN='github_pat_...'
export PORT=3001
npm start
```

The MCP endpoint is:

```text
http://localhost:3001/mcp
```

Health check:

```text
http://localhost:3001/health
```

## Test

Core logic uses the Node built-in test runner, so it can be tested independently of the MCP packages:

```bash
npm test
npm run build
```

`npm run build` is intentionally a syntax/consistency check in this dependency-light MVP; the UI is emitted as a self-contained MCP HTML resource at runtime.

To inspect the live MCP server after installing dependencies:

```bash
npx @modelcontextprotocol/inspector@latest
```

Then connect the inspector to `http://localhost:3001/mcp`.

## Connect it to ChatGPT

OpenAI's current plugin flow requires a reachable HTTPS Streamable HTTP endpoint, normally ending in `/mcp`.

1. Deploy this server to an HTTPS host or expose it through OpenAI Secure MCP Tunnel for development.
2. In ChatGPT, open **Settings**.
3. Open **Security and login** and enable **Developer mode**.
4. Go to **ChatGPT Plugins** and press **+**.
5. Enter a name such as `GitHub 3D Mind Map`.
6. Under **Connection**, enter your HTTPS MCP endpoint, including `/mcp`.
7. Create the connection and review the three discovered tools.
8. Start a new conversation and add the connection from the tools menu.

Official references:

- https://developers.openai.com/plugins/deploy/connect-chatgpt
- https://developers.openai.com/plugins/build/mcp-server
- https://developers.openai.com/plugins/build/chatgpt-ui

## Try it

For a public repository:

```text
Visualize vasturiano/3d-force-graph as a 3D repository mind map.
```

For your own repository:

```text
Visualize smaulana40-creator/NortHermes as a 3D repository mind map.
```

The intended model flow is:

1. `get_repository_root`
2. `render_repository_graph` using the first tool's `structuredContent`
3. User clicks directory nodes; the iframe calls `expand_repository_node` directly.

## GitHub API behavior

The server calls:

```text
GET /repos/{owner}/{repo}/contents/{path}?ref={ref}
```

Only direct directory children are requested. The entire repository is never recursively downloaded by the MVP.

Private repository access is controlled exclusively by `GITHUB_TOKEN` on the server. The token is not returned in MCP tool output, `structuredContent`, or UI data.

## Docker

```bash
docker build -t chatgpt-3d-mindmap .
docker run --rm \
  -p 3001:3001 \
  -e GITHUB_TOKEN='github_pat_...' \
  chatgpt-3d-mindmap
```

## Create the new GitHub repository

This project is deliberately independent of any existing repository. After creating an empty repository named `chatgpt-3d-mindmap` in GitHub, from this directory run:

```bash
git remote add origin git@github.com:YOUR_GITHUB_USERNAME/chatgpt-3d-mindmap.git
git push -u origin main
```

Or, if GitHub CLI is available:

```bash
gh repo create chatgpt-3d-mindmap --private --source=. --remote=origin --push
```

## Current MVP limitations

- Repository file/folder structure only; it does not yet parse code dependencies or import graphs.
- No GitHub OAuth UI yet; private repositories use a server environment token.
- Layout is session-local and is not persisted between ChatGPT renders.
- UI JS libraries are loaded from `https://esm.sh`, declared in the MCP resource CSP.
- Read-only by design. It never modifies GitHub content.

## Next upgrades

The natural next layer is a semantic/code graph: imports, function calls, symbols, commits and PRs as separate relation types, plus search and GraphRAG. The current lazy graph/cache model is already structured so those can be added without replacing the 3D renderer.
