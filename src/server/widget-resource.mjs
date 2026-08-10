import fs from 'node:fs/promises';

export const WIDGET_RESOURCE_URI = 'ui://github-3d-mindmap/v1.html';
export const WIDGET_MIME_TYPE = 'text/html;profile=mcp-app';
export const WIDGET_RESOURCE_META = Object.freeze({
  ui: {
    csp: {
      resourceDomains: ['https://esm.sh'],
    },
    prefersBorder: false,
  },
});

const widgetDir = new URL('../widget/', import.meta.url);

export async function buildWidgetHtml() {
  const [stateCore, appJs, css] = await Promise.all([
    fs.readFile(new URL('state-core.js', widgetDir), 'utf8'),
    fs.readFile(new URL('app.js', widgetDir), 'utf8'),
    fs.readFile(new URL('component.css', widgetDir), 'utf8'),
  ]);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>GitHub 3D Mind Map</title>
  <style>${css}</style>
</head>
<body>
  <main class="shell">
    <div id="graph" aria-label="Interactive 3D repository graph"></div>
    <div class="topbar">
      <div class="brand"><strong>GitHub 3D Mind Map</strong><span id="repo-label">Waiting for repository…</span></div>
      <div class="actions">
        <button class="icon-btn" id="reset-camera" title="Fit graph" aria-label="Fit graph">◎</button>
        <button class="icon-btn" id="fullscreen" title="Fullscreen" aria-label="Fullscreen">⛶</button>
      </div>
    </div>
    <aside class="inspector" id="inspector"><div class="empty">Select a node to inspect it.</div></aside>
    <div class="status" id="status">Waiting for repository graph…</div>
  </main>
  <script>${stateCore}</script>
  <script type="module">${appJs}</script>
</body>
</html>`;
}
