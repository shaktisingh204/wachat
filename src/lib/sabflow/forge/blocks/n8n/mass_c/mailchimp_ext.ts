/**
 * Forge block: Mailchimp (extended actions)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Mailchimp/Mailchimp.node.ts
 *
 * API key like `xxxxxxxxxxxxxxxx-us21` — the suffix is the datacenter.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function base(ctx: ForgeActionContext): string {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Mailchimp: apiKey is required');
  const dc = apiKey.split('-')[1];
  if (!dc) throw new Error('Mailchimp: apiKey is missing datacenter suffix (e.g. -us21)');
  return `https://${dc}.api.mailchimp.com/3.0`;
}

function headers(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  return { Authorization: `Basic ${btoa(`anystring:${apiKey}`)}` };
}

async function campaignsList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Mailchimp',
    method: 'GET',
    url: `${base(ctx)}/campaigns`,
    headers: headers(ctx),
  });
  return { outputs: { campaigns: res.data }, logs: ['Mailchimp campaigns list'] };
}

async function campaignSend(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const campaignId = asString(ctx.options.campaignId);
  if (!campaignId) throw new Error('Mailchimp: campaignId is required');
  const res = await apiRequest({
    service: 'Mailchimp',
    method: 'POST',
    url: `${base(ctx)}/campaigns/${encodeURIComponent(campaignId)}/actions/send`,
    headers: headers(ctx),
  });
  return { outputs: { status: res.status }, logs: [`Mailchimp campaign send → ${campaignId}`] };
}

async function memberTagsUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const listId = asString(ctx.options.listId);
  const email = asString(ctx.options.email);
  const tags = asString(ctx.options.tags);
  if (!listId || !email || !tags) throw new Error('Mailchimp: listId, email and tags are required');
  const hash = await sha256LowerHex(email.toLowerCase());
  const list = tags.split(',').map((t) => ({ name: t.trim(), status: 'active' }));
  const res = await apiRequest({
    service: 'Mailchimp',
    method: 'POST',
    url: `${base(ctx)}/lists/${encodeURIComponent(listId)}/members/${hash}/tags`,
    headers: headers(ctx),
    json: { tags: list },
  });
  return { outputs: { status: res.status }, logs: [`Mailchimp tags → ${email}`] };
}

async function memberUnsubscribe(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const listId = asString(ctx.options.listId);
  const email = asString(ctx.options.email);
  if (!listId || !email) throw new Error('Mailchimp: listId and email are required');
  const hash = await sha256LowerHex(email.toLowerCase());
  const res = await apiRequest({
    service: 'Mailchimp',
    method: 'PATCH',
    url: `${base(ctx)}/lists/${encodeURIComponent(listId)}/members/${hash}`,
    headers: headers(ctx),
    json: { status: 'unsubscribed' },
  });
  return { outputs: { member: res.data }, logs: [`Mailchimp unsubscribe → ${email}`] };
}

// MD5 hash needed but we use webcrypto sha256 not available; use md5 via node:crypto.
// Edge runtimes don't expose node:crypto, so emulate the lowercase md5 with a lightweight
// implementation. To keep this file slim we instead require email already lowercased and
// rely on the legacy "email_address" path where possible. Mailchimp's tags endpoint requires
// MD5 of the lowercase email — implement a small one.
async function sha256LowerHex(s: string): Promise<string> {
  // Mailchimp wants MD5 (legacy). Use a minimal MD5 implementation to stay portable.
  return md5(s);
}

// Minimal MD5 implementation (RFC 1321). Returns lowercase hex.
function md5(input: string): string {
  function toBytes(str: string): number[] {
    const out: number[] = [];
    for (let i = 0; i < str.length; i++) {
      let c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) {
        out.push(0xc0 | (c >> 6));
        out.push(0x80 | (c & 0x3f));
      } else if ((c & 0xfc00) !== 0xd800) {
        out.push(0xe0 | (c >> 12));
        out.push(0x80 | ((c >> 6) & 0x3f));
        out.push(0x80 | (c & 0x3f));
      } else {
        const next = str.charCodeAt(++i);
        c = 0x10000 + (((c & 0x3ff) << 10) | (next & 0x3ff));
        out.push(0xf0 | (c >> 18));
        out.push(0x80 | ((c >> 12) & 0x3f));
        out.push(0x80 | ((c >> 6) & 0x3f));
        out.push(0x80 | (c & 0x3f));
      }
    }
    return out;
  }
  const msg = toBytes(input);
  const origLen = msg.length;
  msg.push(0x80);
  while (msg.length % 64 !== 56) msg.push(0);
  const bitLen = origLen * 8;
  for (let i = 0; i < 8; i++) msg.push((bitLen >>> (i * 8)) & 0xff);
  const r = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9,
    14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15,
    21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  const k = [
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
    0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
    0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
    0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
    0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
    0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
  ];
  let a = 0x67452301,
    b = 0xefcdab89,
    c = 0x98badcfe,
    d = 0x10325476;
  for (let i = 0; i < msg.length; i += 64) {
    const m: number[] = [];
    for (let j = 0; j < 16; j++) {
      m.push(
        msg[i + j * 4] |
          (msg[i + j * 4 + 1] << 8) |
          (msg[i + j * 4 + 2] << 16) |
          (msg[i + j * 4 + 3] << 24),
      );
    }
    let aa = a,
      bb = b,
      cc = c,
      dd = d;
    for (let j = 0; j < 64; j++) {
      let f: number, g: number;
      if (j < 16) {
        f = (bb & cc) | (~bb & dd);
        g = j;
      } else if (j < 32) {
        f = (dd & bb) | (~dd & cc);
        g = (5 * j + 1) % 16;
      } else if (j < 48) {
        f = bb ^ cc ^ dd;
        g = (3 * j + 5) % 16;
      } else {
        f = cc ^ (bb | ~dd);
        g = (7 * j) % 16;
      }
      const temp = dd;
      dd = cc;
      cc = bb;
      const sum = (aa + f + k[j] + m[g]) >>> 0;
      bb = (bb + ((sum << r[j]) | (sum >>> (32 - r[j])))) >>> 0;
      aa = temp;
    }
    a = (a + aa) >>> 0;
    b = (b + bb) >>> 0;
    c = (c + cc) >>> 0;
    d = (d + dd) >>> 0;
  }
  const toLe = (n: number): string => {
    let s = '';
    for (let i = 0; i < 4; i++) {
      s += ((n >>> (i * 8)) & 0xff).toString(16).padStart(2, '0');
    }
    return s;
  };
  return toLe(a) + toLe(b) + toLe(c) + toLe(d);
}

const block: ForgeBlock = {
  id: 'forge_mailchimp_ext',
  name: 'Mailchimp (extended)',
  description: 'Mailchimp ops (campaigns, send, tags, unsubscribe).',
  iconName: 'LuMail',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'campaigns_list',
      label: 'List campaigns',
      fields: [{ id: 'apiKey', label: 'API key', type: 'password', required: true }],
      run: campaignsList,
    },
    {
      id: 'campaign_send',
      label: 'Send campaign',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'campaignId', label: 'Campaign ID', type: 'text', required: true },
      ],
      run: campaignSend,
    },
    {
      id: 'member_tags',
      label: 'Update member tags',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'listId', label: 'List ID', type: 'text', required: true },
        { id: 'email', label: 'Member email', type: 'text', required: true },
        { id: 'tags', label: 'Tags (CSV)', type: 'text', required: true },
      ],
      run: memberTagsUpdate,
    },
    {
      id: 'member_unsubscribe',
      label: 'Unsubscribe member',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'listId', label: 'List ID', type: 'text', required: true },
        { id: 'email', label: 'Member email', type: 'text', required: true },
      ],
      run: memberUnsubscribe,
    },
  ],
};

registerForgeBlock(block);
export default block;
