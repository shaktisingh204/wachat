
'use server';

import { assertSafeOutboundUrl } from './url-guard';

const REQUEST_TIMEOUT_MS = 15_000;

async function fetchHtml(rawUrl: string): Promise<string> {
    const safeUrl = await assertSafeOutboundUrl(rawUrl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        const res = await fetch(safeUrl.toString(), {
            redirect: 'follow',
            headers: { 'User-Agent': 'SabFlow-SEO-Bot/1.0' },
            signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Failed to fetch: HTTP ${res.status}`);
        const text = await res.text();
        return text;
    } finally {
        clearTimeout(timer);
    }
}

function extractTitle(html: string): string {
    const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return m ? m[1].trim() : '';
}

function extractFirstH1(html: string): string {
    const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (!m) return '';
    return m[1].replace(/<[^>]+>/g, '').trim();
}

function extractMetaTags(html: string): { meta: Record<string, string>; ogTags: Record<string, string> } {
    const meta: Record<string, string> = {};
    const ogTags: Record<string, string> = {};

    const regex = /<meta\s+([^>]+?)\s*\/?>/gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(html)) !== null) {
        const attrs = match[1];
        const nameAttr = /(?:name|property)\s*=\s*["']([^"']+)["']/i.exec(attrs);
        const contentAttr = /content\s*=\s*["']([^"']*)["']/i.exec(attrs);
        if (nameAttr && contentAttr) {
            const key = nameAttr[1];
            const value = contentAttr[1];
            if (key.startsWith('og:') || key.startsWith('twitter:')) {
                ogTags[key] = value;
            } else {
                meta[key] = value;
            }
        }
    }
    return { meta, ogTags };
}

function stripTags(html: string): string {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function computeQuickScore({
    title,
    metaDescription,
    h1,
    wordCount,
}: {
    title: string;
    metaDescription: string;
    h1: string;
    wordCount: number;
}): number {
    let score = 0;
    if (title && title.length >= 10 && title.length <= 70) score += 25;
    else if (title) score += 10;
    if (metaDescription && metaDescription.length >= 50 && metaDescription.length <= 160) score += 25;
    else if (metaDescription) score += 10;
    if (h1) score += 20;
    if (wordCount >= 300) score += 30;
    else if (wordCount >= 100) score += 15;
    return Math.min(100, score);
}

export async function executeSeoSuiteAction(
    actionName: string,
    inputs: any,
    _user: any,
    logger: any
) {
    try {
        switch (actionName) {
            case 'analyzeUrl': {
                const url = String(inputs.url ?? '').trim();
                if (!url) throw new Error('url is required.');
                const html = await fetchHtml(url);
                const title = extractTitle(html);
                const { meta } = extractMetaTags(html);
                const metaDescription = meta['description'] || '';
                const h1 = extractFirstH1(html);
                const text = stripTags(html);
                const words = text ? text.split(/\s+/).filter(Boolean) : [];
                const wordCount = words.length;
                const score = computeQuickScore({ title, metaDescription, h1, wordCount });
                logger.log(`[SeoSuite] Analyzed ${url} → score ${score}`);
                return {
                    output: {
                        title,
                        metaDescription,
                        h1,
                        wordCount,
                        score,
                    },
                };
            }

            case 'checkMetaTags': {
                const url = String(inputs.url ?? '').trim();
                if (!url) throw new Error('url is required.');
                const html = await fetchHtml(url);
                const { meta, ogTags } = extractMetaTags(html);
                return { output: { meta, ogTags } };
            }

            case 'countKeywords': {
                const text = String(inputs.text ?? '');
                const keyword = String(inputs.keyword ?? '').trim();
                if (!keyword) throw new Error('keyword is required.');
                const normalizedText = text.toLowerCase();
                const normalizedKeyword = keyword.toLowerCase();
                // Count occurrences (non-overlapping)
                let count = 0;
                let idx = 0;
                while ((idx = normalizedText.indexOf(normalizedKeyword, idx)) !== -1) {
                    count++;
                    idx += normalizedKeyword.length;
                }
                const words = normalizedText.split(/\s+/).filter(Boolean);
                const density = words.length ? Number(((count / words.length) * 100).toFixed(2)) : 0;
                return { output: { count, density } };
            }

            default:
                return { error: `SEO Suite action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'SEO Suite action failed.' };
    }
}
