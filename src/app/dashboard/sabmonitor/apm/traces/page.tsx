import * as React from 'react';
import Link from 'next/link';

import { Card, CardContent } from '@/components/zoruui';

import { listSabmonitorTraces } from '@/app/actions/sabmonitor.actions';

export const dynamic = 'force-dynamic';

interface PageProps {
    searchParams: Promise<{ erroredOnly?: string; slowMs?: string; service?: string }>;
}

export default async function ApmTracesPage({ searchParams }: PageProps): Promise<React.JSX.Element> {
    const sp = await searchParams;
    const res = await listSabmonitorTraces({
        erroredOnly: sp.erroredOnly === 'true',
        slowMs: sp.slowMs ? Number(sp.slowMs) : undefined,
        service: sp.service,
        limit: 100,
    });
    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zoru-ink">APM traces</h2>
                <form className="flex items-center gap-2 text-[12px]">
                    <label className="flex items-center gap-1 text-zoru-ink-muted">
                        <input
                            type="checkbox"
                            name="erroredOnly"
                            value="true"
                            defaultChecked={sp.erroredOnly === 'true'}
                        />
                        Errored only
                    </label>
                    <input
                        name="slowMs"
                        type="number"
                        defaultValue={sp.slowMs}
                        placeholder="slow ms"
                        className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-2 py-1"
                    />
                    <input
                        name="service"
                        defaultValue={sp.service}
                        placeholder="service"
                        className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-2 py-1"
                    />
                    <button
                        type="submit"
                        className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-2 py-1"
                    >
                        Filter
                    </button>
                </form>
            </div>
            <Card className="zoruui">
                <CardContent className="p-0">
                    {res.items.length === 0 ? (
                        <p className="p-4 text-sm text-zoru-ink-muted">No traces yet.</p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                                <tr className="border-b border-zoru-line">
                                    <th className="p-3 text-left font-medium">Started</th>
                                    <th className="p-3 text-left font-medium">Trace</th>
                                    <th className="p-3 text-left font-medium">Service</th>
                                    <th className="p-3 text-left font-medium">Operation</th>
                                    <th className="p-3 text-right font-medium">Duration</th>
                                    <th className="p-3 text-right font-medium">Spans</th>
                                    <th className="p-3 text-right font-medium">Errored</th>
                                </tr>
                            </thead>
                            <tbody>
                                {res.items.map((t) => (
                                    <tr key={t.traceId} className="border-b border-zoru-line">
                                        <td className="p-3 text-zoru-ink-muted">
                                            {t.startedAt ? new Date(t.startedAt).toLocaleString() : '—'}
                                        </td>
                                        <td className="p-3">
                                            <Link
                                                className="font-mono text-[12px] text-zoru-brand hover:underline"
                                                href={`/dashboard/sabmonitor/apm/traces/${t.traceId}`}
                                            >
                                                {t.traceId.slice(0, 16)}…
                                            </Link>
                                        </td>
                                        <td className="p-3 text-zoru-ink-muted">{t.rootService ?? '—'}</td>
                                        <td className="p-3 text-zoru-ink-muted">{t.rootOperation ?? '—'}</td>
                                        <td className="p-3 text-right text-zoru-ink-muted">{t.durationMs}ms</td>
                                        <td className="p-3 text-right text-zoru-ink-muted">{t.spanCount}</td>
                                        <td className="p-3 text-right">
                                            {t.errored ? (
                                                <span className="text-zoru-ink">error</span>
                                            ) : (
                                                <span className="text-zoru-ink">ok</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
