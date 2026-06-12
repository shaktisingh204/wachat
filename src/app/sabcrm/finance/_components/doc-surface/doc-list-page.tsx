'use client';

/**
 * doc-surface — DocListPage.
 *
 * The config-driven list surface every finance document entity adopts:
 *
 *   - KPI strip slot (caller renders KpiCards above the toolbar);
 *   - toolbar: debounced search, status Select, date-range picker and an
 *     optional party EntityPicker — all server-side filters;
 *   - typed columns (text / party / money / date / status / badge /
 *     aging) so formatting is consistent across 45+ surfaces;
 *   - server pagination (Prev/Next over the engine's bare-array list);
 *   - bulk select + configurable bulk actions (with optional confirm);
 *   - CSV export (capped fetch-all when provided, else the loaded page);
 *   - empty state + engine-down error state.
 *
 * Rows are display-ready: a `party` cell renders the RESOLVED label or
 * a muted "Unknown customer" — never a raw ObjectId.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Download, Search, X } from 'lucide-react';
import type { DateRange } from 'react-day-picker';

import {
  Alert,
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Checkbox,
  DateRangePicker,
  EmptyState,
  Input,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  SelectField,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  toast,
  type SelectOption,
} from '@/components/sabcrm/20ui';

import { EntityPicker } from './entity-picker';
import type {
  DocBulkAction,
  DocListColumn,
  DocListFilters,
  DocListPageConfig,
  DocStatusDef,
} from './types';

import '@/components/sabcrm/20ui/surface-crm-base.css';
import './doc-surface.css';

/* ─── Formatting ──────────────────────────────────────────────── */

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** `2026-06-11T…` → `11 Jun 2026` (deterministic, no TZ drift). */
export function formatDocDate(iso: string | undefined): string {
  const day = (iso ?? '').slice(0, 10);
  const [y, m, d] = day.split('-');
  if (!y || !m || !d) return '—';
  return `${Number(d)} ${MONTHS[Number(m) - 1] ?? m} ${y}`;
}

export function formatDocMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** Local `Date` → `YYYY-MM-DD` (calendar day, not UTC). */
function toDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/* ─── Cell renderer ───────────────────────────────────────────── */

function renderCell<R>(
  column: DocListColumn<R>,
  row: R,
  statuses: Map<string, DocStatusDef>,
): React.ReactNode {
  const raw = column.value(row);
  switch (column.kind) {
    case 'money': {
      const n = typeof raw === 'number' ? raw : 0;
      const currency = column.currency?.(row) ?? 'INR';
      return (
        <span className={['fdoc-money', n === 0 && 'fdoc-money--muted'].filter(Boolean).join(' ')}>
          {formatDocMoney(n, currency)}
        </span>
      );
    }
    case 'date':
      return formatDocDate(typeof raw === 'string' ? raw : undefined);
    case 'party':
      return raw ? (
        <span>{String(raw)}</span>
      ) : (
        <span className="fdoc-unknown-party">Unknown customer</span>
      );
    case 'status': {
      const def = statuses.get(String(raw));
      return (
        <Badge tone={def?.tone ?? 'neutral'} dot>
          {def?.label ?? String(raw)}
        </Badge>
      );
    }
    case 'badge':
      return raw ? (
        <Badge tone={column.tone?.(row) ?? 'neutral'}>{String(raw)}</Badge>
      ) : (
        '—'
      );
    case 'aging': {
      const days = typeof raw === 'number' ? raw : null;
      if (days === null) return <span className="fdoc-money--muted">—</span>;
      if (days <= 0) {
        return (
          <span className="fdoc-money--muted">
            {days === 0 ? 'Due today' : `Due in ${-days}d`}
          </span>
        );
      }
      return <Badge tone="danger">{days}d overdue</Badge>;
    }
    case 'text':
    default:
      return raw === null || raw === undefined || raw === ''
        ? '—'
        : String(raw);
  }
}

