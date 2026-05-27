import * as React from 'react';

import { Card, CardContent } from '@/components/zoruui';

import { listSabmonitorIncidents } from '@/app/actions/sabmonitor.actions';
import { StatusBadge } from '../_components/status-badge';
import { IncidentActions } from '../_components/incident-actions';

export const dynamic = 'force-dynamic';

interface PageProps {
    searchParams: Promise<{ status?: string }>;
}

export default async function SabmonitorIncidentsPage({
    searchParams,
}: PageProps): Promise<React.JSX.Element> {
    const sp = await searchParams;
    const status = (sp.status as 'ongoing' | 'resolved' | 'all') ?? 'all';
    const res = await listSabmonitorIncidents({ status, limit: 100 });

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zoru-ink">Incidents</h2>
                <form className="flex items-center gap-2 text-[12px]">
                    <label htmlFor="status" className="text-zoru-ink-muted">
                        Filter
                    </label>
                    <select
                        id="status"
                        name="status"
                        defaultValue={status}
                        className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-2 py-1 text-sm"
                    >
                        <option value="all">All</option>
                        <option value="ongoing">Ongoing</option>
                        <option value="resolved">Resolved</option>
                    </select>
                    <button
                        type="submit"
                        className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-2 py-1 text-sm"
                    >
                        Apply
                    </button>
                </form>
            </div>
            <Card className="zoruui">
                <CardContent className="p-0">
                    {res.items.length === 0 ? (
                        <p className="p-4 text-sm text-zoru-ink-muted">No incidents.</p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                                <tr className="border-b border-zoru-line">
                                    <th className="p-3 text-left font-medium">Started</th>
                                    <th className="p-3 text-left font-medium">Check</th>
                                    <th className="p-3 text-left font-medium">Severity</th>
                                    <th className="p-3 text-left font-medium">Status</th>
                                    <th className="p-3 text-left font-medium">Downtime</th>
                                    <th className="p-3 text-right font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {res.items.map((i) => (
                                    <tr key={i._id} className="border-b border-zoru-line">
                                        <td className="p-3 text-zoru-ink-muted">
                                            {new Date(i.startedAt).toLocaleString()}
                                        </td>
                                        <td className="p-3 text-zoru-ink-muted">{i.checkId}</td>
                                        <td className="p-3 uppercase text-zoru-ink-muted">{i.severity}</td>
                                        <td className="p-3">
                                            <StatusBadge status={i.status} />
                                        </td>
                                        <td className="p-3 text-zoru-ink-muted">
                                            {i.downtimeSecs ? `${i.downtimeSecs}s` : '—'}
                                        </td>
                                        <td className="p-3 text-right">
                                            {i._id && <IncidentActions incident={i} />}
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
