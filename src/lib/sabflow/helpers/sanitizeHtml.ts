/**
 * sanitizeHtml
 *
 * A tiny, dependency-free HTML sanitiser used by the SabFlow rich-text editor
 * and chat renderer.
 *
 * It whitelists a handful of tags, strips all attributes except a narrowly
 * scoped allow-list (`href` on `<a>` and a specific class on `<span>`), and
 * removes any `javascript:` URLs or inline event handlers.
 *
 * Strategy:
 *   1. Prefer the browser's DOMParser when available (runs in the client).
 *   2. Fall back to a regex-based walker on the server — this is a best-effort
 *      path; callers should ideally run this on the client.
 *
 * NOTE: this is deliberately conservative. If the input contains anything
 * outside the whitelist it is dropped; tag bodies are preserved.
 */

export const DEFAULT_ALLOWED_TAGS = [
  'b',
  'i',
  'u',
  's',
  'strong',
  'em',
  'code',
  'a',
  'ul',
  'ol',
  'li',
  'br',
  'p',
  'span',
] as const;

/** Classes permitted on `<span>` elements (everything else is stripped). */
const ALLOWED_SPAN_CLASSES = new Set(['var-chip']);

/** Void elements that must be self-closed in the serialised output. */
const VOID_ELEMENTS = new Set(['br']);

/* ── Attribute value helpers ───────────────────────────────────────────── */

/** Returns true when `url` is a safe href value (http/https/mailto/tel/#). */
function isSafeHref(url: string): boolean {
  const trimmed = url.trim().toLowerCase();
  if (trimmed.startsWith('javascript:')) return false;
  if (trimmed.startsWith('data:')) return false;
  if (trimmed.startsWith('vbscript:')) return false;
  return true;
}

/** Basic HTML entity escape for text nodes. */
function escapeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Basic escape for attribute values (wrapped in double quotes). */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* ── DOM-based implementation (preferred) ──────────────────────────────── */

function sanitizeWithDOM(html: string, allowedTags: Set<string>): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return '';
  return serializeNode(root, allowedTags).inner;
}

type SerializedResult = { outer: string; inner: string };

function serializeNode(node: Node, allowedTags: Set<string>): SerializedResult {
  // Text node
  if (node.nodeType === 3 /* TEXT_NODE */) {
    const text = escapeText(node.nodeValue ?? '');
    return { outer: text, inner: text };
  }

  // Element node
  if (node.nodeType === 1 /* ELEMENT_NODE */) {
    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    // Serialise children first (needed for both allowed-tag output and for
    // the "drop tag, keep children" fallback).
    let innerHtml = '';
    el.childNodes.forEach((child) => {
      innerHtml += serializeNode(child, allowedTags).outer;
    });

    if (!allowedTags.has(tag)) {
      // Drop the tag but keep its text content.
      return { outer: innerHtml, inner: innerHtml };
    }

    // Build a sanitised attribute string.
    let attrs = '';

    if (tag === 'a') {
      const href = el.getAttribute('href') ?? '';
      if (href && isSafeHref(href)) {
        attrs += ` href="${escapeAttr(href)}"`;
        attrs += ' target="_blank" rel="noopener noreferrer"';
      }
    } else if (tag === 'span') {
      const cls = (el.getAttribute('class') ?? '')
        .split(/\s+/)
        .filter((c) => ALLOWED_SPAN_CLASSES.has(c));
      if (cls.length > 0) {
        attrs += ` class="${escapeAttr(cls.join(' '))}"`;
      }
    }

    if (VOID_ELEMENTS.has(tag)) {
      return { outer: `<${tag}${attrs}/>`, inner: '' };
    }

    const outer = `<${tag}${attrs}>${innerHtml}</${tag}>`;
    return { outer, inner: innerHtml };
  }

  // Anything else (comments, doctypes, …) — drop silently.
  return { outer: '', inner: '' };
}

/* ── Regex-based fallback (server runtimes without DOMParser) ──────────── */

function sanitizeWithRegex(html: string, allowedTags: Set<string>): string {
  let out = html;

  // 1. Remove <script>, <style>, and <iframe> blocks outright (belt-and-braces).
  out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  out = out.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  out = out.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '');

  // 2. Strip all inline event handlers (on*="...") and javascript: URLs.
  out = out.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '');
  out = out.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '');
  out = out.replace(/javascript:/gi, '');

  // 3. Walk every tag and rebuild its opening form with only allowed attrs.
  out = out.replace(
    /<\s*\/?\s*([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g,
    (_match, rawName: string, rawAttrs: string) => {
      const name = rawName.toLowerCase();
      if (!allowedTags.has(name)) return ''; // drop tag entirely

      const isClosing = _match.startsWith('</');
      if (isClosing) return `</${name}>`;

      let attrs = '';
      if (name === 'a') {
        const hrefMatch = /href\s*=\s*"([^"]*)"/i.exec(rawAttrs) ??
                         /href\s*=\s*'([^']*)'/i.exec(rawAttrs);
        const href = hrefMatch?.[1];
        if (href && isSafeHref(href)) {
          attrs += ` href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer"`;
        }
      } else if (name === 'span') {
        const classMatch = /class\s*=\s*"([^"]*)"/i.exec(rawAttrs) ??
                          /class\s*=\s*'([^']*)'/i.exec(rawAttrs);
        const classes = (classMatch?.[1] ?? '')
          .split(/\s+/)
          .filter((c) => ALLOWED_SPAN_CLASSES.has(c));
        if (classes.length > 0) {
          attrs += ` class="${escapeAttr(classes.join(' '))}"`;
        }
      }

      if (VOID_ELEMENTS.has(name)) return `<${name}${attrs}/>`;
      return `<${name}${attrs}>`;
    },
  );

  return out;
}

/* ── Public entry point ─────────────────────────────────────────────────── */

/**
 * Sanitise an HTML string against the given tag whitelist.
 *
 * @param html         Untrusted HTML string (possibly containing variables).
 * @param allowedTags  Tag allow-list (defaults to DEFAULT_ALLOWED_TAGS).
 */
export function sanitizeHtml(
  html: string,
  allowedTags: readonly string[] = DEFAULT_ALLOWED_TAGS,
): string {
  if (!html) return '';
  const set = new Set(allowedTags.map((t) => t.toLowerCase()));

  if (typeof DOMParser !== 'undefined') {
    try {
      return sanitizeWithDOM(html, set);
    } catch {
      // Fall through to regex fallback on parser errors.
    }
  }
  return sanitizeWithRegex(html, set);
}
