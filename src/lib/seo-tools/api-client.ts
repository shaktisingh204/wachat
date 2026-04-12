// Thin client wrappers around the /api/seo-tools/* backend routes.
// All return plain JSON; callers handle errors.

export interface FetchUrlResult {
  url: string;
  finalUrl: string;
  status: number;
  redirectChain: { url: string; status: number; location?: string }[];
  headers: Record<string, string>;
  contentType: string;
  bytes: number;
  body: string;
  error?: string;
}

export async function apiFetchUrl(url: string): Promise<FetchUrlResult> {
  const res = await fetch('/api/seo-tools/fetch-url', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  return res.json();
}

export async function apiDnsLookup(host: string, type?: string) {
  const res = await fetch('/api/seo-tools/dns', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ host, type }),
  });
  return res.json();
}

export async function apiWhois(domain: string) {
  const res = await fetch('/api/seo-tools/whois', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ domain }),
  });
  return res.json();
}

export async function apiSsl(host: string) {
  const res = await fetch('/api/seo-tools/ssl', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ host }),
  });
  return res.json();
}

// ────────────────────────────────────────────────────────────────
// HTML parsing helpers used by many meta/on-page tools (client-safe)
// ────────────────────────────────────────────────────────────────

export interface ParsedHtml {
  title: string;
  metaDescription: string;
  canonical: string;
  robots: string;
  viewport: string;
  lang: string;
  charset: string;
  h1: string[];
  h2: string[];
  h3: string[];
  h4: string[];
  h5: string[];
  h6: string[];
  links: { href: string; text: string; rel: string; nofollow: boolean }[];
  images: { src: string; alt: string }[];
  openGraph: Record<string, string>;
  twitter: Record<string, string>;
  schema: any[];
  hreflang: { href: string; hreflang: string }[];
}

export function parseHtml(html: string): ParsedHtml {
  const pick = (re: RegExp) => (html.match(re)?.[1] || '').trim();
  const pickAttr = (tag: RegExp, attr: string) => {
    const m = html.match(tag);
    if (!m) return '';
    const attrRe = new RegExp(`${attr}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
    const a = m[0].match(attrRe);
    return (a?.[1] || a?.[2] || a?.[3] || '').trim();
  };

  const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const metaDescription = pickMetaContent(html, 'description');
  const robots = pickMetaContent(html, 'robots');
  const viewport = pickMetaContent(html, 'viewport');
  const lang = pickAttr(/<html\b[^>]*>/i, 'lang');
  const charset = pickAttr(/<meta\b[^>]*charset[^>]*>/i, 'charset');
  const canonical = pickLinkRel(html, 'canonical');

  const headings = (tag: string) =>
    Array.from(html.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi')))
      .map((m) => stripTags(m[1]).trim())
      .filter(Boolean);

  const links = Array.from(html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)).map((m) => {
    const tag = m[0];
    const href = attr(tag, 'href');
    const rel = attr(tag, 'rel');
    return { href, text: stripTags(m[1]).trim(), rel, nofollow: /nofollow/i.test(rel) };
  });

  const images = Array.from(html.matchAll(/<img\b[^>]*>/gi)).map((m) => ({
    src: attr(m[0], 'src'),
    alt: attr(m[0], 'alt'),
  }));

  const openGraph: Record<string, string> = {};
  const twitter: Record<string, string> = {};
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    const prop = attr(tag, 'property') || attr(tag, 'name');
    const content = attr(tag, 'content');
    if (!prop) continue;
    if (prop.startsWith('og:')) openGraph[prop] = content;
    if (prop.startsWith('twitter:')) twitter[prop] = content;
  }

  const schema: any[] = [];
  for (const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      schema.push(JSON.parse(m[1].trim()));
    } catch {
      /* invalid JSON-LD, skip */
    }
  }

  const hreflang: { href: string; hreflang: string }[] = [];
  for (const m of html.matchAll(/<link\b[^>]*rel=["']alternate["'][^>]*>/gi)) {
    const tag = m[0];
    const href = attr(tag, 'href');
    const hl = attr(tag, 'hreflang');
    if (hl) hreflang.push({ href, hreflang: hl });
  }

  return {
    title,
    metaDescription,
    canonical,
    robots,
    viewport,
    lang,
    charset,
    h1: headings('h1'),
    h2: headings('h2'),
    h3: headings('h3'),
    h4: headings('h4'),
    h5: headings('h5'),
    h6: headings('h6'),
    links,
    images,
    openGraph,
    twitter,
    schema,
    hreflang,
  };
}

function pickMetaContent(html: string, name: string): string {
  const re = new RegExp(
    `<meta\\b[^>]*name=["']${name}["'][^>]*>|<meta\\b[^>]*content=["'][^"']*["'][^>]*name=["']${name}["'][^>]*>`,
    'i',
  );
  const m = html.match(re);
  if (!m) return '';
  return attr(m[0], 'content');
}

function pickLinkRel(html: string, rel: string): string {
  const re = new RegExp(`<link\\b[^>]*rel=["']${rel}["'][^>]*>`, 'i');
  const m = html.match(re);
  return m ? attr(m[0], 'href') : '';
}

function attr(tag: string, name: string): string {
  const re = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const m = tag.match(re);
  return (m?.[1] || m?.[2] || m?.[3] || '').trim();
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '');
}
