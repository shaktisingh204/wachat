/**
 * Forge block: XML
 *
 * Source: n8n-master/packages/nodes-base/nodes/Xml/Xml.node.ts
 * Credential: none — local string processing.
 *
 * IMPORTANT: n8n's XML node uses `xml2js` (not installed here). To avoid a
 * runtime dependency this port ships a small hand-rolled converter that
 * follows the same key conventions as xml2js's `explicitArray:false` mode:
 *
 *   - element children become nested objects
 *   - repeated children at the same level become arrays
 *   - attributes are placed under `$` (matching xml2js default `attrkey`)
 *   - text content is placed under `_`
 *
 * Limitations (defer to `xml2js` install when these matter):
 *   - no namespace expansion (xmlns prefixes are kept as-is)
 *   - no CDATA detection (CDATA text is preserved verbatim)
 *   - no DOCTYPE / PI parsing beyond skipping the declaration
 *   - input is assumed to be well-formed; partial recovery is best-effort
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

// ── XML → JSON ─────────────────────────────────────────────────────────────

type XmlNode = { name: string; attrs: Record<string, string>; children: XmlNode[]; text: string };

function unescape(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&');
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseXml(input: string): XmlNode {
  let i = 0;
  const src = input.replace(/<\?xml[\s\S]*?\?>/, '').replace(/<!--[\s\S]*?-->/g, '');

  function readUntil(ch: string): string {
    let out = '';
    while (i < src.length && src[i] !== ch) out += src[i++];
    return out;
  }
  function parseAttrs(s: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    const re = /([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) attrs[m[1]] = unescape(m[3] ?? m[4] ?? '');
    return attrs;
  }
  function parseNode(): XmlNode {
    if (src[i] !== '<') throw new Error('XML: expected `<` at position ' + i);
    i++;
    const tagBody = readUntil('>');
    i++; // consume '>'
    const selfClosing = tagBody.endsWith('/');
    const body = selfClosing ? tagBody.slice(0, -1).trim() : tagBody.trim();
    const space = body.search(/\s/);
    const name = (space === -1 ? body : body.slice(0, space)).trim();
    const attrs = space === -1 ? {} : parseAttrs(body.slice(space + 1));
    const node: XmlNode = { name, attrs, children: [], text: '' };
    if (selfClosing) return node;

    while (i < src.length) {
      if (src[i] === '<') {
        if (src[i + 1] === '/') {
          // closing tag — consume up to '>'
          while (i < src.length && src[i] !== '>') i++;
          i++; // consume '>'
          return node;
        }
        node.children.push(parseNode());
      } else {
        const t = readUntil('<');
        const trimmed = unescape(t).trim();
        if (trimmed) node.text += (node.text ? ' ' : '') + trimmed;
      }
    }
    return node;
  }

  // Find first '<' to start.
  while (i < src.length && src[i] !== '<') i++;
  if (i >= src.length) throw new Error('XML: no root element found');
  return parseNode();
}

function nodeToJson(node: XmlNode): unknown {
  const hasAttrs = Object.keys(node.attrs).length > 0;
  if (node.children.length === 0 && !hasAttrs) {
    return node.text;
  }
  const out: Record<string, unknown> = {};
  if (hasAttrs) out.$ = node.attrs;
  if (node.text) out._ = node.text;
  const grouped: Record<string, XmlNode[]> = {};
  for (const c of node.children) (grouped[c.name] ??= []).push(c);
  for (const [name, list] of Object.entries(grouped)) {
    if (list.length === 1) out[name] = nodeToJson(list[0]);
    else out[name] = list.map(nodeToJson);
  }
  return out;
}

// ── JSON → XML ─────────────────────────────────────────────────────────────

function jsonToXml(value: unknown, rootName = 'root'): string {
  function serialize(name: string, val: unknown): string {
    if (val === null || val === undefined) return `<${name}/>`;
    if (typeof val !== 'object') return `<${name}>${escape(String(val))}</${name}>`;
    if (Array.isArray(val)) return val.map((v) => serialize(name, v)).join('');
    const obj = val as Record<string, unknown>;
    const attrs: string[] = [];
    if (obj.$ && typeof obj.$ === 'object') {
      for (const [k, v] of Object.entries(obj.$ as Record<string, unknown>)) {
        attrs.push(`${k}="${escape(String(v))}"`);
      }
    }
    const text = typeof obj._ === 'string' ? escape(obj._) : '';
    const children: string[] = [];
    for (const [k, v] of Object.entries(obj)) {
      if (k === '$' || k === '_') continue;
      children.push(serialize(k, v));
    }
    const open = `<${name}${attrs.length ? ' ' + attrs.join(' ') : ''}>`;
    if (!text && children.length === 0) return `<${name}${attrs.length ? ' ' + attrs.join(' ') : ''}/>`;
    return `${open}${text}${children.join('')}</${name}>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>${serialize(rootName, value)}`;
}

// ── Actions ────────────────────────────────────────────────────────────────

async function xmlToJson(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const xml = asString(ctx.options.xml);
  if (!xml) throw new Error('XML: xml is required');
  const root = parseXml(xml);
  const json: Record<string, unknown> = { [root.name]: nodeToJson(root) };
  return { outputs: { json, rootName: root.name }, logs: [`XML→JSON → root <${root.name}>`] };
}

async function jsonToXmlAction(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const raw = asString(ctx.options.json);
  const rootName = asString(ctx.options.rootName) || 'root';
  if (!raw) throw new Error('XML: json is required');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('XML: json must be valid JSON');
  }
  // If user passed { root: {...} } take its first key as the root name.
  let value = parsed;
  let name = rootName;
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const keys = Object.keys(parsed as Record<string, unknown>);
    if (keys.length === 1 && rootName === 'root') {
      name = keys[0];
      value = (parsed as Record<string, unknown>)[name];
    }
  }
  const xml = jsonToXml(value, name);
  return { outputs: { xml, length: xml.length }, logs: [`JSON→XML → <${name}>`] };
}

// ── Block ─────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_xml',
  name: 'XML',
  description: 'Convert between XML and JSON (xml2js-compatible shape).',
  iconName: 'LuFileCode',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'xml_to_json',
      label: 'XML → JSON',
      description: 'Parse XML and return a JSON object using xml2js conventions ($/_).',
      fields: [
        { id: 'xml', label: 'XML source', type: 'textarea', required: true },
      ],
      run: xmlToJson,
    },
    {
      id: 'json_to_xml',
      label: 'JSON → XML',
      description: 'Serialise a JSON value into an XML document.',
      fields: [
        { id: 'json', label: 'JSON source', type: 'textarea', required: true },
        {
          id: 'rootName',
          label: 'Root element name',
          type: 'text',
          placeholder: 'root',
          helperText: 'Used when the JSON value has no single top-level key.',
        },
      ],
      run: jsonToXmlAction,
    },
  ],
};

registerForgeBlock(block);
export default block;
