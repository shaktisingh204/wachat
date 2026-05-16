/**
 * Forge block: XML Output Parser
 *
 * Parse LLM output as XML and return a plain-JS object. Tiny hand-rolled
 * recursive descent parser — enough for LLM "give me <answer><items>..." style
 * outputs without pulling in a dependency. Attributes are exposed as `@attr`
 * keys; repeated children collapse into arrays.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

type XmlNode = string | { [k: string]: unknown };

class Parser {
  pos = 0;
  constructor(public src: string) {}
  peek(): string {
    return this.src[this.pos] ?? '';
  }
  consume(s: string): boolean {
    if (this.src.startsWith(s, this.pos)) {
      this.pos += s.length;
      return true;
    }
    return false;
  }
  skipWs(): void {
    while (/\s/.test(this.peek())) this.pos++;
  }
  readUntil(stop: string): string {
    const idx = this.src.indexOf(stop, this.pos);
    if (idx === -1) {
      const rest = this.src.slice(this.pos);
      this.pos = this.src.length;
      return rest;
    }
    const out = this.src.slice(this.pos, idx);
    this.pos = idx;
    return out;
  }
  parseDoc(): XmlNode {
    this.skipProlog();
    this.skipWs();
    return this.parseElement();
  }
  skipProlog(): void {
    this.skipWs();
    if (this.consume('<?')) {
      this.readUntil('?>');
      this.consume('?>');
    }
    while (this.consume('<!--')) {
      this.readUntil('-->');
      this.consume('-->');
      this.skipWs();
    }
  }
  parseElement(): XmlNode {
    if (!this.consume('<')) throw new Error(`XML Parser: expected '<' at ${this.pos}`);
    const tagMatch = /^([A-Za-z_][\w.:-]*)/.exec(this.src.slice(this.pos));
    if (!tagMatch) throw new Error(`XML Parser: bad tag at ${this.pos}`);
    const tag = tagMatch[1];
    this.pos += tag.length;
    const attrs: Record<string, string> = {};
    while (true) {
      this.skipWs();
      if (this.consume('/>')) {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(attrs)) out[`@${k}`] = v;
        return { [tag]: out };
      }
      if (this.consume('>')) break;
      const am = /^([A-Za-z_][\w.:-]*)\s*=\s*"([^"]*)"/.exec(this.src.slice(this.pos));
      if (!am) throw new Error(`XML Parser: bad attribute at ${this.pos}`);
      attrs[am[1]] = am[2];
      this.pos += am[0].length;
    }
    const children: XmlNode[] = [];
    let textBuf = '';
    while (this.pos < this.src.length) {
      if (this.consume(`</${tag}>`)) {
        if (textBuf.trim() && children.length === 0) {
          const obj: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(attrs)) obj[`@${k}`] = v;
          obj['#text'] = textBuf.trim();
          if (Object.keys(attrs).length === 0) return { [tag]: textBuf.trim() };
          return { [tag]: obj };
        }
        const merged: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(attrs)) merged[`@${k}`] = v;
        for (const c of children) {
          if (typeof c === 'string') continue;
          for (const [k, v] of Object.entries(c)) {
            if (merged[k] === undefined) merged[k] = v;
            else if (Array.isArray(merged[k])) (merged[k] as unknown[]).push(v);
            else merged[k] = [merged[k], v];
          }
        }
        if (textBuf.trim()) merged['#text'] = textBuf.trim();
        return { [tag]: merged };
      }
      if (this.peek() === '<') {
        children.push(this.parseElement());
      } else {
        textBuf += this.src[this.pos];
        this.pos++;
      }
    }
    throw new Error(`XML Parser: unexpected EOF in <${tag}>`);
  }
}

async function run(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const text = asString(ctx.options.text);
  if (!text) throw new Error('XML Parser: text is required');
  const p = new Parser(text.trim());
  const data = p.parseDoc();
  return { outputs: { data }, logs: ['XML Parser → ok'] };
}

const block: ForgeBlock = {
  id: 'forge_output_parser_xml',
  name: 'Output Parser (XML)',
  description: 'Parse XML text into a JS object with attributes prefixed `@` and `#text` for inner content.',
  iconName: 'LuFileCode2',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'parse',
      label: 'Parse XML',
      fields: [{ id: 'text', label: 'XML text', type: 'textarea', required: true }],
      run,
    },
  ],
};

registerForgeBlock(block);
export default block;
