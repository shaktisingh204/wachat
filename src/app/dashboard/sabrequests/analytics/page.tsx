/**
 * `/dashboard/requests/analytics` — SLA + decision-time dashboard.
 *
 * Pure server-rendered card grid driven by `getRequestsAnalytics`.
 */
import * as React from 'react';

import { Badge, Card } from '@/components/zoruui';
import { getRequestsAnalytics } from '@/app/actions/sabrequests.actions';

export const dynamic = 'force-dynamic';

function pct(n: number) {
    return `${Math.round(n * 1000) / 10}%`;
}

export default async function RequestsAnalyticsPage() {
    const res = await getRequestsAnalytics();
    const a = res.data;
    if (!a) {
        return (
            <div className="zoruui p-6">
                <Card className="p-8 text-center text-sm text-muted-foreground">
                    {res.error ?? 'No analytics available yet.'}
                </Card>
            </div>
        );
    }
    return (
        <div className="zoruui flex flex-col gap-6 p-6">
            <header>
                <h1 className="text-2xl font-semibold">Request analytics</h1>
                <p className="text-sm text-muted-foreground">
                    SLA breach rate, decision time, and bottleneck stages.
                </p>
            </header>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {(['pending', 'approved', 'rejected', 'cancelled'] as const).map(
                    (k) => (
                        <Card key={k} className="p-4">
                            <div className="text-xs uppercase tracking-wide text-muted-foreground">
                                {k}
                            </div>
                            <div className="text-2xl font-semibold">
                                {a.totals[k]}
                            </div>
                        </Card>
                    ),
                )}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Card className="p-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        SLA breach rate
                    </div>
                    <div className="text-3xl font-semibold">
                        {pct(a.slaBreachRate)}
                    </div>
                </Card>
                <Card className="p-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        Average decision time
                    </div>
                    <div className="text-3xl font-semibold">
                        {a.avgDecisionMinutes != null
                            ? `${Math.round(a.avgDecisionMinutes)} min`
                            : '—'}
                    </div>
                </Card>
            </div>

            <Card className="p-4">
                <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                    By blueprint
                </h2>
                {a.byBlueprint.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No data.</div>
                ) : (
                    <ul className="divide-y divide-border">
                        {a.byBlueprint.map((b) => (
                            <li
                                key={b.blueprintId}
                                className="flex items-center justify-between py-2"
                            >
                                <div>
                                    <div className="text-sm font-medium">
                                        {b.blueprintName ?? '—'}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {b.count} requests
                                    </div>
                                </div>
                                <Badge
                                    variant={
                                        b.breachedCount > 0
                                            ? 'destructive'
                                            : 'outline'
                                    }
                                >
                                    {b.breachedCount} breached
                                </Badge>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            <Card className="p-4">
                <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                    Bottleneck stages
                </h2>
                {a.bottleneckStages.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                        Nothing waiting.
                    </div>
                ) : (
                    <ul className="divide-y divide-border">
                        {a.bottleneckStages.map((s, i) => (
                            <li
                                key={i}
                                className="flex items-center justify-between py-2"
                            >
                                <div>
                                    <div className="text-sm font-medium">
                                        {s.blueprintName ?? '—'} · stage{' '}
                                        {s.stageIdx + 1}
                                        {s.stageName ? ` (${s.stageName})` : ''}
                                    </div>
                                </div>
                                <Badge>{s.pendingCount} pending</Badge>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>
        </div>
    );
}
