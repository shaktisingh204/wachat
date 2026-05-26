/**
 * SabChat Reports — server-rendered analytics dashboard.
 *
 * Reads from the `sabchat-reports` Rust crate (`/v1/sabchat/reports/*`)
 * in parallel and renders five KPI cards, a response-times card, an inbox
 * queue card, an agent leaderboard table, an inbox rollup table, a channel
 * rollup table, and a CSAT card. MVP — numbers + tables only, no charts.
 */
import {
    Card,
    ZoruCardContent,
    ZoruCardDescription,
    ZoruCardHeader,
    ZoruCardTitle,
    Badge,
    Separator,
} from '@/components/zoruui';
import {
    getByAgent,
    getByChannel,
    getByInbox,
    getCsat,
    getLive,
    getResponseTimes,
} from '@/app/actions/sabchat-reports.actions';
import type {
    AgentRow,
    ChannelRow,
    CsatStats,
    InboxRow,
    LiveReport,
    ResponseTimes,
} from '@/lib/rust-client/sabchat-reports';

export const dynamic = 'force-dynamic';

type Result<T> = T | { error: string };

function isError<T>(r: Result<T>): r is { error: string } {
    return typeof r === 'object' && r !== null && 'error' in (r as { error?: unknown });
}

function fmtNum(n: number | undefined | null): string {
    if (n === undefined || n === null || Number.isNaN(n)) return '—';
    return new Intl.NumberFormat('en-US').format(n);
}

function fmtMinutes(n: number | undefined | null): string {
    if (n === undefined || n === null || Number.isNaN(n)) return '—';
    if (n < 1) return `${Math.round(n * 60)}s`;
    if (n < 60) return `${n.toFixed(1)}m`;
    const h = Math.floor(n / 60);
    const m = Math.round(n % 60);
    return `${h}h ${m}m`;
}

function defaultWindow(): { from: string; to: string } {
    const now = new Date();
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { from: from.toISOString(), to: now.toISOString() };
}

// ---------------------------------------------------------------------------
// KPI tile
// ---------------------------------------------------------------------------

