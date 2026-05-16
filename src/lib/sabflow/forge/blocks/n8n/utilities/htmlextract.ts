/**
 * Forge block: HTML Extract
 *
 * Source: n8n-master/packages/nodes-base/nodes/HtmlExtract/HtmlExtract.node.ts
 *
 * The original n8n node uses `cheerio`, which is **not** installed in this
 * project. We mirror the W11 `tools/html.ts` regex-based extractor here so the
 * legacy "HtmlExtract" block id is still available — supports simple selectors
 * (`tag`, `.class`, `#id`).
 *
 * Operations covered:
 *   - extract-text  — return inner text of first match
 *   - extract-attr  — return an attribute value of first match
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

// ── Minimal selector engine (mirrors tools/html.ts) ───────────────────────

type Sel = { tag?: string; id?: string; class?: string };

function parseSelector(raw: string): Sel {
  const s = raw.trim();
  if (!s) throw new Error('HtmlExtract: selector is required');
  const idMatch = s.match(/#([\w-]+)/);
  const classMatch = s.match(/\.([\w-]+)/);
  const tagMatch = s.match(/^([a-zA-Z][\w-]*)/);
  return {
    tag: tagMatch ? tagMatch[1].toLowerCase() : undefined,
    id: idMatch ? idMatch[1] : undefined,
    class: classMatch ? classMatch[1] : undefined,
  };
}

type Match = { tag: string; attrs: string; inner: string };

function findFirstMatch(html: string, sel: Sel): Match | null {
  const tag = sel.tag ?? '[a-zA-Z][\\w-]*';
  const re = new RegExp(`<(${tag})\\b([^>]*)>([\\s\\S]*?)<\\/\\1>`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const [, name, attrs, inner] = m;
    if (sel.id) {
      const idRe = /\bid\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i;
      const idHit = idRe.exec(attrs);
      const idVal = idHit?.[2] ?? idHit?.[3] ?? idHit?.[4] ?? '';
      if (idVal !== sel.id) continue;
    }
    if (sel.class) {
      const clRe = /\bclass\s*=\s*("([^"]*)"|'([^']*)')/i;
      const clHit = clRe.exec(attrs);
      const list = (clHit?.[2] ?? clHit?.[3] ?? '').split(/\s+/);
      if (!list.includes(sel.class)) continue;
    }
    return { tag: name, attrs, inner };
  }
  return null;
}

function getAttribute(attrs: string, name: string): string | null {
  const re = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const m = re.exec(attrs);
  if (!m) return null;
  return m[2] ?? m[3] ?? m[4] ?? null;
}

function stripTagsText(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

async function extractText(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const html = asString(ctx.options.html);
  const selector = asString(ctx.options.selector);
  if (!html) throw new Error('HtmlExtract: html is required');
  if (!selector) throw new Error('HtmlExtract: selector is required');
  const sel = parseSelector(selector);
  const hit = findFirstMatch(html, sel);
  const text = hit ? stripTagsText(hit.inner) : '';
  return { outputs: { text, found: !!hit }, logs: [`HtmlExtract extract-text → ${selector}`] };
}

async function extractAttr(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const html = asString(ctx.options.html);
  const selector = asString(ctx.options.selector);
  const attribute = asString(ctx.options.attribute);
  if (!html) throw new Error('HtmlExtract: html is required');
  if (!selector) throw new Error('HtmlExtract: selector is required');
  if (!attribute) throw new Error('HtmlExtract: attribute is required');
  const sel = parseSelector(selector);
  const hit = findFirstMatch(html, sel);
  const value = hit ? getAttribute(hit.attrs, attribute) : null;
  return { outputs: { value, found: !!hit }, logs: [`HtmlExtract extract-attr → ${selector}@${attribute}`] };
}

const block: ForgeBlock = {
  id: 'forge_htmlextract',
  name: 'HTML Extract',
  description: 'Extract text or attributes from HTML by simple selector.',
  iconName: 'LuCode',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'extract_text',
      label: 'Extract text',
      description: 'Return the inner text of the first element matching the selector.',
      fields: [
        { id: 'html', label: 'HTML source', type: 'textarea', required: true },
        {
          id: 'selector',
          label: 'Selector',
          type: 'text',
          required: true,
          placeholder: 'h1, .title or #header',
          helperText: 'Simple selector: tag, .class, or #id (or combination).',
        },
      ],
      run: extractText,
    },
    {
      id: 'extract_attr',
      label: 'Extract attribute',
      description: 'Return an attribute value from the first matching element.',
      fields: [
        { id: 'html', label: 'HTML source', type: 'textarea', required: true },
        { id: 'selector', label: 'Selector', type: 'text', required: true, placeholder: 'a, .link, #cta' },
        { id: 'attribute', label: 'Attribute', type: 'text', required: true, placeholder: 'href' },
      ],
      run: extractAttr,
    },
  ],
};

registerForgeBlock(block);
export default block;
