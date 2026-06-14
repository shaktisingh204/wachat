import { FileSignature, CheckCircle2, Clock, Send } from 'lucide-react';

import { getSabsignReportStats } from '@/app/actions/sabsign-reports.actions';

export const dynamic = 'force-dynamic';

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-50 text-blue-700',
  in_progress: 'bg-amber-50 text-amber-700',
  completed: 'bg-emerald-50 text-emerald-700',
  declined: 'bg-red-50 text-red-700',
  voided: 'bg-zinc-100 text-zinc-600',
  expired: 'bg-orange-50 text-orange-700',
};

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof FileSignature;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-[var(--st-border,#e5e5e5)] bg-[var(--st-surface,#fff)] p-4">
      <div className="flex items-center gap-2 text-[var(--st-text-secondary,#666)]">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold text-[var(--st-text,#111)]">{value}</div>
    </div>
  );
}

export default async function SabsignReportsPage() {
  const stats = await getSabsignReportStats();
  const statuses = Object.entries(stats.byStatus).sort((a, b) => b[1] - a[1]);
  const maxCount = Math.max(1, ...statuses.map(([, n]) => n));

  return (
    <main className="flex w-full max-w-4xl flex-col gap-5 p-1">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--st-text-tertiary,#999)]">
          SabSign
        </p>
        <h1 className="text-xl font-semibold text-[var(--st-text,#111)]">Reports</h1>
        <p className="text-sm text-[var(--st-text-secondary,#666)]">
          Signing activity and completion metrics for this workspace.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={FileSignature} label="Total" value={stats.total} />
        <Stat icon={CheckCircle2} label="Completed" value={stats.byStatus.completed ?? 0} />
        <Stat icon={Send} label="Completion rate" value={`${stats.completionRate}%`} />
        <Stat
          icon={Clock}
          label="Avg time to sign"
          value={stats.avgHoursToComplete != null ? `${stats.avgHoursToComplete} h` : '—'}
        />
      </div>

      <section className="rounded-xl border border-[var(--st-border,#e5e5e5)] bg-[var(--st-surface,#fff)] p-4">
        <h2 className="mb-3 text-sm font-medium text-[var(--st-text,#111)]">By status</h2>
        {statuses.length === 0 ? (
          <p className="text-sm text-[var(--st-text-secondary,#666)]">No envelopes yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {statuses.map(([status, count]) => (
              <div key={status} className="flex items-center gap-3">
                <span
                  className={`w-24 shrink-0 rounded-full px-2 py-0.5 text-center text-xs ${
                    STATUS_STYLE[status] ?? 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {status.replace('_', ' ')}
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--st-bg-secondary,#f3f3f3)]">
                  <span
                    className="block h-full rounded-full bg-[var(--st-accent,#7c3aed)]"
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                </span>
                <span className="w-8 shrink-0 text-right text-sm tabular-nums text-[var(--st-text,#111)]">
                  {count}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-[var(--st-border,#e5e5e5)] bg-[var(--st-surface,#fff)]">
        <h2 className="border-b border-[var(--st-border,#eee)] px-4 py-2.5 text-sm font-medium text-[var(--st-text,#111)]">
          Recent envelopes
        </h2>
        {stats.recent.length === 0 ? (
          <p className="px-4 py-6 text-sm text-[var(--st-text-secondary,#666)]">Nothing yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-[var(--st-text-tertiary,#999)]">
              <tr>
                <th className="px-4 py-1.5">Envelope</th>
                <th className="px-4 py-1.5">Status</th>
                <th className="px-4 py-1.5">Signers</th>
              </tr>
            </thead>
            <tbody>
              {stats.recent.map((e, i) => (
                <tr key={i} className="border-t border-[var(--st-border,#eee)]">
                  <td className="px-4 py-1.5 text-[var(--st-text,#111)]">{e.name}</td>
                  <td className="px-4 py-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        STATUS_STYLE[e.status] ?? 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {e.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-1.5 text-[var(--st-text-secondary,#666)]">{e.signers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
