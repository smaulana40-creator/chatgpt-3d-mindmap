import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WIDGET_RESOURCE_URI,
  WIDGET_MIME_TYPE,
  buildWidgetHtml,
  WIDGET_RESOURCE_META,
} from '../src/server/widget-resource.mjs';

test('widget resource constants follow MCP Apps conventions', () => {
  assert.equal(WIDGET_RESOURCE_URI, 'ui://github-3d-mindmap/v1.html');
  assert.equal(WIDGET_MIME_TYPE, 'text/html;profile=mcp-app');
  assert.deepEqual(WIDGET_RESOURCE_META.ui.csp.resourceDomains, ['https://esm.sh']);
});

test('buildWidgetHtml embeds the exact graph state and interactive app scripts', async () => {
  const html = await buildWidgetHtml();
  assert.match(html, /<!doctype html>/i);
  assert.match(html, /(?:globalThis|global)\.GraphState/);
  assert.match(html, /3d-force-graph/);
  assert.match(html, /@modelcontextprotocol\/ext-apps/);
  assert.match(html, /expand_repository_node/);
  assert.match(html, /id="graph"/);
  assert.match(html, /id="inspector"/);
});
