/**
 * Site audit runner. `runAudit(url)` performs a series of on-page checks
 * against fetched HTML and returns structured findings with severity.
 *
 * The HTML fetch is delegated to the existing `apiFetchUrl` client so the
 * audit goes through the project's centralized SEO proxy (which handles
 * redirects, headers, and rate-limiting).
 */
import type { Audit, AuditFinding, Severity } from './types';

export type RunAuditOptions = {
  /**
   * Optional injection hook so callers (and tests) can supply a fetcher
   * without importing the network client.
   */
  fetchHtml?: (url: string) => Promise<{ status: number; body: string; finalUrl: string }>;
};

const SCORE_BY_SEVERITY: Record<Severity, number> = {
  critical: 15,
  warning: 5,
  info: 1,
};

export async function runAudit(url: string, opts: RunAuditOptions = {}): Promise<Audit> {
  const fetcher = opts.fetchHtml ?? defaultFetcher;
  const fetched = await fetcher(url);
  const html = fetched.body || '';
  const findings = auditHtml(html);

  const summary = {
    critical: findings.filter((f) => f.severity === 'critical').length,
    warning: findings.filter((f) => f.severity === 'warning').length,
    info: findings.filter((f) => f.severity === 'info').length,
  };
  const penalty = findings.reduce((sum, f) => sum + SCORE_BY_SEVERITY[f.severity], 0);
  const score = Math.max(0, 100 - penalty);

  return {
    url: fetched.finalUrl || url,
    fetchedAt: new Date().toISOString(),
    status: fetched.status,
    score,
    findings,
    summary,
  };
}

/** Pure HTML auditor — exported separately so tests can run without I/O. */
export function auditHtml(html: string): AuditFinding[] {
  const findings: AuditFinding[] = [];

  // Title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = (titleMatch?.[1] || '').trim();
  if (!title) {
    findings.push({
      code: 'missing_title',
      severity: 'critical',
      message: 'Page is missing a <title> tag.',
      recommendation: 'Add a unique 50-60 character title.',
    });
  } else if (title.length > 70) {
    findings.push({
      code: 'title_too_long',
      severity: 'warning',
      message: `Title is ${title.length} characters; risks truncation in SERPs.`,
    });
  } else if (title.length < 20) {
    findings.push({
      code: 'title_too_short',
      severity: 'info',
      message: `Title is only ${title.length} characters.`,
    });
  }

  // Meta description
  const desc = pickMetaContent(html, 'description');
  if (!desc) {
    findings.push({
      code: 'missing_meta_description',
      severity: 'warning',
      message: 'Missing meta description.',
      recommendation: 'Add a 150-160 character description with the primary keyword.',
    });
  } else if (desc.length > 170) {
    findings.push({
      code: 'meta_description_too_long',
      severity: 'info',
      message: `Meta description is ${desc.length} characters.`,
    });
  }

  // Headings
  const h1Count = matchAllCount(html, /<h1\b[^>]*>/gi);
  if (h1Count === 0) {
    findings.push({
      code: 'missing_h1',
      severity: 'critical',
      message: 'Page has no <h1> heading.',
    });
  } else if (h1Count > 1) {
    findings.push({
      code: 'multiple_h1',
      severity: 'warning',
      message: `Page has ${h1Count} <h1> tags; only one is recommended.`,
    });
  }
  const h2Count = matchAllCount(html, /<h2\b[^>]*>/gi);
  if (h2Count === 0) {
    findings.push({
      code: 'no_h2',
      severity: 'info',
      message: 'No <h2> tags — consider structuring content with subheadings.',
    });
  }

  // Image alts
  const imgs = Array.from(html.matchAll(/<img\b[^>]*>/gi));
  const missingAlt = imgs.filter((m) => !/\balt\s*=\s*["'][^"']/i.test(m[0]));
  if (missingAlt.length > 0) {
    findings.push({
      code: 'images_missing_alt',
      severity: 'warning',
      message: `${missingAlt.length} of ${imgs.length} images are missing alt text.`,
      recommendation: 'Add descriptive alt attributes to every meaningful image.',
    });
  }

  // Internal links
  const links = Array.from(html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi));
  const internalLinks = links.filter((m) => {
    const href = m[1] || '';
    return href.startsWith('/') || href.startsWith('#') || (!href.includes('://') && !href.startsWith('mailto:'));
  });
  if (internalLinks.length < 3) {
    findings.push({
      code: 'low_internal_links',
      severity: 'info',
      message: `Only ${internalLinks.length} internal links found.`,
      recommendation: 'Aim for at least 3 internal links to related pages.',
    });
  }

  // Mobile viewport
  const viewport = pickMetaContent(html, 'viewport');
  if (!viewport) {
    findings.push({
      code: 'missing_viewport',
      severity: 'critical',
      message: 'Missing <meta name="viewport"> — page is not mobile-friendly.',
    });
  } else if (!/width\s*=\s*device-width/i.test(viewport)) {
    findings.push({
      code: 'viewport_not_responsive',
      severity: 'warning',
      message: 'Viewport tag does not declare width=device-width.',
    });
  }

  // Canonical
  const canonical = pickLinkRel(html, 'canonical');
  if (!canonical) {
    findings.push({
      code: 'missing_canonical',
      severity: 'warning',
      message: 'Missing <link rel="canonical"> tag.',
    });
  }

  // Structured data
  const ldCount = matchAllCount(html, /<script\b[^>]*type=["']application\/ld\+json["']/gi);
  if (ldCount === 0) {
    findings.push({
      code: 'no_structured_data',
      severity: 'info',
      message: 'No JSON-LD structured data detected.',
      recommendation: 'Add schema.org markup (Article, Product, FAQ, etc.).',
    });
  }

  return findings;
}

async function defaultFetcher(url: string): Promise<{ status: number; body: string; finalUrl: string }> {
  // Inline import to avoid pulling the network client into pure tests.
  const { apiFetchUrl } = await import('@/lib/seo-tools/api-client');
  const r = await apiFetchUrl(url);
  return { status: r.status, body: r.body, finalUrl: r.finalUrl || url };
}

function pickMetaContent(html: string, name: string): string {
  const re = new RegExp(`<meta\\b[^>]*name=["']${name}["'][^>]*>`, 'i');
  const m = html.match(re);
  if (!m) return '';
  const c = m[0].match(/content\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
  return (c?.[1] || c?.[2] || '').trim();
}

function pickLinkRel(html: string, rel: string): string {
  const re = new RegExp(`<link\\b[^>]*rel=["']${rel}["'][^>]*>`, 'i');
  const m = html.match(re);
  if (!m) return '';
  const h = m[0].match(/href\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
  return (h?.[1] || h?.[2] || '').trim();
}

function matchAllCount(html: string, re: RegExp): number {
  return Array.from(html.matchAll(re)).length;
}
