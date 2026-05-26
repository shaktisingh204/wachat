/**
 * Bug Tracker — Severity × Priority heat-map dashboard
 * (`/dashboard/sabbugs/severity-matrix`).
 *
 * Counts non-closed bugs across the severity × priority grid and renders
 * a colour-graded matrix so triage can spot hotspots at a glance.
 */
import Link from 'next/link';

import { Card } from '@/components/zoruui';

import { listBugs } from '@/app/actions/bug-tracker.actions';
import type {
  BugPriority,
  BugSeverity,
} from '@/lib/rust-client/bug-tracker-bugs';

import { BUG_PRIORITIES, BUG_SEVERITIES } from '../_components/bug-shared';

export const dynamic = 'force-dynamic';

export default async function SeverityMatrixPage() {
  // Pull the first 500 active bugs; for very large tenants the Rust side
  // gains a dedicated aggregation endpoint later (see TODOs in report).
  const res = await listBugs({ limit: 100, status: 'all' });
  const active = res.bugs.filter((b) => b.status !== 'closed');

  const matrix: Record<BugSeverity, Record<BugPriority, number>> = {
    trivial: { low: 0, medium: 0, high: 0, urgent: 0 },
    minor: { low: 0, medium: 0, high: 0, urgent: 0 },
    major: { low: 0, medium: 0, high: 0, urgent: 0 },
    critical: { low: 0, medium: 0, high: 0, urgent: 0 },
    blocker: { low: 0, medium: 0, high: 0, urgent: 0 },
  };
  for (const b of active) {
    if (matrix[b.severity] && BUG_PRIORITIES.includes(b.priority)) {
      matrix[b.severity][b.priority] += 1;
    }
  }

  const max = Math.max(
    1,
    ...BUG_SEVERITIES.flatMap((s) => BUG_PRIORITIES.map((p) => matrix[s][p])),
  );

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-semibold text-[var(--zoru-ink)]">
          Severity × Priority matrix
        </h1>
        <p className="text-sm text-[var(--zoru-ink-muted)]">
          {active.length} active bug{active.length === 1 ? '' : 's'} grouped by
          severity and priority.
        </p>
      </header>

      {res.error ? (
        <Card className="border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {res.error}
        </Card>
      ) : null}

      <Card className="overflow-x-auto p-4">
        <table className="w-full border-separate border-spacing-1 text-sm">
          <thead>
            <tr>
              <th className="px-2 py-1 text-left text-xs uppercase text-[var(--zoru-ink-muted)]">
                Severity \ Priority
              </th>
              {BUG_PRIORITIES.map((p) => (
                <th
                  key={p}
                  className="px-2 py-1 text-center text-xs uppercase text-[var(--zoru-ink-muted)]"
                >
                  {p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {BUG_SEVERITIES.map((s) => (
              <tr key={s}>
                <th className="px-2 py-1 text-left text-xs uppercase text-[var(--zoru-ink-muted)]">
                  {s}
                </th>
                {BUG_PRIORITIES.map((p) => {
                  const count = matrix[s][p];
                  const intensity = Math.round((count / max) * 100);
                  return (
                    <td key={p} className="p-0">
                      <Link
                        href={`/dashboard/sabbugs?severity=${s}&priority=${p}`}
                        className="block rounded-md p-3 text-center font-semibold"
                        style={{
                          backgroundColor: cellColor(intensity),
                          color: intensity > 60 ? 'white' : 'inherit',
                        }}
                      >
                        {count}
                      </Link>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function cellColor(intensity: number): string {
  // Plain CSS so we don't pull in another library; ranges from neutral
  // to a saturated red as intensity rises.
  if (intensity <= 0) return 'var(--zoru-surface-2)';
  if (intensity < 25) return '#fef3c7';
  if (intensity < 50) return '#fdba74';
  if (intensity < 75) return '#f97316';
  return '#dc2626';
}
