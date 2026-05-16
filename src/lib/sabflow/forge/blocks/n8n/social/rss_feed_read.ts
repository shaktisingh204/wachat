/**
 * Forge block: RSS Feed Read
 *
 * Source: n8n-master/packages/nodes-base/nodes/RssFeedRead/RssFeedRead.node.ts
 * Credential: none.
 *
 * The n8n port uses the `rss-parser` package. We avoid adding a dependency by
 * implementing a minimal regex parser for the `<item>` shape that covers RSS
 * 2.0 + most Atom feeds with the channel rewritten to `<item>`. Atom-only
 * fields (`<entry>`, `<updated>`) are also handled.
 *
 * Limitations of this minimal parser:
 *   - No XML namespace awareness — only top-level tags inside item/entry.
 *   - CDATA stripped naïvely.
 *   - Does not validate the feed.
 *
 * Single action: read(url, limit).
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

const ITEM_RE = /<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi;

function extractTag(block: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = block.match(re);
  if (!m) return undefined;
  return decodeXml(stripCdata(m[1])).trim();
}

function extractLink(block: string): string | undefined {
  // RSS: <link>https://…</link>
  const direct = extractTag(block, 'link');
  if (direct) return direct;
  // Atom: <link href="…" />
  const m = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  return m?.[1];
}

function stripCdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

type FeedItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
  guid?: string;
};

function parseFeed(xml: string, limit: number): FeedItem[] {
  const items: FeedItem[] = [];
  ITEM_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ITEM_RE.exec(xml)) !== null) {
    if (items.length >= limit) break;
    const block = match[2];
    items.push({
      title: extractTag(block, 'title'),
      link: extractLink(block),
      pubDate: extractTag(block, 'pubDate') ?? extractTag(block, 'updated') ?? extractTag(block, 'published'),
      description: extractTag(block, 'description') ?? extractTag(block, 'summary') ?? extractTag(block, 'content'),
      guid: extractTag(block, 'guid') ?? extractTag(block, 'id'),
    });
  }
  return items;
}

async function read(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const url = asString(ctx.options.url);
  if (!url) throw new Error('RSS: url is required');
  const limit = Math.max(1, asNumber(ctx.options.limit) ?? 20);

  const res = await apiRequest({
    service: 'RSS',
    method: 'GET',
    url,
  });
  const xml = typeof res.data === 'string' ? res.data : res.text;
  if (!xml || !/<(item|entry)\b/i.test(xml)) {
    throw new Error('RSS: response did not contain any <item> or <entry> elements');
  }
  const items = parseFeed(xml, limit);
  return { outputs: { items, count: items.length }, logs: [`RSS read → ${items.length} items from ${url}`] };
}

const block: ForgeBlock = {
  id: 'forge_rss_feed_read',
  name: 'RSS Feed Read',
  description: 'Fetch and parse an RSS / Atom feed into an array of items.',
  iconName: 'LuRss',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'read',
      label: 'Read feed',
      description: 'Fetch the feed URL and return parsed items.',
      fields: [
        { id: 'url', label: 'Feed URL', type: 'text', required: true, placeholder: 'https://example.com/feed.xml' },
        { id: 'limit', label: 'Max items', type: 'number', defaultValue: '20' },
      ],
      run: read,
    },
  ],
};

registerForgeBlock(block);
export default block;