function Kpi({
    label,
    value,
    sub,
    tone,
}: {
    label: string;
    value: string;
    sub?: string;
    tone?: 'default' | 'danger' | 'warning' | 'ok';
}) {
    const toneClass =
        tone === 'danger'
            ? 'text-red-500'
            : tone === 'warning'
              ? 'text-amber-500'
              : tone === 'ok'
                ? 'text-emerald-500'
                : 'text-foreground';
    return (
        <Card>
            <ZoruCardHeader className="pb-2">
                <ZoruCardDescription className="text-xs uppercase tracking-wide">
                    {label}
                </ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent>
                <div className={`text-3xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
                {sub ? (
                    <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
                ) : null}
            </ZoruCardContent>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function SabChatReportsPage({
    searchParams,
}: {
    searchParams: Promise<{ from?: string; to?: string }>;
}) {
    const sp = await searchParams;
    const win = {
        from: sp.from ?? defaultWindow().from,
        to: sp.to ?? defaultWindow().to,
    };

    const [live, rtimes, agents, inboxes, channels, csat] = await Promise.all([
        getLive(),
        getResponseTimes(win),
        getByAgent(win),
        getByInbox(win),
        getByChannel(win),
        getCsat(win),
    ]) as [
        Result<LiveReport>,
        Result<ResponseTimes>,
        Result<AgentRow[]>,
        Result<InboxRow[]>,
        Result<ChannelRow[]>,
        Result<CsatStats>,
    ];

    const liveOk = !isError(live) ? live : null;
    const rtimesOk = !isError(rtimes) ? rtimes : null;
    const agentsOk = !isError(agents) ? agents : [];
    const inboxesOk = !isError(inboxes) ? inboxes : [];
    const channelsOk = !isError(channels) ? channels : [];
    const csatOk = !isError(csat) ? csat : null;

    const anyError =
        isError(live) ||
        isError(rtimes) ||
        isError(agents) ||
        isError(inboxes) ||
        isError(channels) ||
        isError(csat);

    const windowLabel = (() => {
        try {
            const from = new Date(win.from);
            const to = new Date(win.to);
            const fmt = (d: Date) =>
                d.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                });
            return `${fmt(from)} → ${fmt(to)}`;
        } catch {
            return 'last 7 days';
        }
    })();

    return (
        <div className="zoruui flex flex-col gap-4 p-4">
            <Card>
                <ZoruCardHeader>
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <ZoruCardTitle>SabChat — Reports</ZoruCardTitle>
                            <ZoruCardDescription>
                                Live queue, response-time SLAs, agent leaderboard, and channel
                                rollups for <span className="font-medium">{windowLabel}</span>.
                            </ZoruCardDescription>
                        </div>
                        {anyError ? (
                            <Badge variant="outline" className="border-amber-500 text-amber-500">
                                Partial data
                            </Badge>
                        ) : null}
                    </div>
                </ZoruCardHeader>
            </Card>

            {/* Top row — live KPIs */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <Kpi label="Open" value={fmtNum(liveOk?.openCount ?? 0)} />
                <Kpi
                    label="Pending"
                    value={fmtNum(liveOk?.pendingCount ?? 0)}
                    tone={liveOk && liveOk.pendingCount > 0 ? 'warning' : 'default'}
                />
                <Kpi label="Snoozed" value={fmtNum(liveOk?.snoozedCount ?? 0)} />
                <Kpi
                    label="SLA breached"
                    value={fmtNum(liveOk?.slaBreachedCount ?? 0)}
                    tone={liveOk && liveOk.slaBreachedCount > 0 ? 'danger' : 'ok'}
                />
                <Kpi
                    label="Longest wait"
                    value={fmtMinutes(liveOk?.longestWaitMinutes)}
                    tone={
                        liveOk && liveOk.longestWaitMinutes >= 60
                            ? 'danger'
                            : liveOk && liveOk.longestWaitMinutes >= 15
                              ? 'warning'
                              : 'default'
                    }
                />
            </div>

            {/* Middle row — response times + inbox queue */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Response times</ZoruCardTitle>
                        <ZoruCardDescription>
                            First-response latency (minutes) over the selected window.
                        </ZoruCardDescription>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        {rtimesOk ? (
                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                                <Stat label="Count" value={fmtNum(rtimesOk.count)} />
                                <Stat label="Mean" value={fmtMinutes(rtimesOk.mean)} />
                                <Stat label="p50" value={fmtMinutes(rtimesOk.p50)} />
                                <Stat label="p95" value={fmtMinutes(rtimesOk.p95)} />
                                <Stat label="p99" value={fmtMinutes(rtimesOk.p99)} />
                            </div>
                        ) : (
                            <EmptyHint message="Response-time data unavailable." />
                        )}
                    </ZoruCardContent>
                </Card>

                <Card>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Queue by inbox</ZoruCardTitle>
                        <ZoruCardDescription>Open + pending, right now.</ZoruCardDescription>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        {liveOk && liveOk.queueByInbox.length > 0 ? (
                            <SimpleTable
                                head={['Inbox', 'Open']}
                                rows={liveOk.queueByInbox.map((r) => [
                                    <span key="n" className="truncate">
                                        {r.name}
                                    </span>,
                                    <span key="c" className="tabular-nums">
                                        {fmtNum(r.count)}
                                    </span>,
                                ])}
                            />
                        ) : (
                            <EmptyHint message="No active queue right now." />
                        )}
                    </ZoruCardContent>
                </Card>
            </div>

            {/* Bottom row — agent / inbox / channel / csat */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Card>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Agent leaderboard</ZoruCardTitle>
                        <ZoruCardDescription>
                            {agentsOk.length} agent{agentsOk.length === 1 ? '' : 's'} in window.
                        </ZoruCardDescription>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        {agentsOk.length > 0 ? (
                            <SimpleTable
                                head={['Agent', 'Handled', 'Avg 1st', 'Resolved', 'Open']}
                                rows={agentsOk.map((a) => [
                                    <span key="id" className="font-mono text-xs">
                                        {a.agentId.slice(-8)}
                                    </span>,
                                    <span key="h" className="tabular-nums">
                                        {fmtNum(a.conversationsHandled)}
                                    </span>,
                                    <span key="f" className="tabular-nums">
                                        {fmtMinutes(a.avgFirstResponseMin)}
                                    </span>,
                                    <span key="r" className="tabular-nums">
                                        {fmtNum(a.resolvedCount)}
                                    </span>,
                                    <span key="o" className="tabular-nums">
                                        {fmtNum(a.openCount)}
                                    </span>,
                                ])}
                            />
                        ) : (
                            <EmptyHint message="No agent activity in window." />
                        )}
                    </ZoruCardContent>
                </Card>

                <Card>
                    <ZoruCardHeader>
                        <ZoruCardTitle>By inbox</ZoruCardTitle>
                        <ZoruCardDescription>
                            {inboxesOk.length} inbox{inboxesOk.length === 1 ? '' : 'es'}.
                        </ZoruCardDescription>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        {inboxesOk.length > 0 ? (
                            <SimpleTable
                                head={['Inbox', 'Channel', 'Created', 'Sent', 'Avg 1st', 'Resolved']}
                                rows={inboxesOk.map((i) => [
                                    <span key="n" className="truncate">
                                        {i.name}
                                    </span>,
                                    <Badge key="c" variant="outline">
                                        {i.channelType}
                                    </Badge>,
                                    <span key="cv" className="tabular-nums">
                                        {fmtNum(i.conversationsCreated)}
                                    </span>,
                                    <span key="s" className="tabular-nums">
                                        {fmtNum(i.messagesSent)}
                                    </span>,
                                    <span key="f" className="tabular-nums">
                                        {fmtMinutes(i.avgFirstResponseMin)}
                                    </span>,
                                    <span key="r" className="tabular-nums">
                                        {fmtNum(i.resolvedCount)}
                                    </span>,
                                ])}
                            />
                        ) : (
                            <EmptyHint message="No inbox activity in window." />
                        )}
                    </ZoruCardContent>
                </Card>

                <Card>
                    <ZoruCardHeader>
                        <ZoruCardTitle>By channel</ZoruCardTitle>
                        <ZoruCardDescription>
                            Rolled up across all inboxes by channel type.
                        </ZoruCardDescription>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        {channelsOk.length > 0 ? (
                            <SimpleTable
                                head={['Channel', 'Created', 'Sent', 'Resolved']}
                                rows={channelsOk.map((c) => [
                                    <Badge key="c" variant="outline">
                                        {c.channelType}
                                    </Badge>,
                                    <span key="cv" className="tabular-nums">
                                        {fmtNum(c.conversationsCreated)}
                                    </span>,
                                    <span key="s" className="tabular-nums">
                                        {fmtNum(c.messagesSent)}
                                    </span>,
                                    <span key="r" className="tabular-nums">
                                        {fmtNum(c.resolvedCount)}
                                    </span>,
                                ])}
                            />
                        ) : (
                            <EmptyHint message="No channel activity in window." />
                        )}
                    </ZoruCardContent>
                </Card>

                <Card>
                    <ZoruCardHeader>
                        <ZoruCardTitle>CSAT</ZoruCardTitle>
                        <ZoruCardDescription>
                            Customer satisfaction ratings collected in window.
                        </ZoruCardDescription>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        {csatOk && csatOk.count > 0 ? (
                            <div className="flex flex-col gap-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <Stat label="Responses" value={fmtNum(csatOk.count)} />
                                    <Stat
                                        label="Mean"
                                        value={
                                            csatOk.mean !== undefined
                                                ? csatOk.mean.toFixed(2)
                                                : '—'
                                        }
                                    />
                                </div>
                                {csatOk.distribution &&
                                Object.keys(csatOk.distribution).length > 0 ? (
                                    <>
                                        <Separator />
                                        <div className="flex flex-col gap-2">
                                            {Object.entries(csatOk.distribution)
                                                .sort(([a], [b]) => a.localeCompare(b))
                                                .map(([rating, count]) => {
                                                    const pct =
                                                        csatOk.count > 0
                                                            ? (count / csatOk.count) * 100
                                                            : 0;
                                                    return (
                                                        <div
                                                            key={rating}
                                                            className="flex items-center gap-3 text-sm"
                                                        >
                                                            <span className="w-8 font-mono">
                                                                {rating}
                                                            </span>
                                                            <div className="h-2 flex-1 overflow-hidden rounded bg-muted">
                                                                <div
                                                                    className="h-full bg-primary"
                                                                    style={{
                                                                        width: `${pct.toFixed(1)}%`,
                                                                    }}
                                                                />
                                                            </div>
                                                            <span className="w-12 text-right tabular-nums text-muted-foreground">
                                                                {fmtNum(count)}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    </>
                                ) : null}
                            </div>
                        ) : (
                            <EmptyHint message="No CSAT responses in window." />
                        )}
                    </ZoruCardContent>
                </Card>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Helpers — small presentational subcomponents (server, no client state)
// ---------------------------------------------------------------------------

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
            <span className="text-xl font-semibold tabular-nums">{value}</span>
        </div>
    );
}

function EmptyHint({ message }: { message: string }) {
    return (
        <div className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
            {message}
        </div>
    );
}

function SimpleTable({
    head,
    rows,
}: {
    head: React.ReactNode[];
    rows: React.ReactNode[][];
}) {
    return (
        <div className="overflow-x-auto rounded border bg-card">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        {head.map((h, i) => (
                            <th key={i} className="px-3 py-2 font-medium">
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr
                            key={i}
                            className="border-b last:border-b-0 hover:bg-muted/20"
                        >
                            {row.map((cell, j) => (
                                <td key={j} className="px-3 py-2 align-middle">
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
