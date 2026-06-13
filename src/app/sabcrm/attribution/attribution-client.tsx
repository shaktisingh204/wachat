'use client';

/**
 * SabCRM — Marketing attribution client (`/sabcrm/attribution`), 20ui.
 *
 * Renders the won-revenue-by-source/campaign report returned by
 * `getAttributionReportTw`, with a live MODEL switch (first / last / linear
 * touch) and an optional object-scope selector. Every selector change re-runs
 * the gated action; the page seeds the initial `linear` report from the server.
 *
 * Pure 20ui. Auth/RBAC/project are enforced by the parent `layout.tsx`; the
 * action re-runs the full gate. Degrades to loading / empty / error and never
 * crashes when the engine is unreachable.
 */

import * as React from 'react';
import { TrendingUp, RefreshCw, Megaphone, Target } from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  StatCard,
  Field,
  Badge,
  Alert,
  EmptyState,
  Skeleton,
  SegmentedControl,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  useToast,
} from '@/components/sabcrm/20ui';
import { renderIcon } from '@/components/sabcrm/20ui/_icon';
import { useProject } from '@/context/project-context';
import {
  getAttributionReportTw,
  type AttributionReportRequest,
} from '@/app/actions/sabcrm-attribution.actions';
import type {
  AttributionModel,
  AttributionRow,
  CampaignRollup,
} from '@/lib/sabcrm/attribution';

// ---------------------------------------------------------------------------
// Local wire shapes (kept free of any server-only import)
// ---------------------------------------------------------------------------

export interface AttributionObjectOption {
  value: string;
  label: string;
}

/** The report payload the page hands down (CampaignRollup + scope meta). */
export interface AttributionReportView extends CampaignRollup {
  objectSlug: string;
  dealsWithTouches: number;
}

interface AttributionClientProps {
  initialReport: AttributionReportView | null;
  initialError: string | null;
  objects: AttributionObjectOption[];
}

const MODEL_ITEMS: ReadonlyArray<{ value: AttributionModel; label: string }> = [
  { value: 'first', label: 'First touch' },
  { value: 'last', label: 'Last touch' },
  { value: 'linear', label: 'Linear' },
];

const MODEL_HELP: Record<AttributionModel, string> = {
  first: 'All revenue credited to the first marketing touch on each deal.',
  last: 'All revenue credited to the most recent touch before the deal was won.',
  linear: 'Revenue split equally across every touch on the deal.',
};

const ALL_OBJECTS = '__all__';

/** Money formatter — compact, no currency symbol coupling. */
function fmtMoney(n: number): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

