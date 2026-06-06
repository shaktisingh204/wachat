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
 * Pure 20ui: StatCard / Card / Table primitives / Field+Input / Badge /
 * Accordion / Alert / EmptyState, scoped under `.ui20`. One accent, one radius.
 */

import {
    useMemo,
    useState,
    type ElementType,
    type ReactNode,
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

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
    Alert,
    Badge,
    Card,
    CardBody,
    CardDescription,
    CardHeader,
    CardTitle,
    EmptyState,
    Field,
    Input,
    StatCard,
    Table,
    TBody,
    Td,
    THead,
    Th,
    Tr,
} from '@/components/sabcrm/20ui';

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

const COMPLEXITY_ORDER: Record<string, number> = {
    high: 0,
    medium: 1,
    low: 2,
};

function pct(numerator: number, denominator: number): string {
    if (!denominator || denominator <= 0) return 'n/a';
    const v = Math.round((numerator / denominator) * 1000) / 10;
    return `${v}%`;
}

export function CoverageDashboard({ data }: Props) {
    return (
        <div className="ui20 space-y-8">
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
            <StatCard
                icon={Cog}
                label="Stub coverage"
                value={
                    stubCoverage === null
                        ? 'n/a'
                        : `${Math.round(stubCoverage * 1000) / 10}%`
                }
                delta={{
                    tone: 'neutral',
                    value: stubInv
                        ? `${(stubInv.totalNodes ?? 0) - (stubInv.stubCount ?? 0)}/${
                              stubInv.totalNodes ?? 0
                          } nodes shipped`
                        : 'Inventory pending',
                }}
            />
            <StatCard
                icon={Boxes}
                label="Integration coverage"
                value={
                    integrationCoverage === null
                        ? 'n/a'
                        : `${Math.round(integrationCoverage * 1000) / 10}%`
                }
                delta={{
                    tone: 'neutral',
                    value: n8nInv
                        ? `${n8nInv.sabflowCoverageCount ?? 0}/${
                              n8nInv.n8nTotalCount ?? 0
                          } vs n8n`
                        : 'Inventory pending',
                }}
            />
            <StatCard
                icon={Rocket}
                label="S-band shipped"
                value={sBand ? pct(sBand.shipped, sBand.total) : 'n/a'}
                delta={{
                    tone: 'neutral',
                    value: sBand
                        ? `${sBand.shipped}/${sBand.total} of top tier`
                        : 'Inventory pending',
                }}
            />
            <StatCard
                icon={Layers}
                label="B-band shipped"
                value={bBand ? pct(bBand.shipped, bBand.total) : 'n/a'}
                delta={{
                    tone: 'neutral',
                    value: bBand
                        ? `${bBand.shipped}/${bBand.total} of mid tier`
                        : 'Inventory pending',
                }}
            />
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
            ? stubsOnly.filter(
                  (r) =>
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
            <EmptyState
                icon={Cog}
                title="No nodes recorded"
                description="Inventory may not yet be generated."
                size="sm"
            />
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-3">
                <div className="flex-1 max-w-md">
                    <Field label="Filter stubs">
                        <Input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Filter by node type or file path"
                            iconLeft={Filter}
                        />
                    </Field>
                </div>
                <span className="text-xs text-[var(--st-text-secondary)] self-end pb-2">
                    {filtered.length} of {rows.length} shown
                </span>
            </div>

            <div className="overflow-x-auto rounded-[var(--st-radius-lg)] border border-[var(--st-border)]">
                <Table density="compact" hover>
                    <THead>
                        <Tr>
                            <Th>Node type</Th>
                            <Th>Complexity</Th>
                            <Th>Forge fallback</Th>
                            <Th>Last touched</Th>
                            <Th>File</Th>
                        </Tr>
                    </THead>
                    <TBody>
                        {filtered.length === 0 ? (
                            <Tr>
                                <Td colSpan={5} align="center">
                                    <span className="text-[var(--st-text-secondary)]">
                                        No matches.
                                    </span>
                                </Td>
                            </Tr>
                        ) : (
                            filtered.map((r) => (
                                <Tr key={r.nodeType}>
                                    <Td>
                                        <span className="font-mono text-xs text-[var(--st-text)]">
                                            {r.nodeType}
                                        </span>
                                    </Td>
                                    <Td>
                                        <ComplexityPill value={r.complexityHint} />
                                    </Td>
                                    <Td>
                                        {r.hasForgeFallback ? (
                                            <Badge tone="success">Masked</Badge>
                                        ) : (
                                            <Badge tone="warning">Open</Badge>
                                        )}
                                    </Td>
                                    <Td>
                                        <span className="text-xs text-[var(--st-text-secondary)]">
                                            {r.lastTouched
                                                ? new Date(r.lastTouched)
                                                      .toISOString()
                                                      .slice(0, 10)
                                                : 'n/a'}
                                        </span>
                                    </Td>
                                    <Td>
                                        <span className="font-mono text-[11px] text-[var(--st-text-secondary)]">
                                            {r.file ?? 'n/a'}
                                        </span>
                                    </Td>
                                </Tr>
                            ))
                        )}
                    </TBody>
                </Table>
            </div>
        </div>
    );
}

function ComplexityPill({ value }: { value?: string }) {
    const v = (value ?? 'low').toLowerCase();
    const tone =
        v === 'high' ? 'danger' : v === 'medium' ? 'warning' : 'neutral';
    return (
        <Badge tone={tone} kind="outline">
            {v}
        </Badge>
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
            <EmptyState
                icon={Boxes}
                title="No missing integrations recorded"
                size="sm"
            />
        );
    }

    return (
        <Accordion type="multiple" className="space-y-2">
            {grouped.map(([category, items]) => (
                <CategoryGroup
                    key={category}
                    category={category}
                    items={items}
                />
            ))}
        </Accordion>
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
        <AccordionItem
            value={category}
            className="rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]"
            onClick={() => setOpen((prev) => !prev)}
        >
            <AccordionTrigger>
                <span className="flex w-full items-center justify-between gap-3">
                    <span className="text-sm font-medium text-[var(--st-text)]">
                        {category}
                    </span>
                    <Badge tone="neutral">{items.length} missing</Badge>
                </span>
            </AccordionTrigger>
            <AccordionContent>
                <ul className="divide-y divide-[var(--st-border)]">
                    {shown.map((row) => (
                        <li
                            key={row.nodeType}
                            className="grid grid-cols-1 gap-1 py-2 text-xs md:grid-cols-3"
                        >
                            <span className="font-mono text-[var(--st-text)]">
                                {row.nodeType}
                            </span>
                            <span className="text-[var(--st-text-secondary)]">
                                {row.displayName ?? 'n/a'}
                            </span>
                            <span className="text-[var(--st-text-tertiary)]">
                                {row.credentialTypes?.length
                                    ? `creds: ${row.credentialTypes.join(', ')}`
                                    : 'no credential'}
                            </span>
                        </li>
                    ))}
                    {!open && overflow > 0 ? (
                        <li className="py-2 text-xs text-[var(--st-text-tertiary)]">
                            +{overflow} more, expand to view.
                        </li>
                    ) : null}
                </ul>
            </AccordionContent>
        </AccordionItem>
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
            <EmptyState
                icon={BarChart3}
                title="No priority data recorded yet"
                size="sm"
            />
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
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-[var(--st-radius-sm)] border border-[var(--st-border)] font-mono font-semibold text-[var(--st-text)]">
                                    {band}
                                </span>
                                <span className="text-[var(--st-text-secondary)]">
                                    {s.total} nodes
                                </span>
                            </div>
                            <span className="text-[var(--st-text-tertiary)]">
                                {s.shipped} shipped, {s.pending} pending
                            </span>
                        </div>
                        <div
                            className="relative h-3 overflow-hidden rounded-[var(--st-radius-pill)] bg-[var(--st-bg-muted)]"
                            style={{ width: `${Math.max(widthPct, 5)}%` }}
                        >
                            <div
                                className="h-full bg-[var(--st-accent)]"
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
            description="Markdown rendered as plain text. Install react-markdown to upgrade once it ships in package.json."
            result={result}
        >
            {result.status === 'ok' ? (
                <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4 font-mono text-xs leading-relaxed text-[var(--st-text)]">
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
        <Card variant="outlined" padding="lg">
            <CardHeader>
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                        <span
                            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg-muted)]"
                            aria-hidden="true"
                        >
                            <Icon className="h-4 w-4 text-[var(--st-text-secondary)]" />
                        </span>
                        <div>
                            <CardTitle>{title}</CardTitle>
                            <CardDescription>{description}</CardDescription>
                        </div>
                    </div>
                    <StatusPill result={result} />
                </div>
            </CardHeader>
            <CardBody>
                {result.status === 'ok' ? (
                    children
                ) : (
                    <InventoryPendingBanner result={result} />
                )}
            </CardBody>
        </Card>
    );
}

function StatusPill({ result }: { result: LoadResult<unknown> }) {
    if (result.status === 'ok') {
        return <Badge tone="success">Loaded</Badge>;
    }
    if (result.status === 'missing') {
        return <Badge tone="warning">Pending</Badge>;
    }
    return <Badge tone="danger">Error</Badge>;
}

function InventoryPendingBanner({ result }: { result: LoadResult<unknown> }) {
    const isError = result.status === 'error';
    return (
        <Alert
            tone={isError ? 'danger' : 'warning'}
            icon={isError ? FileWarning : AlertTriangle}
            title={isError ? 'Inventory failed to load' : 'Inventory pending'}
        >
            <div className="space-y-1">
                <div className="font-mono text-[11px] text-[var(--st-text-secondary)]">
                    {result.path}
                </div>
                {result.status === 'error' ? (
                    <div className="text-xs">{result.message}</div>
                ) : (
                    <div className="text-xs">
                        Awaiting sibling Phase C.1 sub-task to publish this
                        file. Re-run the inventory script or wait for CI.
                    </div>
                )}
            </div>
        </Alert>
    );
}
