/**
 * Bug Tracker - Severity x Priority heat-map dashboard
 * (`/dashboard/sabbugs/severity-matrix`).
 *
 * Counts non-closed bugs across the severity x priority grid and renders
 * a colour-graded matrix so triage can spot hotspots at a glance.
 */
import Link from 'next/link';
import { AlertTriangle, Flame, Grid3x3, ShieldAlert } from 'lucide-react';

import {
  Alert,
  Card,
  CardHeader,
  CardTitle,
  PageDescription,
  PageEyebrow,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  StatCard,
  Table,
  TBody,
  THead,
  Td,
  Th,
  Tr,
} from '@/components/sabcrm/20ui';

import { listBugs } from '@/app/actions/bug-tracker.actions';
import type {
  BugPriority,
  BugSeverity,
} from '@/lib/rust-client/sabbugs-bugs';

import {
  BUG_PRIORITIES,
  BUG_SEVERITIES,
  prettyPriority,
  prettySeverity,
} from '../_components/bug-constants';

export const dynamic = 'force-dynamic';

export default async function SeverityMatrixPage() {
  // Pull the first 100 active bugs. For very large tenants the Rust side
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

  const blockerCount = active.filter((b) => b.severity === 'blocker').length;
  const criticalCount = active.filter((b) => b.severity === 'critical').length;
  const urgentCount = active.filter((b) => b.priority === 'urgent').length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>Bug tracker</PageEyebrow>
          <PageTitle>Severity and priority matrix</PageTitle>
          <PageDescription>
            Active bugs counted across the severity and priority grid so triage
            can spot hotspots at a glance. Closed bugs are excluded.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      {res.error ? (
        <Alert tone="danger" title="Could not load bugs">
          {res.error}
        </Alert>
      ) : null}

      <section
        aria-label="Triage summary"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <StatCard
          label="Active bugs"
          value={<span className="tabular-nums">{active.length}</span>}
          icon={<Grid3x3 size={16} aria-hidden="true" />}
        />
        <StatCard
          label="Blockers"
          value={<span className="tabular-nums">{blockerCount}</span>}
          icon={<Flame size={16} aria-hidden="true" />}
          accent="#dc2626"
        />
        <StatCard
          label="Critical"
          value={<span className="tabular-nums">{criticalCount}</span>}
          icon={<AlertTriangle size={16} aria-hidden="true" />}
          accent="#ea580c"
        />
        <StatCard
          label="Urgent priority"
          value={<span className="tabular-nums">{urgentCount}</span>}
          icon={<ShieldAlert size={16} aria-hidden="true" />}
          accent="#d97706"
        />
      </section>

      <Card padding="none" className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Grid3x3 size={16} aria-hidden="true" />
            Severity by priority
          </CardTitle>
        </CardHeader>
        <div className="overflow-x-auto p-4 pt-0">
        <Table density="compact" hover={false}>
          <THead>
            <Tr>
              <Th align="left">Severity \ Priority</Th>
              {BUG_PRIORITIES.map((p) => (
                <Th key={p} align="center">
                  {prettyPriority(p)}
                </Th>
              ))}
            </Tr>
          </THead>
          <TBody>
            {BUG_SEVERITIES.map((s) => (
              <Tr key={s}>
                <Th align="left" scope="row">
                  {prettySeverity(s)}
                </Th>
                {BUG_PRIORITIES.map((p) => {
                  const count = matrix[s][p];
                  const intensity = Math.round((count / max) * 100);
                  // Only the bg tint is data-driven (heat-map ramp); the text
                  // colour is a fixed two-state token choice, so it lives in
                  // Tailwind rather than inline style.
                  const textClass =
                    intensity > 60
                      ? 'text-[var(--st-text-inverted)]'
                      : 'text-[var(--st-text)]';
                  return (
                    <Td key={p} align="center" className="p-0">
                      <Link
                        href={`/dashboard/sabbugs?severity=${s}&priority=${p}`}
                        aria-label={`${count} ${prettySeverity(s)} bug${count === 1 ? '' : 's'} at ${prettyPriority(p)} priority`}
                        className={`block rounded-[var(--st-radius)] p-3 text-center font-semibold tabular-nums transition-opacity duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)] focus-visible:ring-inset ${textClass}`}
                        style={{ backgroundColor: cellColor(intensity) }}
                      >
                        {count}
                      </Link>
                    </Td>
                  );
                })}
              </Tr>
            ))}
          </TBody>
        </Table>
        </div>
      </Card>
    </div>
  );
}

function cellColor(intensity: number): string {
  // Heat ramp from a neutral surface token up to a saturated red as intensity
  // rises. The non-zero steps are a data-visualisation ramp, not chrome, so the
  // hex stops are intentional and computed from the live bug counts.
  if (intensity <= 0) return 'var(--st-bg-secondary)';
  if (intensity < 25) return '#fef3c7';
  if (intensity < 50) return '#fdba74';
  if (intensity < 75) return '#f97316';
  return '#dc2626';
}
