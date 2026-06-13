'use client';

/**
 * SabCRM — Data health client (`/sabcrm/data-quality`), 20ui.
 *
 * Renders the per-object health summaries computed server-side by
 * `getProjectDataHealthTw` (completeness / validity / freshness / overall,
 * each 0–100, plus the worst-scoring records). The dashboard is otherwise
 * read-only: selecting an object card swaps the worst-records table; "Rescan"
 * re-runs the gated action and refreshes state (it also persists each record's
 * `data.__dq` meta via the server envelope).
 *
 * ONLY the `@/components/sabcrm/20ui` barrel (repo rule); every lucide icon is
 * passed as the forwardRef object to components that accept an `icon` prop
 * (Badge/EmptyState/Button render them safely) — never `<Icon/>` inline into a
 * place that does `typeof === 'function'`. Auth / RBAC / project are enforced by
 * the SabCRM layout; the action re-runs the full gate.
 */

import * as React from 'react';
import {
  ShieldCheck,
  RefreshCw,
  CircleAlert,
  Database,
  ListChecks,
} from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
  Card,
  Badge,
  Progress,
  Alert,
  EmptyState,
  Skeleton,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
import { useProject } from '@/context/project-context';
import { getProjectDataHealthTw } from '@/app/actions/sabcrm-dataquality.actions';

/* ------------------------------------------------------------------------- */
/* Wire shapes (kept free of any server-only import)                          */
/* ------------------------------------------------------------------------- */

interface WorstRecordRow {
  id: string;
  label: string;
  overall: number;
  completeness: number;
  validity: number;
  freshness: number;
  issues: string[];
}

interface ObjectHealth {
  objectSlug: string;
  count: number;
  avgCompleteness: number;
  avgValidity: number;
  avgFreshness: number;
  avgOverall: number;
  worst: WorstRecordRow[];
}

export interface DataQualityClientProps {
  initialSummaries: ObjectHealth[];
  initialError: string | null;
}

/* ------------------------------------------------------------------------- */
/* Score → presentation                                                       */
/* ------------------------------------------------------------------------- */

/** Map a 0–100 score to a tone (red < 50 ≤ amber < 80 ≤ green). */
function scoreTone(score: number): BadgeTone {
  if (score >= 80) return 'success';
  if (score >= 50) return 'warning';
  return 'danger';
}

/** Progress component tone mirrors the badge tone (no 'info'/'neutral' track). */
function progressTone(score: number): 'success' | 'warning' | 'danger' {
  if (score >= 80) return 'success';
  if (score >= 50) return 'warning';
  return 'danger';
}

