'use client';

/**
 * Wachat Broadcast History — detailed broadcast history viewer with expandable rows.
 */

import * as React from 'react';
import { useState } from 'react';
import { LuRadio, LuChevronDown, LuChevronRight } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayCard, ClayBadge } from '@/components/clay';

type BroadcastRow = {
  id: string; name: string; status: 'completed' | 'failed' | 'sending';
  sent: number; delivered: number; read: number; failed: number; date: string;
  template: string; audience: string;
};

const BROADCASTS: BroadcastRow[] = [
  { id: '1', name: 'April Promo Blast', status: 'completed', sent: 5200, delivered: 4980, read: 3850, failed: 220, date: '2026-04-12 10:00', template: 'promo_april_2026', audience: 'All Customers' },
  { id: '2', name: 'Payment Reminder Q2', status: 'completed', sent: 1800, delivered: 1750, read: 1200, failed: 50, date: '2026-04-10 09:00', template: 'payment_reminder_v2', audience: 'Pending Payments' },
  { id: '3', name: 'Welcome New Users', status: 'sending', sent: 350, delivered: 280, read: 150, failed: 10, date: '2026-04-12 14:30', template: 'welcome_onboard', audience: 'New Sign-ups' },
  { id: '4', name: 'Weekend Sale', status: 'completed', sent: 8400, delivered: 8100, read: 6200, failed: 300, date: '2026-04-05 08:00', template: 'weekend_sale_v3', audience: 'VIP Segment' },
  { id: '5', name: 'Service Downtime Alert', status: 'completed', sent: 12000, delivered: 11800, read: 9500, failed: 200, date: '2026-03-28 07:30', template: 'service_alert', audience: 'All Active' },
  { id: '6', name: 'Test Broadcast', status: 'failed', sent: 50, delivered: 0, read: 0, failed: 50, date: '2026-03-25 16:00', template: 'test_template', audience: 'Internal Team' },
];

function statusBadge(status: string) {
  switch (status) {
    case 'completed': return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Completed</span>;
    case 'failed': return <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">Failed</span>;
    case 'sending': return <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">Sending</span>;
    default: return <ClayBadge>{status}</ClayBadge>;
  }
}

export default function BroadcastHistoryPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggle = (id: string) => setExpandedId((prev) => (prev === id ? null : id));

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Broadcast History' },
      ]} />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">Broadcast History</h1>
        <p className="mt-1.5 text-[13px] text-clay-ink-muted">View detailed history of all broadcast campaigns.</p>
      </div>

      <ClayCard padded={false} className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-clay-border text-[11px] font-semibold uppercase tracking-wide text-clay-ink-muted">
              <th className="px-5 py-3 w-8" />
              <th className="px-5 py-3">Broadcast Name</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Sent</th>
              <th className="px-5 py-3 text-right">Delivered %</th>
              <th className="px-5 py-3 text-right">Read %</th>
              <th className="px-5 py-3 text-right">Failed</th>
              <th className="px-5 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {BROADCASTS.map((b) => {
              const isExpanded = expandedId === b.id;
              const deliveredPct = b.sent > 0 ? ((b.delivered / b.sent) * 100).toFixed(1) : '0';
              const readPct = b.sent > 0 ? ((b.read / b.sent) * 100).toFixed(1) : '0';
              return (
                <React.Fragment key={b.id}>
                  <tr className="border-b border-clay-border cursor-pointer hover:bg-clay-surface-2/50 transition-colors"
                    onClick={() => toggle(b.id)}>
                    <td className="px-5 py-3">
                      {isExpanded ? <LuChevronDown className="h-4 w-4 text-clay-ink-muted" /> : <LuChevronRight className="h-4 w-4 text-clay-ink-muted" />}
                    </td>
                    <td className="px-5 py-3 font-medium text-[13px] text-clay-ink">{b.name}</td>
                    <td className="px-5 py-3">{statusBadge(b.status)}</td>
                    <td className="px-5 py-3 text-right text-[13px] text-clay-ink tabular-nums">{b.sent.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right text-[13px] text-emerald-600 tabular-nums">{deliveredPct}%</td>
                    <td className="px-5 py-3 text-right text-[13px] text-blue-600 tabular-nums">{readPct}%</td>
                    <td className="px-5 py-3 text-right text-[13px] text-red-500 tabular-nums">{b.failed}</td>
                    <td className="px-5 py-3 text-[12px] text-clay-ink-muted whitespace-nowrap">{b.date}</td>
                  </tr>
                  {isExpanded && (
                    <tr className="border-b border-clay-border bg-clay-surface-2/30">
                      <td colSpan={8} className="px-10 py-4">
                        <div className="grid grid-cols-2 gap-4 max-w-md text-[13px]">
                          <div><span className="text-clay-ink-muted">Template:</span> <span className="text-clay-ink font-mono">{b.template}</span></div>
                          <div><span className="text-clay-ink-muted">Audience:</span> <span className="text-clay-ink">{b.audience}</span></div>
                          <div><span className="text-clay-ink-muted">Delivered:</span> <span className="text-clay-ink tabular-nums">{b.delivered.toLocaleString()}</span></div>
                          <div><span className="text-clay-ink-muted">Read:</span> <span className="text-clay-ink tabular-nums">{b.read.toLocaleString()}</span></div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </ClayCard>

      {BROADCASTS.length === 0 && (
        <ClayCard className="p-12 text-center">
          <LuRadio className="mx-auto h-12 w-12 text-clay-ink-muted/30 mb-4" />
          <p className="text-sm text-clay-ink-muted">No broadcasts sent yet.</p>
        </ClayCard>
      )}
      <div className="h-6" />
    </div>
  );
}
