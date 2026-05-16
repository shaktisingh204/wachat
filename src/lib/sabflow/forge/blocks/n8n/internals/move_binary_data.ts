/**
 * Forge block: Move Binary Data
 *
 * Source: n8n-master/packages/nodes-base/nodes/MoveBinaryData/MoveBinaryData.node.ts
 * Credential type: none.
 *
 * Runtime: converts a payload between base64, hex and text encodings. The
 * original n8n node also juggles its binary-data slots (which SabFlow does
 * not model the same way) — this port restricts itself to the encoding
 * transform, which is the part most n8n flows actually use.
 *
 * SabFlow native equivalent: none — use this block for ad-hoc encoding.
 */
import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

type Encoding = 'base64' | 'hex' | 'text';

const ENCODINGS = new Set<Encoding>(['base64', 'hex', 'text']);

function decode(input: string, encoding: Encoding): Buffer {
  if (encoding === 'base64') return Buffer.from(input, 'base64');
  if (encoding === 'hex') return Buffer.from(input, 'hex');
  return Buffer.from(input, 'utf8');
}

function encode(buf: Buffer, encoding: Encoding): string {
  if (encoding === 'base64') return buf.toString('base64');
  if (encoding === 'hex') return buf.toString('hex');
  return buf.toString('utf8');
}

async function convert(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const input = asString(ctx.options.input);
  const from = asString(ctx.options.fromEncoding) as Encoding;
  const to = asString(ctx.options.toEncoding) as Encoding;
  if (!input) throw new Error('MoveBinaryData: input is required');
  if (!ENCODINGS.has(from)) throw new Error(`MoveBinaryData: unsupported fromEncoding "${from}"`);
  if (!ENCODINGS.has(to)) throw new Error(`MoveBinaryData: unsupported toEncoding "${to}"`);
  const buf = decode(input, from);
  const output = encode(buf, to);
  return {
    outputs: { output, length: buf.length },
    logs: [`MoveBinaryData convert → ${from} → ${to} (${buf.length} bytes)`],
  };
}

const ENCODING_OPTIONS = [
  { label: 'Base64', value: 'base64' },
  { label: 'Hex', value: 'hex' },
  { label: 'Text (UTF-8)', value: 'text' },
];

const block: ForgeBlock = {
  id: 'forge_move_binary_data',
  name: 'Move Binary Data',
  description: 'Convert a payload between base64, hex and text encodings.',
  iconName: 'LuFileCog',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'convert',
      label: 'Convert encoding',
      description: 'Re-encode a string between base64 / hex / text.',
      fields: [
        { id: 'input', label: 'Input', type: 'textarea', required: true },
        {
          id: 'fromEncoding',
          label: 'From',
          type: 'select',
          required: true,
          defaultValue: 'text',
          options: ENCODING_OPTIONS,
        },
        {
          id: 'toEncoding',
          label: 'To',
          type: 'select',
          required: true,
          defaultValue: 'base64',
          options: ENCODING_OPTIONS,
        },
      ],
      run: convert,
    },
  ],
};

registerForgeBlock(block);
export default block;