/** Title-case a slug for the card heading (companies → Companies). */
function prettyObject(slug: string): string {
  return slug
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/** A labelled axis bar inside a card. */
function AxisBar({
  label,
  value,
}: {
  label: string;
  value: number;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[12px] text-[var(--st-text-secondary)]">
        <span>{label}</span>
        <span className="tabular-nums text-[var(--st-text)]">{value}</span>
      </div>
      <Progress value={value} tone={progressTone(value)} size="sm" />
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Component                                                                   */
/* ------------------------------------------------------------------------- */

export default function DataQualityClient({
  initialSummaries,
  initialError,
}: DataQualityClientProps): React.JSX.Element {
  const { activeProjectId } = useProject();

  const [summaries, setSummaries] =
    React.useState<ObjectHealth[]>(initialSummaries);
  const [error, setError] = React.useState<string | null>(initialError);
  const [rescanning, setRescanning] = React.useState(false);

  // Cards with records first (lowest overall first), then empty objects.
  const ordered = React.useMemo(() => {
    return [...summaries].sort((a, b) => {
      if (a.count > 0 !== b.count > 0) return a.count > 0 ? -1 : 1;
      return a.avgOverall - b.avgOverall;
    });
  }, [summaries]);

  const [selectedSlug, setSelectedSlug] = React.useState<string | null>(
    () => initialSummaries.find((s) => s.count > 0)?.objectSlug ?? null,
  );

  // Keep a valid selection as data changes.
  React.useEffect(() => {
    if (selectedSlug && summaries.some((s) => s.objectSlug === selectedSlug)) {
      return;
    }
    setSelectedSlug(ordered.find((s) => s.count > 0)?.objectSlug ?? null);
  }, [ordered, selectedSlug, summaries]);

  const selected = summaries.find((s) => s.objectSlug === selectedSlug) ?? null;

  // Portfolio-wide overall = record-weighted mean across objects.
  const portfolio = React.useMemo(() => {
    const withRecords = summaries.filter((s) => s.count > 0);
    const totalRecords = withRecords.reduce((n, s) => n + s.count, 0);
    if (totalRecords === 0) return null;
    const overall = Math.round(
      withRecords.reduce((n, s) => n + s.avgOverall * s.count, 0) / totalRecords,
    );
    return { overall, totalRecords, objects: withRecords.length };
  }, [summaries]);

  async function rescan(): Promise<void> {
    if (!activeProjectId) return;
    setRescanning(true);
    setError(null);
    const res = await getProjectDataHealthTw(activeProjectId);
    setRescanning(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSummaries(res.data);
  }

  return (
    <>
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Data health</PageTitle>
          <PageDescription>
            Completeness, validity and freshness for every object. Each record is
            graded 0–100; the worst records surface below so you know what to fix.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button
            variant="secondary"
            iconLeft={RefreshCw}
            onClick={rescan}
            loading={rescanning}
            disabled={rescanning || !activeProjectId}
          >
            Rescan
          </Button>
        </PageActions>
      </PageHeader>

      {error && (
        <Alert tone="danger" className="mb-[var(--st-space-3)]">
          {error}
        </Alert>
      )}

      {/* Portfolio overall */}
      {portfolio && (
        <Card className="mb-[var(--st-space-4)] flex flex-col gap-[var(--st-space-3)] p-[var(--st-space-4)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-[var(--st-space-3)]">
            <ShieldCheck
              size={28}
              className="text-[var(--st-accent)]"
              aria-hidden="true"
            />
            <div className="flex flex-col">
              <span className="text-[13px] text-[var(--st-text-secondary)]">
                Overall data health
              </span>
              <span className="text-[28px] font-semibold leading-none text-[var(--st-text)] tabular-nums">
                {portfolio.overall}
                <span className="text-[15px] text-[var(--st-text-secondary)]">
                  {' '}
                  / 100
                </span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-[var(--st-space-4)] text-[13px] text-[var(--st-text-secondary)]">
            <span className="flex items-center gap-1.5">
              <Database size={15} aria-hidden="true" />
              {portfolio.totalRecords.toLocaleString()} records
            </span>
            <span className="flex items-center gap-1.5">
              <ListChecks size={15} aria-hidden="true" />
              {portfolio.objects} object{portfolio.objects === 1 ? '' : 's'}
            </span>
            <Badge tone={scoreTone(portfolio.overall)} kind="soft">
              {portfolio.overall >= 80
                ? 'Healthy'
                : portfolio.overall >= 50
                  ? 'Needs attention'
                  : 'At risk'}
            </Badge>
          </div>
        </Card>
      )}

      {/* Per-object cards */}
      {rescanning && summaries.length === 0 ? (
        <div className="grid grid-cols-1 gap-[var(--st-space-3)] sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : ordered.length === 0 ? (
        <Card className="p-[var(--st-space-5)]">
          <EmptyState
            icon={ShieldCheck}
            title="No objects to grade yet"
            description="Once your CRM has objects with records, their health scores show up here."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-[var(--st-space-3)] sm:grid-cols-2 lg:grid-cols-3">
          {ordered.map((s) => {
            const isSelected = s.objectSlug === selectedSlug;
            const empty = s.count === 0;
            return (
              <button
                key={s.objectSlug}
                type="button"
                onClick={() => !empty && setSelectedSlug(s.objectSlug)}
                disabled={empty}
                className={`flex flex-col gap-[var(--st-space-3)] rounded-[var(--st-radius)] border p-[var(--st-space-4)] text-left transition-colors ${
                  empty
                    ? 'cursor-default border-[var(--st-border)] opacity-70'
                    : isSelected
                      ? 'border-[var(--st-accent)] bg-[var(--st-bg-secondary)]'
                      : 'border-[var(--st-border)] hover:bg-[var(--st-bg-secondary)]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="text-[14px] font-semibold text-[var(--st-text)]">
                      {prettyObject(s.objectSlug)}
                    </span>
                    <span className="text-[12px] text-[var(--st-text-secondary)]">
                      {s.count.toLocaleString()} record
                      {s.count === 1 ? '' : 's'}
                    </span>
                  </div>
                  {empty ? (
                    <Badge tone="neutral" kind="soft">
                      No data
                    </Badge>
                  ) : (
                    <Badge tone={scoreTone(s.avgOverall)} kind="solid">
                      {s.avgOverall}
                    </Badge>
                  )}
                </div>
                {!empty && (
                  <div className="flex flex-col gap-[var(--st-space-2)]">
                    <AxisBar label="Completeness" value={s.avgCompleteness} />
                    <AxisBar label="Validity" value={s.avgValidity} />
                    <AxisBar label="Freshness" value={s.avgFreshness} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Worst records table for the selected object */}
      {selected && selected.count > 0 && (
        <Card className="mt-[var(--st-space-4)] flex flex-col gap-[var(--st-space-3)] p-[var(--st-space-4)]">
          <div className="flex items-center gap-2">
            <CircleAlert
              size={16}
              className="text-[var(--st-warning, #d97706)]"
              aria-hidden="true"
            />
            <span className="text-[14px] font-semibold text-[var(--st-text)]">
              Lowest-scoring {prettyObject(selected.objectSlug)}
            </span>
          </div>

          {selected.worst.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              tone="success"
              size="sm"
              title="Nothing to fix"
              description="Every scanned record scored well on this object."
            />
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Record</Th>
                  <Th align="right" width={90}>
                    Overall
                  </Th>
                  <Th align="right" width={110}>
                    Complete
                  </Th>
                  <Th align="right" width={90}>
                    Valid
                  </Th>
                  <Th align="right" width={90}>
                    Fresh
                  </Th>
                  <Th>Top issues</Th>
                </Tr>
              </THead>
              <TBody>
                {selected.worst.map((r) => (
                  <Tr key={r.id}>
                    <Td truncate>{r.label}</Td>
                    <Td align="right">
                      <Badge tone={scoreTone(r.overall)} kind="soft">
                        {r.overall}
                      </Badge>
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {r.completeness}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {r.validity}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {r.freshness}
                    </Td>
                    <Td>
                      {r.issues.length === 0 ? (
                        <span className="text-[var(--st-text-secondary)]">—</span>
                      ) : (
                        <span className="flex flex-wrap gap-1">
                          {r.issues.map((msg, i) => (
                            <Badge key={i} tone="neutral" kind="outline">
                              {msg}
                            </Badge>
                          ))}
                        </span>
                      )}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      )}
    </>
  );
}