/** Plain-text cell (CSV). */
function cellText<R>(
  column: DocListColumn<R>,
  row: R,
  statuses: Map<string, DocStatusDef>,
): string {
  if (column.csv) return column.csv(row);
  const raw = column.value(row);
  switch (column.kind) {
    case 'money': {
      const n = typeof raw === 'number' ? raw : 0;
      return n.toFixed(2);
    }
    case 'date':
      return (typeof raw === 'string' ? raw : '').slice(0, 10);
    case 'party':
      return raw ? String(raw) : 'Unknown customer';
    case 'status':
      return statuses.get(String(raw))?.label ?? String(raw ?? '');
    case 'aging': {
      const days = typeof raw === 'number' ? raw : null;
      return days === null ? '' : String(days);
    }
    default:
      return raw === null || raw === undefined ? '' : String(raw);
  }
}

function csvEscape(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

/* ─── Component ───────────────────────────────────────────────── */

export interface DocListPageProps<R extends { id: string }> {
  config: DocListPageConfig<R>;
  /** KPI strip slot rendered between the header and the toolbar. */
  kpis?: React.ReactNode;
  /** Primary action slot (the "New invoice" button + its form). */
  primaryAction?: React.ReactNode;
  initialRows: R[];
  initialHasMore: boolean;
  /** Non-null when the initial server fetch failed (engine down). */
  initialError: string | null;
  /** Bumped by the parent to force a refetch (after create). */
  refreshToken?: number;
}

export function DocListPage<R extends { id: string }>({
  config,
  kpis,
  primaryAction,
  initialRows,
  initialHasMore,
  initialError,
  refreshToken = 0,
}: DocListPageProps<R>): React.JSX.Element {
  const router = useRouter();
  const statusMap = React.useMemo(
    () => new Map(config.statuses.map((s) => [s.value, s])),
    [config.statuses],
  );

  /* ---- filters + data ---- */
  const [rows, setRows] = React.useState<R[]>(initialRows);
  const [hasMore, setHasMore] = React.useState(initialHasMore);
  const [error, setError] = React.useState<string | null>(initialError);
  const [page, setPage] = React.useState(1);
  const [q, setQ] = React.useState('');
  const [status, setStatus] = React.useState<string | null>('');
  const [partyId, setPartyId] = React.useState<string | null>(null);
  const [partyLabel, setPartyLabel] = React.useState<string | null>(null);
  const [range, setRange] = React.useState<DateRange | undefined>(undefined);
  const [loading, startLoad] = React.useTransition();
  const [exporting, setExporting] = React.useState(false);

  const filtersOf = React.useCallback(
    (nextPage: number): DocListFilters => ({
      page: nextPage,
      q: q.trim(),
      status: status ?? '',
      partyId: partyId ?? '',
      from: range?.from ? toDayKey(range.from) : undefined,
      to: range?.to ? toDayKey(range.to) : undefined,
    }),
    [q, status, partyId, range],
  );

  const filtersRef = React.useRef(filtersOf);
  filtersRef.current = filtersOf;

  const load = React.useCallback(
    (nextPage: number) => {
      startLoad(async () => {
        const res = await config.fetchPage(filtersRef.current(nextPage));
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setError(null);
        setRows(res.data.rows);
        setHasMore(res.data.hasMore);
        setPage(nextPage);
        setSelected(new Set());
      });
    },
    [config],
  );

  // Debounced refetch on filter changes (and skip the very first render —
  // the server already provided page 1).
  const firstRender = React.useRef(true);
  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const handle = window.setTimeout(() => load(1), 250);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status, partyId, range, refreshToken]);

  /* ---- selection + bulk actions ---- */
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = React.useState<DocBulkAction<R> | null>(
    null,
  );
  const [bulkRunning, setBulkRunning] = React.useState(false);
  const allSelected = rows.length > 0 && selected.size === rows.length;

  const toggleAll = (): void => {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  };

  const toggleOne = (id: string): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runBulk = async (action: DocBulkAction<R>): Promise<void> => {
    const targets = rows.filter((r) => selected.has(r.id));
    if (targets.length === 0) return;
    setBulkRunning(true);
    try {
      const res = await action.run(targets);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `${action.label} — ${targets.length} ${targets.length === 1 ? config.entity.singular : config.entity.plural}.`,
      );
      setConfirmBulk(null);
      load(page);
      router.refresh();
    } finally {
      setBulkRunning(false);
    }
  };

  /* ---- CSV export ---- */
  const exportCsv = async (): Promise<void> => {
    setExporting(true);
    try {
      let data: R[] = rows;
      if (config.fetchAllForCsv) {
        const res = await config.fetchAllForCsv(filtersRef.current(1));
        if (res.ok) data = res.data;
        else {
          toast.error(res.error);
          return;
        }
      }
      if (data.length === 0) {
        toast.message('Nothing to export.');
        return;
      }
      const header = config.columns.map((c) => csvEscape(c.header)).join(',');
      const lines = data.map((row) =>
        config.columns
          .map((c) => csvEscape(cellText(c, row, statusMap)))
          .join(','),
      );
      const blob = new Blob([`${header}\n${lines.join('\n')}\n`], {
        type: 'text/csv;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        config.csvFileName ?? `${config.entity.plural.toLowerCase()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${data.length} ${data.length === 1 ? config.entity.singular : config.entity.plural}.`);
    } finally {
      setExporting(false);
    }
  };

  /* ---- render ---- */
  const statusOptions: SelectOption[] = [
    { value: '', label: 'All statuses' },
    ...config.statuses.map((s) => ({ value: s.value, label: s.label })),
  ];

  const hasFilters =
    q.trim() !== '' || (status ?? '') !== '' || partyId || range?.from;
  const Icon = config.icon;
  const showEmpty = !error && rows.length === 0;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 pb-12 pt-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>{config.title}</PageTitle>
          <PageDescription>{config.description}</PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button
            variant="secondary"
            iconLeft={Download}
            loading={exporting}
            onClick={() => void exportCsv()}
          >
            Export CSV
          </Button>
          {primaryAction}
        </PageActions>
      </PageHeader>

      {kpis ? <div className="fdoc-kpis">{kpis}</div> : null}

      <div className="fdoc-toolbar" role="search">
        <div className="fdoc-toolbar__search">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${config.entity.plural.toLowerCase()}…`}
            iconLeft={Search}
            aria-label={`Search ${config.entity.plural.toLowerCase()}`}
          />
        </div>
        <div className="fdoc-toolbar__control">
          <SelectField
            value={status}
            onChange={setStatus}
            options={statusOptions}
            aria-label="Filter by status"
          />
        </div>
        {config.partyFilter ? (
          <div className="fdoc-toolbar__control">
            <EntityPicker
              value={partyId}
              valueLabel={partyLabel}
              search={config.partyFilter.search}
              placeholder={config.partyFilter.placeholder}
              aria-label={config.partyFilter.placeholder}
              onChange={(opt) => {
                setPartyId(opt?.id ?? null);
                setPartyLabel(opt?.label ?? null);
              }}
            />
          </div>
        ) : null}
        <div className="fdoc-toolbar__control">
          <DateRangePicker
            value={range}
            onChange={setRange}
            placeholder="Any date"
            aria-label="Filter by date range"
          />
        </div>
        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            iconLeft={X}
            onClick={() => {
              setQ('');
              setStatus('');
              setPartyId(null);
              setPartyLabel(null);
              setRange(undefined);
            }}
          >
            Clear
          </Button>
        ) : null}
      </div>

      {error ? (
        <div className="my-4">
          <Alert tone="danger" role="alert">
            Couldn&apos;t load {config.entity.plural.toLowerCase()}: {error}
          </Alert>
        </div>
      ) : null}

      {selected.size > 0 && config.bulkActions?.length ? (
        <div className="fdoc-bulkbar">
          <span className="fdoc-bulkbar__count">
            {selected.size} selected
          </span>
          {config.bulkActions.map((action) => (
            <Button
              key={action.key}
              variant={action.tone === 'danger' ? 'danger' : 'secondary'}
              size="sm"
              iconLeft={action.icon}
              loading={bulkRunning && confirmBulk === null}
              onClick={() => {
                if (action.confirm) setConfirmBulk(action);
                else void runBulk(action);
              }}
            >
              {action.label}
            </Button>
          ))}
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
            Clear selection
          </Button>
        </div>
      ) : null}

      {showEmpty ? (
        <div className="mt-12">
          <EmptyState
            icon={Icon}
            title={
              hasFilters
                ? `No matching ${config.entity.plural.toLowerCase()}`
                : `No ${config.entity.plural.toLowerCase()} yet`
            }
            description={
              hasFilters
                ? 'Try widening the search or clearing the filters.'
                : `Create your first ${config.entity.singular.toLowerCase()} to get started.`
            }
            action={hasFilters ? undefined : primaryAction}
          />
        </div>
      ) : null}

      {rows.length > 0 ? (
        <>
          <Table hover>
            <THead>
              <Tr>
                {config.bulkActions?.length ? (
                  <Th width={36}>
                    <Checkbox
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label={
                        allSelected
                          ? 'Deselect all rows'
                          : 'Select all rows on this page'
                      }
                    />
                  </Th>
                ) : null}
                {config.columns.map((c) => (
                  <Th
                    key={c.key}
                    align={
                      c.align ??
                      (c.kind === 'money' || c.kind === 'aging'
                        ? 'right'
                        : 'left')
                    }
                    width={c.width}
                  >
                    {c.header}
                  </Th>
                ))}
              </Tr>
            </THead>
            <TBody>
              {rows.map((row) => {
                const href = config.rowHref?.(row) ?? null;
                return (
                  <Tr
                    key={row.id}
                    onClick={
                      href
                        ? (e) => {
                            const target = e.target as HTMLElement;
                            // Don't hijack clicks on interactive children.
                            if (target.closest('a,button,input,label')) return;
                            router.push(href);
                          }
                        : undefined
                    }
                    style={href ? { cursor: 'pointer' } : undefined}
                  >
                    {config.bulkActions?.length ? (
                      <Td>
                        <Checkbox
                          checked={selected.has(row.id)}
                          onChange={() => toggleOne(row.id)}
                          aria-label={`Select ${config.rowLabel(row)}`}
                        />
                      </Td>
                    ) : null}
                    {config.columns.map((c, ci) => (
                      <Td
                        key={c.key}
                        align={
                          c.align ??
                          (c.kind === 'money' || c.kind === 'aging'
                            ? 'right'
                            : 'left')
                        }
                      >
                        {ci === 0 && href ? (
                          <a
                            href={href}
                            className="fdoc-doc-no"
                            onClick={(e) => {
                              e.preventDefault();
                              router.push(href);
                            }}
                          >
                            {renderCell(c, row, statusMap)}
                          </a>
                        ) : (
                          renderCell(c, row, statusMap)
                        )}
                      </Td>
                    ))}
                  </Tr>
                );
              })}
            </TBody>
          </Table>

          <div className="fdoc-list-footer">
            <span aria-live="polite">
              Page {page}
              {loading ? ' — loading…' : ''}
            </span>
            <span className="inline-flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => load(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={!hasMore || loading}
                onClick={() => load(page + 1)}
              >
                Next
              </Button>
            </span>
          </div>
        </>
      ) : null}

      <AlertDialog
        open={confirmBulk !== null}
        onOpenChange={(next) => {
          if (!next && !bulkRunning) setConfirmBulk(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmBulk?.confirm?.title ?? 'Are you sure?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmBulk?.confirm?.description ??
                `This affects ${selected.size} ${selected.size === 1 ? config.entity.singular : config.entity.plural}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="secondary" disabled={bulkRunning}>
                Cancel
              </Button>
            </AlertDialogCancel>
            <Button
              variant={confirmBulk?.tone === 'danger' ? 'danger' : 'primary'}
              loading={bulkRunning}
              onClick={() => confirmBulk && void runBulk(confirmBulk)}
            >
              {confirmBulk?.confirm?.actionLabel ?? confirmBulk?.label ?? 'Confirm'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
