/**
 * /dashboard/internal/sabflow-coverage — SabFlow Track C coverage HUD.
 *
 * Admin-only. Mirrors the server-side cookie auth pattern used by
 * `src/app/admin/dashboard/layout.tsx` via `getAdminSession()` so the
 * gate runs in the same request and there is no client flash.
 *
 * The page reads seven inventory artefacts produced by sibling
 * Phase C.1 sub-tasks (#1 → #7):
 *
 *   - docs/inventory/rust-stubs.json          (C.1.1)
 *   - docs/inventory/forge-fallback-map.json  (C.1.2)
 *   - docs/inventory/n8n-missing.json         (C.1.3)
 *   - docs/inventory/priority-bands.json      (C.1.4)
 *   - docs/inventory/playback-gap.md          (C.1.5)
 *   - docs/inventory/marketplace-state.md     (C.1.6)
 *   - docs/inventory/collab-state.md          (C.1.7)
 *
 * Sibling tasks run in parallel and may not have published their
 * artefact yet. Every read is defensive: a missing or malformed
 * file degrades the matching section to an "Inventory pending"
 * banner without breaking the rest of the dashboard.
 *
 * RBAC reservation: the umbrella ADR for Track C
 * (`docs/adr/sabflow-coverage.md`, owned by Phase C.1 sub-task #10)
 * pins the priority-band JSON shape and the acceptance gates this
 * page surfaces, and reserves the `sabflow.coverage.view` RBAC key
 * that the broader RBAC registration phase will wire up later.
 */

import path from 'node:path';
import { promises as fs } from 'node:fs';
import { redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';

import { getAdminSession } from '@/lib/admin-session';

import { CoverageDashboard } from './_components/CoverageDashboard';
import type {
    CoverageData,
    ForgeFallbackInventory,
    LoadResult,
    N8nMissingInventory,
    PriorityBandsInventory,
    RustStubsInventory,
} from './_types';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'SabFlow Coverage | SabNode Internal',
};

/** Resolve a path relative to the repo root regardless of cwd. */
function repoFile(rel: string): string {
    return path.join(/*turbopackIgnore: true*/ process.cwd(), rel);
}

/**
 * Read a JSON file from disk and parse it.
 *
 * Returns a discriminated union so the renderer can render an
 * empty-state banner per-section if the file is absent or invalid.
 */
async function loadJson<T>(rel: string): Promise<LoadResult<T>> {
    const filePath = repoFile(rel);
    let raw: string;
    try {
        // Admin-only, force-dynamic runtime read of a repo artefact. Keep
        // Turbopack's file tracer from statically analysing this dynamic path
        // (which would otherwise trace the whole project / over-bundle).
        raw = await fs.readFile(/*turbopackIgnore: true*/ filePath, 'utf8');
    } catch (err: unknown) {
        const code = (err as NodeJS.ErrnoException)?.code;
        if (code === 'ENOENT') {
            return { status: 'missing', path: rel };
        }
        return {
            status: 'error',
            path: rel,
            message: (err as Error)?.message ?? 'unknown error',
        };
    }
    try {
        const data = JSON.parse(raw) as T;
        return { status: 'ok', data, path: rel };
    } catch (err) {
        return {
            status: 'error',
            path: rel,
            message: `Invalid JSON: ${(err as Error).message}`,
        };
    }
}

async function loadText(rel: string): Promise<LoadResult<string>> {
    const filePath = repoFile(rel);
    try {
        // See loadJson: keep the file tracer from over-tracing this dynamic read.
        const data = await fs.readFile(/*turbopackIgnore: true*/ filePath, 'utf8');
        return { status: 'ok', data, path: rel };
    } catch (err: unknown) {
        const code = (err as NodeJS.ErrnoException)?.code;
        if (code === 'ENOENT') {
            return { status: 'missing', path: rel };
        }
        return {
            status: 'error',
            path: rel,
            message: (err as Error)?.message ?? 'unknown error',
        };
    }
}

async function loadCoverageData(): Promise<CoverageData> {
    const [
        rustStubs,
        forgeFallbacks,
        n8nMissing,
        priorityBands,
        playbackGap,
        marketplaceState,
        collabState,
    ] = await Promise.all([
        loadJson<RustStubsInventory>('docs/inventory/rust-stubs.json'),
        loadJson<ForgeFallbackInventory>(
            'docs/inventory/forge-fallback-map.json',
        ),
        loadJson<N8nMissingInventory>('docs/inventory/n8n-missing.json'),
        loadJson<PriorityBandsInventory>(
            'docs/inventory/priority-bands.json',
        ),
        loadText('docs/inventory/playback-gap.md'),
        loadText('docs/inventory/marketplace-state.md'),
        loadText('docs/inventory/collab-state.md'),
    ]);

    return {
        rustStubs,
        forgeFallbacks,
        n8nMissing,
        priorityBands,
        playbackGap,
        marketplaceState,
        collabState,
    };
}

export default async function SabFlowCoveragePage() {
    // Server-side admin gate. Mirrors the layout guard in
    // /admin/dashboard so unauthenticated users never see this view.
    const session = await getAdminSession();
    if (!session.isAdmin) {
        redirect('/admin-login');
    }

    const data = await loadCoverageData();

    return (
        <div className="min-h-screen bg-zoru-ink text-white">
            <div className="mx-auto max-w-7xl space-y-8 p-6 md:p-8 lg:p-10">
                <header className="space-y-3">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zoru-ink-muted/80">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Internal · Track C
                    </div>
                    <h1 className="text-3xl font-semibold text-white">
                        SabFlow coverage
                    </h1>
                    <p className="max-w-3xl text-sm text-zoru-ink-muted">
                        Live snapshot of the five Track C gaps — Rust stubs,
                        missing n8n integrations, collab GA, execution
                        playback, and the marketplace content library.
                        Inventories are produced by Phase C.1 sub-tasks
                        (#1 → #7) and read from{' '}
                        <code className="text-zoru-ink-muted">
                            docs/inventory/
                        </code>{' '}
                        at request time.
                    </p>
                    <div className="rounded-xl border border-zoru-line/30 bg-zoru-ink/10 p-4 text-xs text-white">
                        <div className="font-semibold text-white">
                            RBAC reservation note
                        </div>
                        <p className="mt-1 leading-relaxed text-white/80">
                            Page is gated by the admin session cookie today.
                            The dedicated{' '}
                            <code className="text-white">
                                sabflow.coverage.view
                            </code>{' '}
                            RBAC key is reserved by the umbrella ADR{' '}
                            <code className="text-white">
                                docs/adr/sabflow-coverage.md
                            </code>{' '}
                            (Phase C.1 sub-task #10) and will be registered
                            by a later phase. Do not register it here.
                        </p>
                    </div>
                </header>

                <CoverageDashboard data={data} />
            </div>
        </div>
    );
}
