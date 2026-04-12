'use client';

/**
 * Wachat Contact Import History — view past CSV import records.
 */

import * as React from 'react';
import { LuFileSpreadsheet, LuCircleCheck, LuCircleX, LuClock } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayCard, ClayBadge } from '@/components/clay';

const IMPORTS = [
  { id: '1', filename: 'customers_march.csv', date: '2026-04-10 14:30', total: 1250, success: 1230, failed: 20, status: 'completed' },
  { id: '2', filename: 'leads_q1.csv', date: '2026-04-05 09:15', total: 850, success: 842, failed: 8, status: 'completed' },
  { id: '3', filename: 'newsletter_subs.csv', date: '2026-03-28 11:00', total: 3200, success: 3150, failed: 50, status: 'completed' },
  { id: '4', filename: 'partner_contacts.csv', date: '2026-03-20 16:45', total: 420, success: 420, failed: 0, status: 'completed' },
  { id: '5', filename: 'event_attendees.csv', date: '2026-03-15 10:20', total: 680, success: 0, failed: 680, status: 'failed' },
  { id: '6', filename: 'vip_customers.csv', date: '2026-03-10 08:30', total: 150, success: 148, failed: 2, status: 'completed' },
  { id: '7', filename: 'bulk_import_apr.csv', date: '2026-04-12 13:00', total: 2000, success: 1450, failed: 0, status: 'processing' },
];

function statusBadge(status: string) {
  switch (status) {
    case 'completed':
      return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700"><LuCircleCheck className="h-3 w-3" /> Completed</span>;
    case 'failed':
      return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700"><LuCircleX className="h-3 w-3" /> Failed</span>;
    case 'processing':
      return <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700"><LuClock className="h-3 w-3" /> Processing</span>;
    default:
      return <ClayBadge>{status}</ClayBadge>;
  }
}

export default function ContactImportHistoryPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();

  const totalImported = IMPORTS.reduce((s, i) => s + i.success, 0);

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Contact Import History' },
      ]} />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">Contact Import History</h1>
        <p className="mt-1.5 text-[13px] text-clay-ink-muted">View the history of all past CSV contact imports.</p>
      </div>

      <div className="flex gap-4">
        <ClayCard className="p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-clay-ink-muted">Total Imports</div>
          <div className="mt-1 text-[28px] font-semibold text-clay-ink tabular-nums">{IMPORTS.length}</div>
        </ClayCard>
        <ClayCard className="p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-clay-ink-muted">Contacts Imported</div>
          <div className="mt-1 text-[28px] font-semibold text-clay-ink tabular-nums">{totalImported.toLocaleString()}</div>
        </ClayCard>
      </div>

      <ClayCard padded={false} className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-clay-border text-[11px] font-semibold uppercase tracking-wide text-clay-ink-muted">
              <th className="px-5 py-3">Filename</th>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3 text-right">Total</th>
              <th className="px-5 py-3 text-right">Success</th>
              <th className="px-5 py-3 text-right">Failed</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {IMPORTS.map((imp) => (
              <tr key={imp.id} className="border-b border-clay-border last:border-0">
                <td className="px-5 py-3 text-[13px] text-clay-ink font-medium flex items-center gap-2">
                  <LuFileSpreadsheet className="h-4 w-4 text-clay-ink-muted shrink-0" />
                  {imp.filename}
                </td>
                <td className="px-5 py-3 text-[12px] text-clay-ink-muted whitespace-nowrap">{imp.date}</td>
                <td className="px-5 py-3 text-right text-[13px] text-clay-ink tabular-nums">{imp.total.toLocaleString()}</td>
                <td className="px-5 py-3 text-right text-[13px] text-emerald-600 tabular-nums">{imp.success.toLocaleString()}</td>
                <td className="px-5 py-3 text-right text-[13px] text-red-500 tabular-nums">{imp.failed}</td>
                <td className="px-5 py-3">{statusBadge(imp.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ClayCard>
      <div className="h-6" />
    </div>
  );
}
