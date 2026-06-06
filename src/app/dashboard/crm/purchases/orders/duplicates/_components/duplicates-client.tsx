'use client';

/**
 * PO Duplicates client shell.
 *
 * Renders:
 *  - KPI strip (groups found, records affected, est. duplicates, last-scan date)
 *  - Confidence filter (High / Medium / Low) — client-side, no round-trip
 *  - Group table with bulk merge (keep first, delete rest) and bulk ignore
 *  - Export CSV
 */

import * as React from 'react';
import Link from 'next/link';

import {
  Badge,
  Button,
  Card,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  StatCard,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import { Download, GitMerge, Loader2, X } from 'lucide-react';

import {
  type PurchaseOrderDuplicateGroup,
  bulkDeletePurchaseOrders,
} from '@/app/actions/crm/purchase-orders.actions';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';

/* ── helpers ─────────────────────────────────────────────────────────── */

function fmtMoney(value: number, currency = 'INR'): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

function fmtDate(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

/** Naive confidence: same poNo = High, else ≤1% amount diff = Medium, else Low */
type Confidence = 'High' | 'Medium' | 'Low';

function groupConfidence(group: PurchaseOrderDuplicateGroup): Confidence {
  const members = group.members;
  const allSamePoNo =
    members[0].poNo &&
    members.every((m) => m.poNo === members[0].poNo);
  if (allSamePoNo) return 'High';

  const amounts = members.map((m) => m.total);
  const max = Math.max(...amounts);
  const min = Math.min(...amounts);
  const ref = Math.max(Math.abs(max), 1);
  const pctDiff = Math.abs(max - min) / ref;
  if (pctDiff <= 0.01) return 'Medium';
  return 'Low';
}

const CONFIDENCE_ORDER: Confidence[] = ['High', 'Medium', 'Low'];

const CONFIDENCE_BADGE: Record<Confidence, 'danger' | 'warning' | 'secondary'> = {
  High: 'danger',
  Medium: 'warning',
  Low: 'secondary',
};

/* ── props ───────────────────────────────────────────────────────────── */

export interface DuplicatesClientProps {
  groups: PurchaseOrderDuplicateGroup[];
  /** ISO string of when the scan last ran (server-computed). */
  lastScanAt: string;
}

/* ── component ───────────────────────────────────────────────────────── */

export function DuplicatesClient({
  groups,
  lastScanAt,
}: DuplicatesClientProps): React.JSX.Element {
  const { toast } = useZoruToast();

  const [confidenceFilter, setConfidenceFilter] = React.useState<string>('all');
  /** Set of group keys the user has chosen to ignore (hidden client-side). */
  const [ignored, setIgnored] = React.useState<Set<string>>(new Set());
  /** Group keys that are currently being merged. */
  const [merging, setMerging] = React.useState<Set<string>>(new Set());

  /* ── derived ──────────────────────────────────────────────────────── */

  const annotated = React.useMemo(
    () =>
      groups.map((g) => ({ group: g, confidence: groupConfidence(g) })),
    [groups],
  );

  const visible = React.useMemo(
    () =>
      annotated.filter(({ group, confidence }) => {
        if (ignored.has(group.key)) return false;
        if (confidenceFilter !== 'all' && confidence !== confidenceFilter) return false;
        return true;
      }),
    [annotated, ignored, confidenceFilter],
  );

  /* ── KPIs ──────────────────────────────────────────────────────────── */

  const kpis = React.useMemo(() => {
    const totalGroups = groups.length;
    const totalAffected = groups.reduce((s, g) => s + g.members.length, 0);
    const estimated = groups.reduce((s, g) => s + (g.members.length - 1), 0);
    return { totalGroups, totalAffected, estimated };
  }, [groups]);

  /* ── actions ───────────────────────────────────────────────────────── */

  const handleIgnore = React.useCallback(
    (key: string) => {
      setIgnored((prev) => new Set([...prev, key]));
      toast({ title: 'Group ignored', description: 'Group hidden for this session.' });
    },
    [toast],
  );

  const handleMerge = React.useCallback(
    async (group: PurchaseOrderDuplicateGroup) => {
      if (merging.has(group.key)) return;
      setMerging((prev) => new Set([...prev, group.key]));
      // Keep the first member, delete the rest.
      const toDelete = group.members.slice(1).map((m) => m._id);
      try {
        const result = await bulkDeletePurchaseOrders(toDelete);
        if (result.error) {
          toast({ title: 'Merge failed', description: result.error, variant: 'destructive' });
        } else {
          toast({
            title: 'Merged',
            description: `Kept PO ${group.members[0].poNo || group.members[0]._id.slice(-6)}, deleted ${result.processed} duplicate(s).`,
          });
          setIgnored((prev) => new Set([...prev, group.key]));
        }
      } catch (e) {
        toast({
          title: 'Merge failed',
          description: e instanceof Error ? e.message : 'Unexpected error.',
          variant: 'destructive',
        });
      } finally {
        setMerging((prev) => {
          const next = new Set(prev);
          next.delete(group.key);
          return next;
        });
      }
    },
    [merging, toast],
  );

  const exportCsv = React.useCallback(() => {
    const headers = ['Group', 'Confidence', 'PO #', 'Vendor', 'Total', 'Status', 'PO Date'];
    const rows = groups.flatMap((g) => {
      const conf = groupConfidence(g);
      return g.members.map((m) => [
        g.key,
        conf,
        m.poNo ?? '',
        m.vendorId ?? '',
        String(m.total),
        m.status ?? '',
        m.date ? new Date(m.date).toLocaleDateString() : '',
      ]);
    });
    downloadCsv(`po-duplicates-${dateStamp()}.csv`, headers, rows);
  }, [groups]);

  /* ── render ────────────────────────────────────────────────────────── */

  return (
    <div className="flex flex-col gap-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Duplicate groups" value={String(kpis.totalGroups)} />
        <StatCard label="Records affected" value={String(kpis.totalAffected)} />
        <StatCard label="Est. duplicates" value={String(kpis.estimated)} />
        <StatCard
          label="Last scan"
          value={
            lastScanAt
              ? new Date(lastScanAt).toLocaleString()
              : '—'
          }
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-[11px]">Confidence</Label>
          <Select value={confidenceFilter} onValueChange={setConfidenceFilter}>
            <ZoruSelectTrigger className="w-36">
              <ZoruSelectValue />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              <ZoruSelectItem value="all">All</ZoruSelectItem>
              {CONFIDENCE_ORDER.map((c) => (
                <ZoruSelectItem key={c} value={c}>
                  {c}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
        {ignored.size > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIgnored(new Set())}
          >
            <X className="h-3.5 w-3.5" /> Show {ignored.size} ignored
          </Button>
        )}
      </div>

      {/* No results */}
      {visible.length === 0 && (
        <Card className="p-6 text-center text-[13px] text-zoru-ink-muted">
          {groups.length === 0
            ? 'No duplicate clusters found. Purchase orders are matched when they share a vendor and either the same PO number or totals within 1% issued within 7 days.'
            : 'No groups match the selected confidence filter.'}
        </Card>
      )}

      {/* Group cards */}
      {visible.map(({ group, confidence }) => (
        <Card key={group.key} className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zoru-line bg-zoru-surface-2 px-4 py-3">
            <div className="flex items-center gap-2">
              <Badge variant={CONFIDENCE_BADGE[confidence]}>{confidence} confidence</Badge>
              <Badge variant="outline">{group.members.length} POs</Badge>
              <span className="text-[12px] text-zoru-ink-muted">
                Vendor: {group.members[0].vendorId ?? 'unknown'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleMerge(group)}
                disabled={merging.has(group.key)}
              >
                {merging.has(group.key) ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <GitMerge className="h-3.5 w-3.5" />
                )}
                Merge (keep first)
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleIgnore(group.key)}
              >
                <X className="h-3.5 w-3.5" /> Ignore
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <ZoruTableHeader>
                <ZoruTableRow className="hover:bg-transparent">
                  <ZoruTableHead>PO #</ZoruTableHead>
                  <ZoruTableHead>Matching fields</ZoruTableHead>
                  <ZoruTableHead className="text-right">Total</ZoruTableHead>
                  <ZoruTableHead>Status</ZoruTableHead>
                  <ZoruTableHead>PO date</ZoruTableHead>
                  <ZoruTableHead />
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {group.members.map((m, idx) => {
                  const matchFields: string[] = [];
                  if (m.vendorId) matchFields.push('vendor');
                  if (m.poNo && m.poNo === group.members[0].poNo) matchFields.push('PO #');
                  const refAmt = group.members[0].total;
                  const refMax = Math.max(Math.abs(refAmt), 1);
                  if (Math.abs(m.total - refAmt) / refMax <= 0.01) matchFields.push('amount');
                  return (
                    <ZoruTableRow key={m._id} className={idx === 0 ? 'bg-zoru-surface-2/50' : ''}>
                      <ZoruTableCell className="font-medium">
                        <Link
                          href={`/dashboard/crm/purchases/orders/${m._id}`}
                          className="text-zoru-ink hover:underline"
                        >
                          {m.poNo || m._id.slice(-6)}
                        </Link>
                        {idx === 0 && (
                          <Badge variant="secondary" className="ml-2 text-[10px]">
                            Keep
                          </Badge>
                        )}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <div className="flex flex-wrap gap-1">
                          {matchFields.map((f) => (
                            <Badge key={f} variant="outline" className="text-[11px]">
                              {f}
                            </Badge>
                          ))}
                        </div>
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right font-mono tabular-nums">
                        {fmtMoney(m.total, m.currency ?? 'INR')}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink-muted">
                        {m.status ?? '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink-muted">
                        {fmtDate(m.date)}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/dashboard/crm/purchases/orders/${m._id}`}>
                            Open
                          </Link>
                        </Button>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })}
              </ZoruTableBody>
            </Table>
          </div>
        </Card>
      ))}
    </div>
  );
}
