'use client';

/**
 * Client-side renderer for the SabFlow coverage dashboard.
 *
 * The parent server component loads each inventory JSON / markdown
 * defensively (see `_loaders.ts`) and hands the result in via props.
 * This component owns:
 *
 *  - hero strip with the four big coverage numbers
 *  - the Rust-stubs table + filter input
 *  - the "Missing integrations by category" grouped accordion
 *  - the priority-band styled bar chart
 *  - the three markdown sections (collab, marketplace, playback)
 *
 * Style: zinc-900 background with amber accents, matching the
 * SabNode admin look-and-feel called out in the umbrella ADR
 * (`docs/adr/sabflow-coverage.md`, written by sub-task #10).
 */

import {
    useMemo,
    useState,
    type ElementType,
    type ReactNode,
    type SyntheticEvent,
} from 'react';
import {
    AlertTriangle,
    BarChart3,
    Boxes,
    Cog,
    FileWarning,
    Filter,
    Layers,
    PackageOpen,
    Rocket,
    Sparkles,
    Users,
} from 'lucide-react';

import type {
    CoverageData,
    LoadResult,
    N8nMissingRow,
    PriorityBand,
    PriorityBandRow,
    RustStubRow,
    RustStubsInventory,
} from '../_types';

interface Props {
    data: CoverageData;
}

const BAND_ORDER: PriorityBand[] = ['S', 'A', 'B', 'C'];

const BAND_COLOR: Record<PriorityBand, { fill: string; text: string }> = {
    S: { fill: 'bg-amber-500', text: 'text-amber-300' },
    A: { fill: 'bg-amber-400/80', text: 'text-amber-200' },
    B: { fill: 'bg-amber-300/60', text: 'text-amber-100' },
    C: { fill: 'bg-zinc-500/60', text: 'text-zinc-300' },
};

const COMPLEXITY_ORDER: Record<string, number> = {
    high: 0,
    medium: 1,
    low: 2,
};

function pct(numerator: number, denominator: number): string {
    if (!denominator || denominator <= 0) return '—';
    const v = Math.round((numerator / denominator) * 1000) / 10;
    return `${v}%`;
}

export function CoverageDashboard({ data }: Props) {
    return (
        <div className="space-y-8">
            <HeroStrip data={data} />
            <RustStubsSection result={data.rustStubs} />
            <MissingIntegrationsSection result={data.n8nMissing} />
            <PriorityBandsSection result={data.priorityBands} />
            <MarkdownSection
                title="Collab status"
                icon={Users}
                result={data.collabState}
            />
            <MarkdownSection
                title="Marketplace status"
                icon={PackageOpen}
                result={data.marketplaceState}
            />
            <MarkdownSection
                title="Playback gap"
                icon={Sparkles}
                result={data.playbackGap}
            />
        </div>
    );
}

/* ───────────────────────────── HERO ───────────────────────────── */

function HeroStrip({ data }: Props) {
    // Stub coverage: 1 - stubCount / totalNodes
    const stubInv =
        data.rustStubs.status === 'ok' ? data.rustStubs.data : undefined;
    const stubCoverage = (() => {
        if (!stubInv?.totalNodes) return null;
        const stubs = stubInv.stubCount ?? 0;
        return 1 - stubs / stubInv.totalNodes;
    })();

    // Integration coverage: sabflowCoverageCount / n8nTotalCount
    const n8nInv =
        data.n8nMissing.status === 'ok' ? data.n8nMissing.data : undefined;
    const integrationCoverage = (() => {
        if (!n8nInv?.n8nTotalCount) return null;
        return (n8nInv.sabflowCoverageCount ?? 0) / n8nInv.n8nTotalCount;
    })();

    // S- and B-band ship rates
    const bandInv =
        data.priorityBands.status === 'ok' ? data.priorityBands.data : undefined;
    const bandStats = bandInv?.bands ? computeBandStats(bandInv.bands) : null;
    const sBand = bandStats?.S;
    const bBand = bandStats?.B;

    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <HeroCard
                icon={Cog}
                label="Stub coverage"
                value={
                    stubCoverage === null
                        ? '—'
                        : `${Math.round(stubCoverage * 1000) / 10}%`
                }
                sub={
                    stubInv
                        ? `${(stubInv.totalNodes ?? 0) - (stubInv.stubCount ?? 0)}/${
                              stubInv.totalNodes ?? 0
                          } nodes shipped`
                        : 'Inventory pending'
                }
            />
            <HeroCard
                icon={Boxes}
                label="Integration coverage"
                value={
                    integrationCoverage === null
                        ? '—'
                        : `${Math.round(integrationCoverage * 1000) / 10}%`
                }
                sub={
                    n8nInv
                        ? `${n8nInv.sabflowCoverageCount ?? 0}/${
                              n8nInv.n8nTotalCount ?? 0
                          } vs n8n`
                        : 'Inventory pending'
                }
            />
            <HeroCard
                icon={Rocket}
                label="S-band shipped"
                value={sBand ? pct(sBand.shipped, sBand.total) : '—'}
                sub={
                    sBand
                        ? `${sBand.shipped}/${sBand.total} of top tier`
                        : 'Inventory pending'
                }
            />
            <HeroCard
                icon={Layers}
                label="B-band shipped"
                value={bBand ? pct(bBand.shipped, bBand.total) : '—'}
                sub={
                    bBand
                        ? `${bBand.shipped}/${bBand.total} of mid tier`
                        : 'Inventory pending'
                }
            />
        </div>
    );
}