/** Percent of the rollup total a row represents. */
function pct(value: number, total: number): string {
  if (!total) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

/** Round a fractional deal count for display (1 decimal, trims `.0`). */
function fmtDeals(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

export function AttributionClient({
  initialReport,
  initialError,
  objects,
}: AttributionClientProps): React.ReactElement {
  const { activeProjectId } = useProject();
  const { toast } = useToast();

  const [model, setModel] = React.useState<AttributionModel>(
    initialReport?.model ?? 'linear',
  );
  const [objectSlug, setObjectSlug] = React.useState<string>(ALL_OBJECTS);
  const [report, setReport] = React.useState<AttributionReportView | null>(
    initialReport,
  );
  const [error, setError] = React.useState<string | null>(initialError);
  const [loading, setLoading] = React.useState(false);

  // Track the latest request so out-of-order responses can't clobber state.
  const reqRef = React.useRef(0);

  const fetchReport = React.useCallback(
    async (
      nextModel: AttributionModel,
      nextObject: string,
    ): Promise<void> => {
      const reqId = ++reqRef.current;
      setLoading(true);
      setError(null);
      const req: AttributionReportRequest = {
        model: nextModel,
        objectSlug: nextObject === ALL_OBJECTS ? undefined : nextObject,
      };
      const res = await getAttributionReportTw(
        req,
        activeProjectId ?? undefined,
      );
      if (reqId !== reqRef.current) return; // a newer request superseded us
      setLoading(false);
      if (!res.ok) {
        setError(res.error);
        toast({ title: 'Could not load attribution', description: res.error, tone: 'danger' });
        return;
      }
      setReport(res.data);
    },
    [activeProjectId, toast],
  );

  function onModelChange(next: AttributionModel): void {
    setModel(next);
    void fetchReport(next, objectSlug);
  }
  function onObjectChange(next: string): void {
    setObjectSlug(next);
    void fetchReport(model, next);
  }
  function refresh(): void {
    void fetchReport(model, objectSlug);
  }

  const total = report?.totalRevenue ?? 0;
  const hasData = !!report && report.bySource.length > 0;

  return (
    <>
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Marketing attribution</PageTitle>
          <PageDescription>
            Won-deal revenue credited to the marketing sources and campaigns
            that drove it. {MODEL_HELP[model]}
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-[var(--st-radius)] border border-[var(--st-border)] px-[var(--st-space-3)] py-[var(--st-space-2)] text-[13px] text-[var(--st-text)] transition-colors hover:bg-[var(--st-bg-secondary)] disabled:opacity-50"
          >
            {renderIcon(RefreshCw, { size: 14 })}
            Refresh
          </button>
        </PageActions>
      </PageHeader>

      {/* Controls */}
      <div className="mb-[var(--st-space-4)] flex flex-wrap items-end gap-[var(--st-space-4)]">
        <Field label="Attribution model">
          <SegmentedControl<AttributionModel>
            items={MODEL_ITEMS}
            value={model}
            onChange={onModelChange}
            aria-label="Attribution model"
          />
        </Field>
        <Field label="Object" className="min-w-[200px]">
          <Select value={objectSlug} onValueChange={onObjectChange}>
            <SelectTrigger aria-label="Object scope">
              <SelectValue placeholder="All objects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_OBJECTS}>All objects</SelectItem>
              {objects.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {error && (
        <Alert tone="danger" className="mb-[var(--st-space-3)]">
          {error}
        </Alert>
      )}

      {/* Summary stats */}
      <div className="mb-[var(--st-space-4)] grid grid-cols-1 gap-[var(--st-space-3)] sm:grid-cols-3">
        <StatCard
          label="Won revenue"
          value={fmtMoney(total)}
          icon={TrendingUp}
          accent="var(--st-accent)"
        />
        <StatCard
          label="Won deals"
          value={report ? String(report.totalDeals) : '0'}
          icon={Target}
        />
        <StatCard
          label="Deals with touches"
          value={report ? String(report.dealsWithTouches) : '0'}
          icon={Megaphone}
        />
      </div>

      {loading && !report ? (
        <div className="flex flex-col gap-[var(--st-space-3)]">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : !hasData ? (
        <Card className="p-[var(--st-space-5)]">
          <EmptyState
            icon={Megaphone}
            title="No attributed revenue yet"
            description="Once deals are won and their marketing touches are recorded, this report attributes the revenue to each source and campaign."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-[var(--st-space-4)] lg:grid-cols-2">
          <AttributionTable
            title="Revenue by source"
            rows={report!.bySource}
            total={total}
            firstColLabel="Source"
            firstColValue={(r) => r.source}
          />
          <AttributionTable
            title="Revenue by campaign"
            rows={report!.byCampaign}
            total={total}
            firstColLabel="Campaign"
            firstColValue={(r) => (
              <span className="flex flex-col">
                <span className="text-[var(--st-text)]">{r.campaign}</span>
                <span className="text-[12px] text-[var(--st-text-secondary)]">
                  {r.source}
                </span>
              </span>
            )}
          />
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Report table
// ---------------------------------------------------------------------------

interface AttributionTableProps {
  title: string;
  rows: AttributionRow[];
  total: number;
  firstColLabel: string;
  firstColValue: (row: AttributionRow) => React.ReactNode;
}

function AttributionTable({
  title,
  rows,
  total,
  firstColLabel,
  firstColValue,
}: AttributionTableProps): React.ReactElement {
  // Max revenue for the inline bar scaling.
  const max = rows.reduce((m, r) => Math.max(m, r.revenue), 0) || 1;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardBody className="p-0">
        <Table>
          <THead>
            <Tr>
              <Th>{firstColLabel}</Th>
              <Th align="right">Revenue</Th>
              <Th align="right">Share</Th>
              <Th align="right">Deals</Th>
            </Tr>
          </THead>
          <TBody>
            {rows.map((r) => (
              <Tr key={r.key}>
                <Td>
                  <div className="flex flex-col gap-1">
                    <span className="text-[13px] font-medium">
                      {firstColValue(r)}
                    </span>
                    <span
                      aria-hidden="true"
                      className="h-1 rounded-full bg-[var(--st-accent)]"
                      style={{
                        width: `${Math.max(4, (r.revenue / max) * 100)}%`,
                        opacity: 0.6,
                      }}
                    />
                  </div>
                </Td>
                <Td align="right">{fmtMoney(r.revenue)}</Td>
                <Td align="right">
                  <Badge tone="neutral" kind="soft">
                    {pct(r.revenue, total)}
                  </Badge>
                </Td>
                <Td align="right">{fmtDeals(r.deals)}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </CardBody>
    </Card>
  );
}
