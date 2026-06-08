/**
 * Bug Tracker - Severity x Priority heat-map dashboard
 * (`/dashboard/sabbugs/severity-matrix`).
 *
 * Counts non-closed bugs across the severity x priority grid and renders
 * a colour-graded matrix so triage can spot hotspots at a glance.
 */
import Link from 'next/link';

import {
  Alert,
  Card,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
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

import { BUG_PRIORITIES, BUG_SEVERITIES } from '../_components/bug-constants';

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

  return (
    <div className="flex flex-col gap-4">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Severity x Priority matrix</PageTitle>
          <PageDescription>
            {active.length} active bug{active.length === 1 ? '' : 's'} grouped by
            severity and priority.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      {res.error ? (
        <Alert tone="danger" title="Could not load bugs">
          {res.error}
        </Alert>
      ) : null}

      <Card padding="md" className="overflow-x-auto">
        <Table density="compact" hover={false}>
          <THead>
            <Tr>
              <Th align="left">Severity \ Priority</Th>
              {BUG_PRIORITIES.map((p) => (
                <Th key={p} align="center">
                  {p}
                </Th>
              ))}
            </Tr>
          </THead>
          <TBody>
            {BUG_SEVERITIES.map((s) => (
              <Tr key={s}>
                <Th align="left" scope="row">
                  {s}
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
                        className={`block rounded-[var(--st-radius)] p-3 text-center font-semibold ${textClass}`}
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
