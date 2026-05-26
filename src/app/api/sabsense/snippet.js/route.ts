/**
 * Dynamic snippet route — serves `public/pagesense-snippet.js` as
 * `application/javascript` with cache headers. Either this route or
 * the static `/pagesense-snippet.js` asset works in customer
 * `<script>` tags; this dynamic version exists so we can add future
 * key-prefilled or build-id-keyed variants without redirecting.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const revalidate = 3600; // 1h CDN cache

export async function GET() {
    try {
        const file = await readFile(
            join(process.cwd(), 'public', 'pagesense-snippet.js'),
            'utf-8',
        );
        return new NextResponse(file, {
            headers: {
                'Content-Type': 'application/javascript; charset=utf-8',
                'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
                'Access-Control-Allow-Origin': '*',
            },
        });
    } catch (e) {
        console.error('[pagesense/snippet.js] failed to read snippet file', {
            err: e instanceof Error ? e.message : String(e),
        });
        return new NextResponse('// pagesense snippet unavailable', {
            status: 500,
            headers: { 'Content-Type': 'application/javascript' },
        });
    }
}
