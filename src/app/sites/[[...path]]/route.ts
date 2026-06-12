import { NextRequest } from 'next/server';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

/**
 * SabSites — the Webstudio-powered website builder, mounted INSIDE the
 * SabNode app. The vendored Remix app (vendor/webstudio/apps/builder) is
 * compiled with basename "/sites/" and its request handler runs here, in
 * the same Node process: one origin, one deployment, one login (the
 * builder trusts the SabNode `session` cookie — see
 * vendor/webstudio/apps/builder/app/services/sabnode-auth.server.ts).
 *
 * Client assets are served statically from public/sites/ (copied by
 * scripts/build-sabsites.mjs). Everything else lands on this catch-all.
 */

export const dynamic = 'force-dynamic';

const builderDir = () =>
    path.join(process.cwd(), 'vendor/webstudio/apps/builder');

// Bundler-proof dynamic import (the server build + its node_modules live in
// the vendored pnpm workspace and must never be bundled by Next).
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const dynamicImport = new Function('u', 'return import(u)') as (
    url: string
) => Promise<Record<string, unknown>>;

type RemixHandler = (request: Request) => Promise<Response>;

let handlerPromise: Promise<RemixHandler> | undefined;
let handlerVersion: number | undefined;

const loadHandler = async (): Promise<RemixHandler> => {
    const dir = builderDir();
    const buildFile = path.join(dir, 'build/server/index.js');

    // In dev, reload the handler when the vendored build is rebuilt
    // (scripts/build-sabsites.mjs); ESM caches by URL so version it.
    let version = 0;
    if (process.env.NODE_ENV !== 'production') {
        const { statSync } = await import('node:fs');
        version = statSync(buildFile).mtimeMs;
        if (handlerVersion !== version) {
            handlerPromise = undefined;
        }
    }

    handlerPromise ??= (async () => {
        handlerVersion = version;
        const build = await dynamicImport(
            `${pathToFileURL(buildFile).href}?v=${version}`
        );
        const requireFromBuilder = createRequire(path.join(dir, 'package.json'));
        const { createRequestHandler } = requireFromBuilder(
            '@remix-run/server-runtime'
        ) as {
            createRequestHandler: (build: unknown, mode: string) => RemixHandler;
        };
        return createRequestHandler(build, 'production');
    })();
    return handlerPromise;
};

const firstHeaderValue = (value: string | null): string | undefined =>
    value === null ? undefined : value.split(',')[0].trim();

const handle = async (request: NextRequest): Promise<Response> => {
    const url = new URL(request.url);

    // The builder builds absolute public URLs (OAuth redirects + the
    // p-<projectId> subdomains) from request.url, so it MUST see the external
    // origin — never the internal bind port (3002). x-forwarded-* can't gate
    // this (Next sets x-forwarded-proto=http even in local dev), and the port
    // can reach us through the Host header (proxy mis-forward, or the browser
    // hitting :3002 directly). So:
    //   - a real domain (sabnode.com, p-<id>.sabnode.com) is always public:
    //     force https + drop any port; optionally remap the apex to
    //     SABSITES_PUBLIC_HOST (+ SABSITES_PUBLIC_PROTO, default https).
    //   - localhost / an IP is local dev: keep host:port verbatim.
    const fwdHost = firstHeaderValue(
        request.headers.get('x-forwarded-host') ?? request.headers.get('host')
    );
    const hostname = (fwdHost ?? url.hostname).split(':')[0];
    const publicHost = process.env.SABSITES_PUBLIC_HOST;
    const isLocal =
        hostname === 'localhost' ||
        hostname.endsWith('.localhost') ||
        /^\d+\.\d+\.\d+\.\d+$/.test(hostname);
    if (isLocal && publicHost === undefined) {
        if (fwdHost) {
            url.host = fwdHost;
        }
    } else {
        const projectLabel = hostname.match(/^(p-[0-9a-fA-F-]+)\./)?.[1];
        url.protocol = `${process.env.SABSITES_PUBLIC_PROTO ?? 'https'}:`;
        url.hostname =
            publicHost === undefined
                ? hostname
                : projectLabel
                  ? `${projectLabel}.${publicHost}`
                  : publicHost;
        url.port = '';
    }

    const handler = await loadHandler();
    const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
    const forwarded = new Request(url.href, {
        method: request.method,
        headers: request.headers,
        body: hasBody ? request.body : undefined,
        // duplex is required by undici for streamed bodies
        duplex: hasBody ? 'half' : undefined,
        redirect: 'manual',
    } as RequestInit);

    const response = await handler(forwarded);

    // Document redirects come back app-relative (e.g. "/login"); the runtime
    // only rebases data-request redirects, so rebase document ones here.
    const location = response.headers.get('Location');
    if (
        location &&
        location.startsWith('/') &&
        !location.startsWith('//') &&
        location !== '/sites' &&
        !location.startsWith('/sites/')
    ) {
        const headers = new Headers(response.headers);
        headers.set('Location', `/sites${location === '/' ? '/' : location}`);
        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
        });
    }

    return response;
};

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
export const HEAD = handle;
