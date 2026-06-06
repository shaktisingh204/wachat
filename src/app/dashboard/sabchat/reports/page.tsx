/**
 * SabChat Reports. Server-rendered analytics dashboard.
 *
 * Reads from the `sabchat-reports` Rust crate (`/v1/sabchat/reports/*`)
 * in parallel and renders five KPI cards, a response-times card, an inbox
 * queue card, an agent leaderboard table, an inbox rollup table, a channel
 * rollup table, and a CSAT card. MVP, numbers + tables only, no charts.
 */
import {
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    CardDescription,
    StatCard,
    Badge,
    Separator,
    EmptyState,
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
    PageActions,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
} from '@/components/sabcrm/20ui';
import { BarChart3, Inbox } from 'lucide-react';
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
    if (n === undefined || n === null || Number.isNaN(n)) return '-';
    return new Intl.NumberFormat('en-US').format(n);
}

function fmtMinutes(n: number | undefined | null): string {
    if (n === undefined || n === null || Number.isNaN(n)) return '-';
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

    const [live, rtimes, agents, inboxes, channels, csat] = (await Promise.all([
        getLive(),
        getResponseTimes(win),
        getByAgent(win),
        getByInbox(win),
        getByChannel(win),
        getCsat(win),
    ])) as [
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
            return `${fmt(from)} to ${fmt(to)}`;
        } catch {
            return 'last 7 days';
        }
    })();

    return (
        <div className="flex flex-col gap-4 p-4">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>SabChat</PageEyebrow>
                    <PageTitle>Reports</PageTitle>
                    <PageDescription>
                        Live queue, response-time SLAs, agent leaderboard, and channel rollups for{' '}
                        <span className="font-medium text-[var(--st-text)]">{windowLabel}</span>.
                    </PageDescription>
                </PageHeaderHeading>
                {anyError ? (
                    <PageActions>
                        <Badge tone="warning">Partial data</Badge>
                    </PageActions>
                ) : null}
            </PageHeader>

            {/* Top row, live KPIs */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <StatCard label="Open" value={fmtNum(liveOk?.openCount ?? 0)} />
                <StatCard label="Pending" value={fmtNum(liveOk?.pendingCount ?? 0)} />
                <StatCard label="Snoozed" value={fmtNum(liveOk?.snoozedCount ?? 0)} />
                <StatCard label="SLA breached" value={fmtNum(liveOk?.slaBreachedCount ?? 0)} />
                <StatCard label="Longest wait" value={fmtMinutes(liveOk?.longestWaitMinutes)} />
            </div>

            {/* Middle row, response times + inbox queue */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Response times</CardTitle>
                        <CardDescription>
                            First-response latency (minutes) over the selected window.
                        </CardDescription>
                    </CardHeader>
                    <CardBody>
                        {rtimesOk ? (
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                                <StatCard label="Count" value={fmtNum(rtimesOk.count)} />
                                <StatCard label="Mean" value={fmtMinutes(rtimesOk.mean)} />
                                <StatCard label="p50" value={fmtMinutes(rtimesOk.p50)} />
                                <StatCard label="p95" value={fmtMinutes(rtimesOk.p95)} />
                                <StatCard label="p99" value={fmtMinutes(rtimesOk.p99)} />
                            </div>
                        ) : (
                            <EmptyState
                                icon={BarChart3}
                                size="sm"
                                title="No response-time data"
                                description="Response-time data is unavailable for this window."
                            />
                        )}
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Queue by inbox</CardTitle>
                        <CardDescription>Open + pending, right now.</CardDescription>
                    </CardHeader>
                    <CardBody>
                        {liveOk && liveOk.queueByInbox.length > 0 ? (
                            <Table density="compact">
                                <THead>
                                    <Tr>
                                        <Th>Inbox</Th>
                                        <Th align="right">Open</Th>
                                    </Tr>
                                </THead>
                                <TBody>
                                    {liveOk.queueByInbox.map((r) => (
                                        <Tr key={r.name}>
                                            <Td truncate>{r.name}</Td>
                                            <Td align="right" className="tabular-nums">
                                                {fmtNum(r.count)}
                                            </Td>
                                        </Tr>
                                    ))}
                                </TBody>
                            </Table>
                        ) : (
                            <EmptyState
                                icon={Inbox}
                                size="sm"
                                title="No active queue"
                                description="There is nothing waiting right now."
                            />
                        )}
                    </CardBody>
                </Card>
            </div>

            {/* Bottom row, agent / inbox / channel / csat */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Agent leaderboard</CardTitle>
                        <CardDescription>
                            {agentsOk.length} agent{agentsOk.length === 1 ? '' : 's'} in window.
                        </CardDescription>
                    </CardHeader>
                    <CardBody>
                        {agentsOk.length > 0 ? (
                            <Table density="compact">
                                <THead>
                                    <Tr>
                                        <Th>Agent</Th>
                                        <Th align="right">Handled</Th>
                                        <Th align="right">Avg 1st</Th>
                                        <Th align="right">Resolved</Th>
                                        <Th align="right">Open</Th>
                                    </Tr>
                                </THead>
                                <TBody>
                                    {agentsOk.map((a) => (
                                        <Tr key={a.agentId}>
                                            <Td className="font-mono text-xs">
                                                {a.agentId.slice(-8)}
                                            </Td>
                                            <Td align="right" className="tabular-nums">
                                                {fmtNum(a.conversationsHandled)}
                                            </Td>
                                            <Td align="right" className="tabular-nums">
                                                {fmtMinutes(a.avgFirstResponseMin)}
                                            </Td>
                                            <Td align="right" className="tabular-nums">
                                                {fmtNum(a.resolvedCount)}
                                            </Td>
                                            <Td align="right" className="tabular-nums">
                                                {fmtNum(a.openCount)}
                                            </Td>
                                        </Tr>
                                    ))}
                                </TBody>
                            </Table>
                        ) : (
                            <EmptyState
                                icon={BarChart3}
                                size="sm"
                                title="No agent activity"
                                description="No agents handled conversations in this window."
                            />
                        )}
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>By inbox</CardTitle>
                        <CardDescription>
                            {inboxesOk.length} inbox{inboxesOk.length === 1 ? '' : 'es'}.
                        </CardDescription>
                    </CardHeader>
                    <CardBody>
                        {inboxesOk.length > 0 ? (
                            <Table density="compact">
                                <THead>
                                    <Tr>
                                        <Th>Inbox</Th>
                                        <Th>Channel</Th>
                                        <Th align="right">Created</Th>
                                        <Th align="right">Sent</Th>
                                        <Th align="right">Avg 1st</Th>
                                        <Th align="right">Resolved</Th>
                                    </Tr>
                                </THead>
                                <TBody>
                                    {inboxesOk.map((i) => (
                                        <Tr key={i.name}>
                                            <Td truncate>{i.name}</Td>
                                            <Td>
                                                <Badge variant="outline">{i.channelType}</Badge>
                                            </Td>
                                            <Td align="right" className="tabular-nums">
                                                {fmtNum(i.conversationsCreated)}
                                            </Td>
                                            <Td align="right" className="tabular-nums">
                                                {fmtNum(i.messagesSent)}
                                            </Td>
                                            <Td align="right" className="tabular-nums">
                                                {fmtMinutes(i.avgFirstResponseMin)}
                                            </Td>
                                            <Td align="right" className="tabular-nums">
                                                {fmtNum(i.resolvedCount)}
                                            </Td>
                                        </Tr>
                                    ))}
                                </TBody>
                            </Table>
                        ) : (
                            <EmptyState
                                icon={Inbox}
                                size="sm"
                                title="No inbox activity"
                                description="No inbox saw activity in this window."
                            />
                        )}
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>By channel</CardTitle>
                        <CardDescription>
                            Rolled up across all inboxes by channel type.
                        </CardDescription>
                    </CardHeader>
                    <CardBody>
                        {channelsOk.length > 0 ? (
                            <Table density="compact">
                                <THead>
                                    <Tr>
                                        <Th>Channel</Th>
                                        <Th align="right">Created</Th>
                                        <Th align="right">Sent</Th>
                                        <Th align="right">Resolved</Th>
                                    </Tr>
                                </THead>
                                <TBody>
                                    {channelsOk.map((c) => (
                                        <Tr key={c.channelType}>
                                            <Td>
                                                <Badge variant="outline">{c.channelType}</Badge>
                                            </Td>
                                            <Td align="right" className="tabular-nums">
                                                {fmtNum(c.conversationsCreated)}
                                            </Td>
                                            <Td align="right" className="tabular-nums">
                                                {fmtNum(c.messagesSent)}
                                            </Td>
                                            <Td align="right" className="tabular-nums">
                                                {fmtNum(c.resolvedCount)}
                                            </Td>
                                        </Tr>
                                    ))}
                                </TBody>
                            </Table>
                        ) : (
                            <EmptyState
                                icon={BarChart3}
                                size="sm"
                                title="No channel activity"
                                description="No channel saw activity in this window."
                            />
                        )}
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>CSAT</CardTitle>
                        <CardDescription>
                            Customer satisfaction ratings collected in window.
                        </CardDescription>
                    </CardHeader>
                    <CardBody>
                        {csatOk && csatOk.count > 0 ? (
                            <div className="flex flex-col gap-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <StatCard label="Responses" value={fmtNum(csatOk.count)} />
                                    <StatCard
                                        label="Mean"
                                        value={
                                            csatOk.mean !== undefined ? csatOk.mean.toFixed(2) : '-'
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
                                                            className="flex items-center gap-3 text-sm text-[var(--st-text)]"
                                                        >
                                                            <span className="w-8 font-mono">
                                                                {rating}
                                                            </span>
                                                            <div className="h-2 flex-1 overflow-hidden rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)]">
                                                                <div
                                                                    className="h-full rounded-[var(--st-radius-sm)] bg-[var(--st-accent)]"
                                                                    style={{
                                                                        width: `${pct.toFixed(1)}%`,
                                                                    }}
                                                                />
                                                            </div>
                                                            <span className="w-12 text-right tabular-nums text-[var(--st-text-secondary)]">
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
                            <EmptyState
                                icon={BarChart3}
                                size="sm"
                                title="No CSAT responses"
                                description="No customer ratings were collected in this window."
                            />
                        )}
                    </CardBody>
                </Card>
            </div>
        </div>
    );
}
