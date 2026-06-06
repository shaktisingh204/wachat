import * as React from 'react';
import Link from 'next/link';

import { Card, CardBody } from '@/components/sabcrm/20ui';

import {
    listSabmonitorChecks,
    listSabmonitorIncidents,
} from '@/app/actions/sabmonitor.actions';
import { StatusBadge } from './_components/status-badge';

export const dynamic = 'force-dynamic';

export default async function SabmonitorOverviewPage(): Promise<React.JSX.Element> {
    const [checksRes, ongoingRes] = await Promise.all([
        listSabmonitorChecks({ status: 'all', limit: 100 }),
        listSabmonitorIncidents({ status: 'ongoing', limit: 25 }),
    ]);

    const counts = { up: 0, down: 0, warning: 0, unknown: 0 };
    for (const c of checksRes.items) {
        const s = (c.lastStatus ?? 'unknown') as keyof typeof counts;
        counts[s] = (counts[s] ?? 0) + 1;
    }

    const stats: Array<{ label: string; value: number; tone: string }> = [
        { label: 'Up', value: counts.up, tone: 'text-[var(--st-text)]' },
        { label: 'Warning', value: counts.warning, tone: 'text-[var(--st-text)]' },
        { label: 'Down', value: counts.down, tone: 'text-[var(--st-text)]' },
        { label: 'Unknown', value: counts.unknown, tone: 'text-[var(--st-text-secondary)]' },
    ];

    return (
        <div className="flex flex-col gap-6">
            <div className="grid gap-3 md:grid-cols-4">
                {stats.map((s) => (
                    <Card key={s.label} className="zoruui">
                        <CardBody className="flex flex-col gap-1 p-4">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                                {s.label}
                            </span>
                            <span className={`text-2xl font-semibold ${s.tone}`}>{s.value}</span>
                        </CardBody>
                    </Card>
                ))}
            </div>

            <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-[var(--st-text)]">Ongoing incidents</h2>
                    <Link
                        className="text-[12px] text-[var(--st-accent)] hover:underline"
                        href="/dashboard/sabmonitor/incidents"
                    >
                        View all
                    </Link>
                </div>
                <Card className="zoruui">
                    <CardBody className="p-0">
                        {ongoingRes.items.length === 0 ? (
                            <p className="p-4 text-sm text-[var(--st-text-secondary)]">
                                No ongoing incidents — every check is healthy.
                            </p>
                        ) : (
                            <ul className="divide-y divide-[var(--st-border)]">
                                {ongoingRes.items.map((i) => (
                                    <li key={i._id} className="flex items-center justify-between p-3">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-sm font-medium text-[var(--st-text)]">
                                                Check {i.checkId}
                                            </span>
                                            <span className="text-[12px] text-[var(--st-text-secondary)]">
                                                Started {new Date(i.startedAt).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <StatusBadge status="ongoing" />
                                            <span className="text-[12px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                                                {i.severity}
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardBody>
                </Card>
            </section>

            <section className="flex flex-col gap-3">
                <h2 className="text-sm font-semibold text-[var(--st-text)]">Slowest recent checks</h2>
                <Card className="zoruui">
                    <CardBody className="p-0">
                        {checksRes.items.length === 0 ? (
                            <p className="p-4 text-sm text-[var(--st-text-secondary)]">
                                No checks configured yet.{' '}
                                <Link
                                    className="text-[var(--st-accent)] hover:underline"
                                    href="/dashboard/sabmonitor/checks/new"
                                >
                                    Add your first check
                                </Link>
                                .
                            </p>
                        ) : (
                            <ul className="divide-y divide-[var(--st-border)]">
                                {checksRes.items.slice(0, 8).map((c) => (
                                    <li key={c._id} className="flex items-center justify-between p-3">
                                        <div className="flex flex-col gap-1">
                                            <Link
                                                className="text-sm font-medium text-[var(--st-text)] hover:underline"
                                                href={`/dashboard/sabmonitor/checks/${c._id}`}
                                            >
                                                {c.name}
                                            </Link>
                                            <span className="text-[12px] text-[var(--st-text-secondary)]">
                                                {c.kind} · {c.url ?? c.host ?? '—'}
                                            </span>
                                        </div>
                                        <StatusBadge status={c.lastStatus ?? 'unknown'} />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardBody>
                </Card>
            </section>
        </div>
    );
}
