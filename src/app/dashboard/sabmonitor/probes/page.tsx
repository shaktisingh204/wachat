import * as React from 'react';

import { Card, CardContent } from '@/components/sabcrm/20ui/compat';

import { listSabmonitorProbes } from '@/app/actions/sabmonitor.actions';
import { StatusBadge } from '../_components/status-badge';

export const dynamic = 'force-dynamic';

export default async function ProbesPage(): Promise<React.JSX.Element> {
    const res = await listSabmonitorProbes();
    return (
        <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-zoru-ink">Probe agents</h2>
            <Card className="zoruui">
                <CardContent className="p-0">
                    {res.items.length === 0 ? (
                        <p className="p-4 text-sm text-zoru-ink-muted">
                            No probe agents registered. The probe runtime is using the
                            built-in <span className="font-medium">MockProbe</span> until
                            real agents are wired up.
                        </p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                                <tr className="border-b border-zoru-line">
                                    <th className="p-3 text-left font-medium">Region</th>
                                    <th className="p-3 text-left font-medium">Label</th>
                                    <th className="p-3 text-left font-medium">Status</th>
                                    <th className="p-3 text-left font-medium">Last seen</th>
                                    <th className="p-3 text-left font-medium">Version</th>
                                </tr>
                            </thead>
                            <tbody>
                                {res.items.map((p) => (
                                    <tr key={p._id} className="border-b border-zoru-line">
                                        <td className="p-3 font-medium text-zoru-ink">{p.region}</td>
                                        <td className="p-3 text-zoru-ink-muted">{p.label}</td>
                                        <td className="p-3">
                                            <StatusBadge status={p.status === 'online' ? 'up' : 'down'} />
                                        </td>
                                        <td className="p-3 text-zoru-ink-muted">
                                            {p.lastSeenAt ? new Date(p.lastSeenAt).toLocaleString() : '—'}
                                        </td>
                                        <td className="p-3 text-zoru-ink-muted">{p.version ?? '—'}</td>
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
