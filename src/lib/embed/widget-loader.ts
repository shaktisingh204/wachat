/**
 * Build a stringified JS loader snippet end-users paste into their site.
 *
 * The emitted script appends `<script src="/embed/widget.js" data-sabnode-id="…">`
 * so we can update the actual loader logic on our domain without forcing
 * customers to re-paste the snippet.
 */

import type { WidgetConfig } from './types';

export interface BuildLoaderOptions {
  /** Base URL of the SabNode app, e.g. "https://app.sabnode.com". No trailing slash. */
  baseUrl: string;
  /** Loader script path (default `/embed/widget.js`). */
  loaderPath?: string;
  /** Whether to mark the loader async (default true). */
  async?: boolean;
}

function escapeForScriptTag(value: string): string {
  // Strip anything that could break out of the embedded script context.
  return value
    .replace(/<\/(script)/gi, '<\\/$1')
    .replace(/<!--/g, '<\\!--')
    .replace(/"/g, '\\"');
}

/**
 * Render the JS snippet your customers paste into their site `<head>`.
 *
 * The snippet is intentionally tiny so it can be inlined; the heavy lifting
 * lives in `/public/embed/widget.js`.
 */
export function buildLoaderScript(
  config: WidgetConfig,
  options: BuildLoaderOptions,
): string {
  if (!config.id) throw new Error('buildLoaderScript: config.id required');
  if (!options.baseUrl) {
    throw new Error('buildLoaderScript: baseUrl required');
  }

  const base = options.baseUrl.replace(/\/$/, '');
  const loader = options.loaderPath ?? '/embed/widget.js';
  const async = options.async !== false;
  const id = escapeForScriptTag(config.id);
  const src = escapeForScriptTag(`${base}${loader}`);
  const locale = config.locale
    ? escapeForScriptTag(config.locale)
    : undefined;

  // The snippet uses a self-executing function so it can't pollute the host's
  // global scope, and it guards against double-injection.
  return [
    '(function(){',
    '  if (window.__SABNODE_EMBED__) return;',
    '  window.__SABNODE_EMBED__ = true;',
    '  var s = document.createElement("script");',
    `  s.src = "${src}";`,
    `  s.async = ${async ? 'true' : 'false'};`,
    `  s.setAttribute("data-sabnode-id", "${id}");`,
    locale ? `  s.setAttribute("data-sabnode-locale", "${locale}");` : '',
    '  s.setAttribute("data-sabnode-origin", window.location.origin);',
    '  (document.head || document.documentElement).appendChild(s);',
    '})();',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Wrap {@link buildLoaderScript} output in `<script>` tags for direct paste. */
export function buildLoaderHtml(
  config: WidgetConfig,
  options: BuildLoaderOptions,
): string {
  return `<script>${buildLoaderScript(config, options)}</script>`;
}
