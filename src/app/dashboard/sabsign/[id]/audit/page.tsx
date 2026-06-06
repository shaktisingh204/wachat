'use client';

/**
 * Per-envelope audit log viewer. Each row is one event from the
 * append-only `esign_audit` collection.
 */

import * as React from 'react';
import { useParams } from 'next/navigation';
import { Badge, Card } from '@/components/sabcrm/20ui';
import { getEnvelopeAudit } from '@/app/actions/sabsign.actions';
import type { EsignAuditEvent } from '@/lib/rust-client/esign-audit';

export default function EnvelopeAuditPage() {
  const params = useParams<{ id: string }>();
  const [events, setEvents] = React.useState<EsignAuditEvent[]>([]);
  const [chainValid, setChainValid] = React.useState(true);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await getEnvelopeAudit(params.id);
        if (!mounted) return;
        setEvents(res.items);
        setChainValid(res.chainValid);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [params.id]);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[var(--st-text)]">Audit trail</h1>
        <Badge variant={chainValid ? 'default' : 'destructive'}>
          {chainValid ? 'Hash chain valid' : 'TAMPERED'}
        </Badge>
      </div>
      <Card className="p-0 border border-[var(--st-border)] overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-[var(--st-text-secondary)]">Loading…</div>
        ) : events.length === 0 ? (
          <div className="p-6 text-sm text-[var(--st-text-secondary)]">No events yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--st-bg-muted)]">
              <tr>
                <th className="px-3 py-2 text-left">Timestamp</th>
                <th className="px-3 py-2 text-left">Event</th>
                <th className="px-3 py-2 text-left">Signer</th>
                <th className="px-3 py-2 text-left">IP</th>
                <th className="px-3 py-2 text-left">Hash</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev._id} className="border-t border-[var(--st-border)]">
                  <td className="px-3 py-2 text-[var(--st-text-secondary)]">
                    {new Date(ev.ts).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline">{ev.eventType}</Badge>
                  </td>
                  <td className="px-3 py-2">{ev.signerId || '—'}</td>
                  <td className="px-3 py-2 text-[var(--st-text-secondary)]">{ev.ip || '—'}</td>
                  <td className="px-3 py-2 text-xs text-[var(--st-text-secondary)] truncate max-w-[200px]">
                    {ev.hash.slice(0, 16)}…
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
