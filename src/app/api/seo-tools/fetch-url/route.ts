import { NextResponse } from 'next/server';

// Server-side URL fetcher for SEO tools. Follows redirects (tracks chain),
// enforces a size cap, and never leaks internal requests.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const TIMEOUT_MS = 15000;
const BLOCKED_HOSTS = /^(localhost|127\.|0\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|::1|fc00:|fe80:)/i;

function safeUrl(input: string): URL | null {
  try {
    const u = new URL(input);
    if (!/^https?:$/.test(u.protocol)) return null;
    if (BLOCKED_HOSTS.test(u.hostname)) return null;
    return u;
  } catch {
    return null;
  }
}

async function fetchWithRedirects(url: string, maxRedirects = 10) {
  const chain: { url: string; status: number; location?: string }[] = [];
  let current = url;
  for (let i = 0; i <= maxRedirects; i++) {
    const u = safeUrl(current);
    if (!u) throw new Error(`Blocked or invalid URL: ${current}`);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(current, {
        redirect: 'manual',
        signal: ctrl.signal,
        headers: { 'User-Agent': 'SabNodeSEOBot/1.0' },
      });
    } finally {
      clearTimeout(timer);
    }

    const location = res.headers.get('location') || undefined;
    chain.push({ url: current, status: res.status, location });
    if (res.status >= 300 && res.status < 400 && location) {
      current = new URL(location, current).toString();
      continue;
    }
    return { finalResponse: res, chain };
  }
  throw new Error('Too many redirects');
}

async function readBodyCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  let total = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_BYTES) break;
    chunks.push(value);
  }
  const merged = new Uint8Array(total > MAX_BYTES ? MAX_BYTES : total);
  let offset = 0;
  for (const c of chunks) {
    const len = Math.min(c.length, merged.length - offset);
    merged.set(c.subarray(0, len), offset);
    offset += len;
    if (offset >= merged.length) break;
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(merged);
}

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: 'url is required' }, { status: 400 });
    const parsed = safeUrl(url);
    if (!parsed) return NextResponse.json({ error: 'invalid or blocked url' }, { status: 400 });

    const { finalResponse, chain } = await fetchWithRedirects(url);
    const headers: Record<string, string> = {};
    finalResponse.headers.forEach((v, k) => (headers[k] = v));
    const contentType = headers['content-type'] || '';
    const isHtml = contentType.includes('html') || contentType.includes('xml') || !contentType;
    const body = isHtml ? await readBodyCapped(finalResponse) : '';
    const bytes = Number(headers['content-length']) || body.length;

    return NextResponse.json({
      url,
      finalUrl: chain[chain.length - 1]?.url || url,
      status: finalResponse.status,
      redirectChain: chain,
      headers,
      contentType,
      bytes,
      body,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'fetch failed' }, { status: 500 });
  }
}