function HeroCard({
    icon: Icon,
    label,
    value,
    sub,
}: {
    icon: ElementType;
    label: string;
    value: string;
    sub: string;
}) {
    return (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-400">
                <Icon className="h-3.5 w-3.5 text-amber-400" />
                {label}
            </div>
            <div className="mt-3 text-3xl font-semibold text-amber-200">
                {value}
            </div>
            <div className="mt-1 text-xs text-zinc-500">{sub}</div>
        </div>
    );
}

/* ──────────────────────── Rust stubs ──────────────────────── */

function RustStubsSection({
    result,
}: {
    result: LoadResult<RustStubsInventory>;
}) {
    return (
        <SectionShell
            title="Rust stubs"
            icon={Cog}
            description="Nodes still emitting `stub: true` from rust/crates/sabflow-nodes/. Sorted by complexity hint, then alphabetical."
            result={result}
        >
            {result.status === 'ok' ? (
                <RustStubsTable rows={result.data.nodes ?? []} />
            ) : null}
        </SectionShell>
    );
}

function RustStubsTable({ rows }: { rows: RustStubRow[] }) {
    const [query, setQuery] = useState('');

    const filtered = useMemo(() => {
        const stubsOnly = rows.filter((r) => r.isStub !== false);
        const q = query.trim().toLowerCase();
        const matched = q
            ? stubsOnly.filter((r) =>
                  r.nodeType.toLowerCase().includes(q) ||
                  (r.file ?? '').toLowerCase().includes(q),
              )
            : stubsOnly;
        return [...matched].sort((a, b) => {
            const ca = COMPLEXITY_ORDER[a.complexityHint ?? 'low'] ?? 99;
            const cb = COMPLEXITY_ORDER[b.complexityHint ?? 'low'] ?? 99;
            if (ca !== cb) return ca - cb;
            return a.nodeType.localeCompare(b.nodeType);
        });
    }, [rows, query]);

    if (rows.length === 0) {
        return (
            <p className="text-sm text-zinc-500">
                No nodes recorded. Inventory may not yet be generated.
            </p>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-md">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Filter by node type or file path…"
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 pl-9 pr-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-amber-500/60 focus:outline-none"
                    />
                </div>
                <span className="text-xs text-zinc-500">
                    {filtered.length} of {rows.length} shown
                </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-zinc-800">
                <table className="min-w-full divide-y divide-zinc-800 text-sm">
                    <thead className="bg-zinc-900/70 text-left text-xs uppercase tracking-wider text-zinc-400">
                        <tr>
                            <th className="px-4 py-3">Node type</th>
                            <th className="px-4 py-3">Complexity</th>
                            <th className="px-4 py-3">Forge fallback</th>
                            <th className="px-4 py-3">Last touched</th>
                            <th className="px-4 py-3">File</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900 bg-zinc-950/40 text-zinc-200">
                        {filtered.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={5}
                                    className="px-4 py-6 text-center text-zinc-500"
                                >
                                    No matches.
                                </td>
                            </tr>
                        ) : (
                            filtered.map((r) => (
                                <tr key={r.nodeType} className="hover:bg-zinc-900/40">
                                    <td className="px-4 py-2 font-mono text-xs text-amber-200">
                                        {r.nodeType}
                                    </td>
                                    <td className="px-4 py-2">
                                        <ComplexityPill value={r.complexityHint} />
                                    </td>
                                    <td className="px-4 py-2 text-xs">
                                        {r.hasForgeFallback ? (
                                            <span className="text-emerald-400">
                                                Masked
                                            </span>
                                        ) : (
                                            <span className="text-rose-400">
                                                Open
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2 text-xs text-zinc-400">
                                        {r.lastTouched
                                            ? new Date(r.lastTouched)
                                                  .toISOString()
                                                  .slice(0, 10)
                                            : '—'}
                                    </td>
                                    <td className="px-4 py-2 font-mono text-[11px] text-zinc-500">
                                        {r.file ?? '—'}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function ComplexityPill({ value }: { value?: string }) {
    const v = (value ?? 'low').toLowerCase();
    const tint =
        v === 'high'
            ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
            : v === 'medium'
              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              : 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30';
    return (
        <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${tint}`}
        >
            {v}
        </span>
    );
}

/* ─────────────── Missing integrations by category ─────────────── */

function MissingIntegrationsSection({
    result,
}: {
    result: CoverageData['n8nMissing'];
}) {
    return (
        <SectionShell
            title="Missing integrations by category"
            icon={Boxes}
            description="n8n nodes SabFlow does not yet implement, grouped by category. Top 20 per category collapsed."
            result={result}
        >
            {result.status === 'ok' ? (
                <MissingIntegrationsBody rows={result.data.missing ?? []} />
            ) : null}
        </SectionShell>
    );
}

function MissingIntegrationsBody({ rows }: { rows: N8nMissingRow[] }) {
    const grouped = useMemo(() => {
        const out = new Map<string, N8nMissingRow[]>();
        for (const row of rows) {
            const cat = row.category?.trim() || 'Uncategorised';
            const list = out.get(cat) ?? [];
            list.push(row);
            out.set(cat, list);
        }
        // Sort categories by size desc.
        return [...out.entries()].sort((a, b) => b[1].length - a[1].length);
    }, [rows]);

    if (grouped.length === 0) {
        return (
            <p className="text-sm text-zinc-500">
                No missing integrations recorded.
            </p>
        );
    }

    return (
        <div className="space-y-2">
            {grouped.map(([category, items]) => (
                <CategoryGroup
                    key={category}
                    category={category}
                    items={items}
                />
            ))}
        </div>
    );
}

function CategoryGroup({
    category,
    items,
}: {
    category: string;
    items: N8nMissingRow[];
}) {
    const [open, setOpen] = useState(false);
    const preview = items.slice(0, 20);
    const overflow = Math.max(0, items.length - 20);
    const shown = open ? items : preview;

    return (
        <details
            className="group rounded-xl border border-zinc-800 bg-zinc-900/40 open:bg-zinc-900/60"
            onToggle={(e: SyntheticEvent<HTMLDetailsElement>) =>
                setOpen(e.currentTarget.open)
            }
        >
            <summary className="flex cursor-pointer items-center justify-between px-4 py-3">
                <span className="text-sm font-medium text-zinc-100">
                    {category}
                </span>
                <span className="text-xs text-amber-300/80">
                    {items.length} missing
                </span>
            </summary>
            <ul className="divide-y divide-zinc-900 border-t border-zinc-800">
                {shown.map((row) => (
                    <li
                        key={row.nodeType}
                        className="grid grid-cols-1 gap-1 px-4 py-2 text-xs md:grid-cols-3"
                    >
                        <span className="font-mono text-amber-200">
                            {row.nodeType}
                        </span>
                        <span className="text-zinc-300">
                            {row.displayName ?? '—'}
                        </span>
                        <span className="text-zinc-500">
                            {row.credentialTypes?.length
                                ? `creds: ${row.credentialTypes.join(', ')}`
                                : 'no credential'}
                        </span>
                    </li>
                ))}
                {!open && overflow > 0 ? (
                    <li className="px-4 py-2 text-xs text-zinc-500">
                        +{overflow} more — expand to view.
                    </li>
                ) : null}
            </ul>
        </details>
    );
}

/* ─────────────────────── Priority bands ─────────────────────── */

interface BandStats {
    total: number;
    shipped: number;
    pending: number;
}

function computeBandStats(
    rows: PriorityBandRow[],
): Partial<Record<PriorityBand, BandStats>> {
    const out: Partial<Record<PriorityBand, BandStats>> = {};
    for (const row of rows) {
        const band = (row.band as PriorityBand) ?? 'C';
        if (!BAND_ORDER.includes(band)) continue;
        const slot = out[band] ?? { total: 0, shipped: 0, pending: 0 };
        slot.total += 1;
        if (row.shipped) slot.shipped += 1;
        else slot.pending += 1;
        out[band] = slot;
    }
    return out;
}

function PriorityBandsSection({
    result,
}: {
    result: CoverageData['priorityBands'];
}) {
    return (
        <SectionShell
            title="Priority bands"
            icon={BarChart3}
            description="S (top 30), A (next 50), B (next 200), C (long tail). Bars show shipped vs pending."
            result={result}
        >
            {result.status === 'ok' ? (
                <PriorityBandsBars
                    stats={computeBandStats(result.data.bands ?? [])}
                />
            ) : null}
        </SectionShell>
    );
}

function PriorityBandsBars({
    stats,
}: {
    stats: Partial<Record<PriorityBand, BandStats>>;
}) {
    const maxTotal = Math.max(
        1,
        ...BAND_ORDER.map((b) => stats[b]?.total ?? 0),
    );

    if (!BAND_ORDER.some((b) => stats[b]?.total)) {
        return (
            <p className="text-sm text-zinc-500">
                No priority data recorded yet.
            </p>
        );
    }

    return (
        <div className="space-y-3">
            {BAND_ORDER.map((band) => {
                const s = stats[band] ?? { total: 0, shipped: 0, pending: 0 };
                const widthPct = (s.total / maxTotal) * 100;
                const shippedPct = s.total > 0 ? (s.shipped / s.total) * 100 : 0;
                return (
                    <div key={band} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                                <span
                                    className={`inline-flex h-5 w-5 items-center justify-center rounded-md border border-zinc-700 font-mono font-semibold ${BAND_COLOR[band].text}`}
                                >
                                    {band}
                                </span>
                                <span className="text-zinc-300">
                                    {s.total} nodes
                                </span>
                            </div>
                            <span className="text-zinc-500">
                                {s.shipped} shipped · {s.pending} pending
                            </span>
                        </div>
                        <div
                            className="relative h-3 overflow-hidden rounded-full bg-zinc-900"
                            style={{ width: `${Math.max(widthPct, 5)}%` }}
                        >
                            <div
                                className={`h-full ${BAND_COLOR[band].fill}`}
                                style={{ width: `${shippedPct}%` }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/* ───────────────────── Markdown sections ───────────────────── */

function MarkdownSection({
    title,
    icon,
    result,
}: {
    title: string;
    icon: ElementType;
    result: LoadResult<string>;
}) {
    return (
        <SectionShell
            title={title}
            icon={icon}
            description="Markdown rendered as plain text — install react-markdown to upgrade once it ships in package.json."
            result={result}
        >
            {result.status === 'ok' ? (
                <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 font-mono text-xs leading-relaxed text-zinc-200">
                    {result.data}
                </pre>
            ) : null}
        </SectionShell>
    );
}

/* ─────────────────────── Section shell ─────────────────────── */

function SectionShell({
    title,
    icon: Icon,
    description,
    result,
    children,
}: {
    title: string;
    icon: ElementType;
    description: string;
    result: LoadResult<unknown>;
    children: ReactNode;
}) {
    return (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
            <header className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10">
                        <Icon className="h-4 w-4 text-amber-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-zinc-100">
                            {title}
                        </h2>
                        <p className="mt-0.5 text-xs text-zinc-500">
                            {description}
                        </p>
                    </div>
                </div>
                <StatusPill result={result} />
            </header>

            {result.status === 'ok' ? (
                children
            ) : (
                <InventoryPendingBanner result={result} />
            )}
        </section>
    );
}

function StatusPill({ result }: { result: LoadResult<unknown> }) {
    if (result.status === 'ok') {
        return (
            <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-300">
                Loaded
            </span>
        );
    }
    if (result.status === 'missing') {
        return (
            <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-300">
                Pending
            </span>
        );
    }
    return (
        <span className="inline-flex items-center rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-rose-300">
            Error
        </span>
    );
}

function InventoryPendingBanner({ result }: { result: LoadResult<unknown> }) {
    const isError = result.status === 'error';
    return (
        <div
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
                isError
                    ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
            }`}
        >
            {isError ? (
                <FileWarning className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <div className="space-y-1">
                <div className="font-medium">
                    {isError
                        ? 'Inventory failed to load'
                        : 'Inventory pending'}
                </div>
                <div className="font-mono text-[11px] opacity-80">
                    {result.path}
                </div>
                {result.status === 'error' ? (
                    <div className="text-xs opacity-90">{result.message}</div>
                ) : (
                    <div className="text-xs opacity-90">
                        Awaiting sibling Phase C.1 sub-task to publish this
                        file. Re-run the inventory script or wait for CI.
                    </div>
                )}
            </div>
        </div>
    );
}
