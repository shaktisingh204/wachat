'use client';

/**
 * Wachat Delivery Reports — message delivery status breakdown.
 */

import * as React from 'react';
import { LuSend, LuCheckCheck, LuEye, LuCircleX } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayCard, ClayBadge } from '@/components/clay';

const STATS = [
  { label: 'Sent', value: 12480, icon: LuSend, color: 'bg-blue-400', pct: 100 },
  { label: 'Delivered', value: 11832, icon: LuCheckCheck, color: 'bg-emerald-400', pct: 94.8 },
  { label: 'Read', value: 8946, icon: LuEye, color: 'bg-violet-400', pct: 71.7 },
  { label: 'Failed', value: 648, icon: LuCircleX, color: 'bg-red-400', pct: 5.2 },
];

const FAILED_MESSAGES = [
  { id: '1', phone: '+91 98765 43210', template: 'Order Confirmation', error: 'Number not on WhatsApp', date: '2026-04-12 10:30' },
  { id: '2', phone: '+91 87654 32109', template: 'Payment Reminder', error: 'Template not approved', date: '2026-04-12 09:15' },
  { id: '3', phone: '+91 76543 21098', template: 'Welcome Message', error: '24-hour window expired', date: '2026-04-11 16:45' },
  { id: '4', phone: '+91 65432 10987', template: 'Shipping Update', error: 'Rate limit exceeded', date: '2026-04-11 14:20' },
  { id: '5', phone: '+91 54321 09876', template: 'Appointment Reminder', error: 'Invalid phone format', date: '2026-04-11 11:00' },
  { id: '6', phone: '+91 43210 98765', template: 'Support Follow-up', error: 'User blocked business', date: '2026-04-10 08:30' },
];

export default function DeliveryReportsPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();

  const total = STATS[0].value;

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Delivery Reports' },
      ]} />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">Delivery Reports</h1>
        <p className="mt-1.5 text-[13px] text-clay-ink-muted">View message delivery status breakdown and failed message details.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((s) => (
          <ClayCard key={s.label} padded={false} className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-clay-surface-2">
                <s.icon className="h-5 w-5 text-clay-ink-muted" strokeWidth={1.75} />
              </span>
              <div>
                <div className="text-[12px] text-clay-ink-muted">{s.label}</div>
                <div className="text-[22px] font-semibold text-clay-ink leading-tight tabular-nums">{s.value.toLocaleString()}</div>
              </div>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-clay-surface-2">
              <div className={`h-full rounded-full ${s.color} transition-all`} style={{ width: `${s.pct}%` }} />
            </div>
            <div className="mt-1 text-[11px] text-clay-ink-muted text-right">{s.pct}%</div>
          </ClayCard>
        ))}
      </div>

      <ClayCard padded={false} className="overflow-x-auto">
        <div className="px-5 py-4 border-b border-clay-border">
          <h2 className="text-[15px] font-semibold text-clay-ink">Recent Failed Messages</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-clay-border text-[11px] font-semibold uppercase tracking-wide text-clay-ink-muted">
              <th className="px-5 py-3">Phone</th>
              <th className="px-5 py-3">Template</th>
              <th className="px-5 py-3">Error Reason</th>
              <th className="px-5 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {FAILED_MESSAGES.map((m) => (
              <tr key={m.id} className="border-b border-clay-border last:border-0">
                <td className="px-5 py-3 text-[13px] text-clay-ink font-mono">{m.phone}</td>
                <td className="px-5 py-3 text-[13px] text-clay-ink">{m.template}</td>
                <td className="px-5 py-3">
                  <ClayBadge>{m.error}</ClayBadge>
                </td>
                <td className="px-5 py-3 text-[12px] text-clay-ink-muted whitespace-nowrap">{m.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ClayCard>
      <div className="h-6" />
    </div>
  );
}
