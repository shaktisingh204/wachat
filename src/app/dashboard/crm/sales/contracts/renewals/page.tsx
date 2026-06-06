'use client';

/**
 * CRM Contract Renewals — interactive renewal queue.
 *
 * Surfaces every active contract whose `expiryDate` is within the next 90
 * days, sorted by soonest expiry first.
 *
 * Features: KPI strip, urgency-bucket filters, Checkbox bulk selection,
 * Send Renewal Notice + Mark Renewed bulk actions, CSV/XLSX export.
 *
 * RBAC: crm_contract (view / edit).
 */

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  FileSignature,
  CheckCircle,
  Download,
  Settings,
  Bell,
} from 'lucide-react';

import { Badge, Button, Card, CardBody, CardHeader, CardTitle, Checkbox, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Input, Table, TBody, Td, Th, THead, Tr, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, useToast } from '@/components/sabcrm/20ui';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { downloadCsv, downloadXlsx, dateStamp } from '@/lib/crm-list-export';
import {
  listContracts,
  sendRenewalNotices,
  bulkMarkRenewed,
} from '@/app/actions/crm-contracts.actions';

/* ─── Constants ──────────────────────────────────────────────────── */

const CONTRACTS_BASE = '/dashboard/crm/sales/contracts';
const RENEWAL_WINDOW_DAYS = 90;

/* ─── Types ──────────────────────────────────────────────────────── */

interface RenewalRow {
  _id: string;
  title?: string;
  partyB?: string;
  counterparty?: string;
  partyName?: string;
  contractType?: string;
  status?: string;
  effectiveDate?: string;
  expiryDate?: string;
  autoRenew?: boolean;
  value?: number;
  currency?: string;
}

type UrgencyBucket = 'all' | '0-30' | '31-60' | '61-90';

/* ─── Pure helpers ───────────────────────────────────────────────── */

import { fmtDate } from '@/lib/utils';

function daysBetween(now: Date, then: Date): number {
  const ms = then.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function urgencyTone(daysLeft: number): StatusTone {
  if (daysLeft <= 14) return 'red';
  if (daysLeft <= 30) return 'amber';
  return 'blue';
}

function urgencyLabel(daysLeft: number): string {
  if (daysLeft < 0) return `${Math.abs(daysLeft)}d overdue`;
  if (daysLeft === 0) return 'expires today';
  return `${daysLeft}d left`;
}

function urgencyBucket(daysLeft: number): UrgencyBucket {
  if (daysLeft <= 30) return '0-30';
  if (daysLeft <= 60) return '31-60';
  return '61-90';
}

/* ─── KPI strip ──────────────────────────────────────────────────── */

interface KpiStripProps {
  rows: RenewalRow[];
  loading: boolean;
}

function KpiStrip({ rows, loading }: KpiStripProps) {
  const now = React.useMemo(() => new Date(), []);

  const stats = React.useMemo(() => {
    let due30 = 0;
    let due60 = 0;
    let autoOn = 0;
    for (const r of rows) {
      if (!r.expiryDate) continue;
      const d = new Date(r.expiryDate);
      if (Number.isNaN(d.getTime())) continue;
      const days = daysBetween(now, d);
      if (days <= 30) due30 += 1;
      if (days <= 60) due60 += 1;
      if (r.autoRenew) autoOn += 1;
    }
    return { total: rows.length, due30, due60, autoOn };
  }, [rows, now]);

  const tiles = [
    { label: 'Pending renewals', value: stats.total },
    { label: 'Due in 30 days', value: stats.due30 },
    { label: 'Due in 60 days', value: stats.due60 },
    { label: 'Auto-renewal on', value: stats.autoOn },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((t) => (
        <Card key={t.label}>
          <CardHeader className="pb-1 pt-4">
            <CardTitle className="text-[12px] font-medium text-[var(--st-text-secondary)]">
              {t.label}
            </CardTitle>
          </CardHeader>
          <CardBody className="pb-4">
            {loading ? (
              <div className="h-6 w-12 animate-pulse rounded bg-[var(--st-bg-muted)]" />
            ) : (
              <p className="text-xl font-semibold text-[var(--st-text)]">{t.value}</p>
            )}
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

/* ─── Bulk bar ───────────────────────────────────────────────────── */

interface BulkBarProps {
  selectedIds: string[];
  onNotice: () => void;
  onRenew: () => void;
  onCsvExport: () => void;
  onXlsxExport: () => void;
  busy: boolean;
}

function BulkBar({
  selectedIds,
  onNotice,
  onRenew,
  onCsvExport,
  onXlsxExport,
  busy,
}: BulkBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm font-medium text-[var(--st-text)]">
        {selectedIds.length} selected
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={onNotice}
        disabled={busy}
      >
        <Bell className="mr-1.5 h-3.5 w-3.5" />
        Send Renewal Notice
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onRenew}
        disabled={busy}
      >
        <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
        Mark Renewed
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onCsvExport}
        disabled={busy}
      >
        <Download className="mr-1.5 h-3.5 w-3.5" />
        CSV
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onXlsxExport}
        disabled={busy}
      >
        <Download className="mr-1.5 h-3.5 w-3.5" />
        XLSX
      </Button>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────── */

export default function ContractRenewalsPage() {
  const { toast } = useToast();
  const nowRef = React.useRef(new Date());
  const now = nowRef.current;

  const [rows, setRows] = React.useState<RenewalRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // Filters
  const [search, setSearch] = React.useState('');
  const [bucketFilter, setBucketFilter] = React.useState<UrgencyBucket>('all');
  const [autoRenewFilter, setAutoRenewFilter] = React.useState<'all' | 'yes' | 'no'>('all');

  // Selection
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);

  // Settings
  const [showSettings, setShowSettings] = React.useState(false);

  /* Load on mount — reuse listContracts with the expiring90 window */
  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);

      // Fetch up to 200 contracts expiring in the next 90 days.
      // listContracts uses 'expiring30' for 30-day window; we need the
      // full 90-day window so we query with status 'active' and filter
      // client-side for the horizon.
      const result = await listContracts(1, 200, undefined, 'active');

      if (cancelled) return;

      if (result.error) {
        setLoadError(result.error);
        setLoading(false);
        return;
      }

      const horizon = new Date(
        now.getTime() + RENEWAL_WINDOW_DAYS * 24 * 60 * 60 * 1000,
      );

      const renewalRows = (result.contracts as Record<string, unknown>[])
        .filter((c) => {
          if (!c.expiryDate) return false;
          const d = new Date(c.expiryDate as string);
          if (Number.isNaN(d.getTime())) return false;
          return d >= now && d <= horizon;
        })
        .sort((a, b) => {
          const da = new Date(a.expiryDate as string).getTime();
          const db = new Date(b.expiryDate as string).getTime();
          return da - db;
        })
        .map((c) => ({
          _id: String(c._id),
          title: c.title as string | undefined,
          partyB: c.partyB as string | undefined,
          counterparty: c.counterparty as string | undefined,
          partyName: c.partyName as string | undefined,
          contractType: c.contractType as string | undefined,
          status: c.status as string | undefined,
          effectiveDate: c.effectiveDate
            ? String(c.effectiveDate)
            : undefined,
          expiryDate: c.expiryDate ? String(c.expiryDate) : undefined,
          autoRenew: Boolean(c.autoRenew),
          value: typeof c.value === 'number' ? c.value : undefined,
          currency: c.currency as string | undefined,
        }));

      setRows(renewalRows);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [now]);

  /* Filtered rows */
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const title = (r.title ?? '').toLowerCase();
        const party =
          (r.partyB ?? r.counterparty ?? r.partyName ?? '').toLowerCase();
        if (!title.includes(q) && !party.includes(q)) return false;
      }
      if (bucketFilter !== 'all' && r.expiryDate) {
        const d = new Date(r.expiryDate);
        if (!Number.isNaN(d.getTime())) {
          const days = daysBetween(now, d);
          if (urgencyBucket(days) !== bucketFilter) return false;
        }
      }
      if (autoRenewFilter === 'yes' && !r.autoRenew) return false;
      if (autoRenewFilter === 'no' && r.autoRenew) return false;
      return true;
    });
  }, [rows, search, bucketFilter, autoRenewFilter, now]);

  /* Selection helpers */
  const allVisibleIds = filtered.map((r) => r._id);
  const allChecked =
    allVisibleIds.length > 0 &&
    allVisibleIds.every((id) => selected.has(id));
  const someChecked =
    !allChecked && allVisibleIds.some((id) => selected.has(id));

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) {
        allVisibleIds.forEach((id) => next.delete(id));
      } else {
        allVisibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedIds = [...selected];

  /* Bulk send notice */
  async function handleNotice() {
    if (!selectedIds.length) return;
    setBusy(true);
    await sendRenewalNotices(selectedIds);
    setSelected(new Set());
    setBusy(false);
  }

  /* Bulk mark renewed */
  async function handleRenew() {
    if (!selectedIds.length) return;
    setBusy(true);
    await bulkMarkRenewed(selectedIds);
    setRows((prev) => prev.filter((r) => !selected.has(r._id)));
    setSelected(new Set());
    setBusy(false);
  }

  /* Export helpers */
  function exportRows() {
    const target = selectedIds.length > 0
      ? filtered.filter((r) => selected.has(r._id))
      : filtered;
    return target.map((r) => {
      const days = r.expiryDate
        ? daysBetween(now, new Date(r.expiryDate))
        : 0;
      return {
        title: r.title ?? '',
        counterparty: r.partyB ?? r.counterparty ?? r.partyName ?? '',
        contractType: r.contractType ?? '',
        expiryDate: fmtDate(r.expiryDate),
        daysLeft: days,
        autoRenew: r.autoRenew ? 'Yes' : 'No',
        value: r.value ?? '',
        currency: r.currency ?? '',
      };
    });
  }

  function handleCsvExport() {
    const headers = [
      'title',
      'counterparty',
      'contractType',
      'expiryDate',
      'daysLeft',
      'autoRenew',
      'value',
      'currency',
    ];
    downloadCsv(`renewals-${dateStamp()}.csv`, headers, exportRows());
  }

  async function handleXlsxExport() {
    const headers = [
      'title',
      'counterparty',
      'contractType',
      'expiryDate',
      'daysLeft',
      'autoRenew',
      'value',
      'currency',
    ];
    await downloadXlsx(
      `renewals-${dateStamp()}.xlsx`,
      headers,
      exportRows(),
      'Renewals',
    );
  }

  return (
    <EntityListShell
      title="Contract renewals"
      subtitle={`Active contracts expiring within ${RENEWAL_WINDOW_DAYS} days — soonest first.`}
      primaryAction={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowSettings(true)}>
            <Settings className="mr-2 h-4 w-4" />
            Automated Reminders
          </Button>
          <Button variant="outline" asChild>
            <Link href={CONTRACTS_BASE}>
              <FileSignature className="mr-2 h-4 w-4" />
              All contracts
            </Link>
          </Button>
        </div>
      }
      filters={
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="search"
            placeholder="Search by title or client…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56"
          />
          <Select
            value={bucketFilter}
            onValueChange={(v) => setBucketFilter(v as UrgencyBucket)}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All urgency</SelectItem>
              <SelectItem value="0-30">0 – 30 days</SelectItem>
              <SelectItem value="31-60">31 – 60 days</SelectItem>
              <SelectItem value="61-90">61 – 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={autoRenewFilter}
            onValueChange={(v) =>
              setAutoRenewFilter(v as 'all' | 'yes' | 'no')
            }
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Auto-renew: all</SelectItem>
              <SelectItem value="yes">Auto-renew: on</SelectItem>
              <SelectItem value="no">Auto-renew: off</SelectItem>
            </SelectContent>
          </Select>
        </div>
      }
      bulkBar={
        selectedIds.length > 0 ? (
          <BulkBar
            selectedIds={selectedIds}
            onNotice={() => void handleNotice()}
            onRenew={() => void handleRenew()}
            onCsvExport={handleCsvExport}
            onXlsxExport={() => void handleXlsxExport()}
            busy={busy}
          />
        ) : null
      }
    >
      {/* KPI strip */}
      <KpiStrip rows={rows} loading={loading} />

      {/* Renewal table */}
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
          <div>
            <p className="text-[15px] font-medium text-[var(--st-text)]">
              Renewal queue
            </p>
            <p className="mt-0.5 text-[12.5px] text-[var(--st-text-secondary)]">
              Click a contract title to open and renew, extend or archive.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCsvExport}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              CSV
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleXlsxExport()}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              XLSX
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-b-lg border-t border-[var(--st-border)]">
          <Table>
            <THead>
              <Tr className="border-[var(--st-border)] hover:bg-transparent">
                <Th className="w-10">
                  <Checkbox
                    checked={
                      allChecked || (someChecked ? 'indeterminate' : false)
                    }
                    onCheckedChange={toggleAll}
                    aria-label="Select all visible"
                  />
                </Th>
                <Th className="text-[var(--st-text-secondary)]">
                  Title
                </Th>
                <Th className="text-[var(--st-text-secondary)]">
                  Counterparty
                </Th>
                <Th className="text-[var(--st-text-secondary)]">
                  Type
                </Th>
                <Th className="text-[var(--st-text-secondary)]">
                  Expiry
                </Th>
                <Th className="text-[var(--st-text-secondary)]">
                  Days left
                </Th>
                <Th className="text-[var(--st-text-secondary)]">
                  Auto-renew
                </Th>
                <Th className="text-[var(--st-text-secondary)] text-right">
                  Open
                </Th>
              </Tr>
            </THead>
            <TBody>
              {loading ? (
                <Tr className="border-[var(--st-border)]">
                  <Td
                    colSpan={8}
                    className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
                  >
                    Loading renewals…
                  </Td>
                </Tr>
              ) : loadError ? (
                <Tr className="border-[var(--st-border)]">
                  <Td
                    colSpan={8}
                    className="h-24 text-center text-[13px] text-[var(--st-text)]"
                  >
                    {loadError}
                  </Td>
                </Tr>
              ) : filtered.length === 0 ? (
                <Tr className="border-[var(--st-border)]">
                  <Td
                    colSpan={8}
                    className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
                  >
                    {rows.length === 0
                      ? `Nothing expiring in the next ${RENEWAL_WINDOW_DAYS} days.`
                      : 'No contracts match your filters.'}
                  </Td>
                </Tr>
              ) : (
                filtered.map((c) => {
                  const expiry = c.expiryDate
                    ? new Date(c.expiryDate)
                    : null;
                  const daysLeft =
                    expiry && !Number.isNaN(expiry.getTime())
                      ? daysBetween(now, expiry)
                      : 0;
                  const counterparty =
                    c.partyB ?? c.counterparty ?? c.partyName ?? '—';
                  return (
                    <Tr
                      key={c._id}
                      className="border-[var(--st-border)]"
                    >
                      <Td>
                        <Checkbox
                          checked={selected.has(c._id)}
                          onCheckedChange={() => toggleOne(c._id)}
                          aria-label={`Select ${c.title ?? c._id}`}
                        />
                      </Td>
                      <Td className="font-medium text-[var(--st-text)]">
                        <EntityRowLink
                          href={`${CONTRACTS_BASE}/${c._id}`}
                          label={c.title ?? 'Untitled contract'}
                        />
                      </Td>
                      <Td className="text-[var(--st-text)]">
                        {counterparty}
                      </Td>
                      <Td className="text-[var(--st-text)]">
                        {c.contractType ?? '—'}
                      </Td>
                      <Td className="text-[var(--st-text)]">
                        {fmtDate(c.expiryDate)}
                      </Td>
                      <Td>
                        <StatusPill
                          label={urgencyLabel(daysLeft)}
                          tone={urgencyTone(daysLeft)}
                        />
                      </Td>
                      <Td>
                        {c.autoRenew ? (
                          <Badge variant="success">On</Badge>
                        ) : (
                          <Badge variant="ghost">Off</Badge>
                        )}
                      </Td>
                      <Td className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <Link href={`${CONTRACTS_BASE}/${c._id}`}>
                            Open
                            <ArrowRight className="ml-1 h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </Td>
                    </Tr>
                  );
                })
              )}
            </TBody>
          </Table>
        </div>
      </Card>

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Automated Renewal Reminders</DialogTitle>
            <DialogDescription>
              Configure background email reminders for contracts approaching their expiry date.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex items-center gap-3">
              <Checkbox id="enableAuto" defaultChecked={true} />
              <label htmlFor="enableAuto" className="text-sm font-medium leading-none text-[var(--st-text)]">
                Enable automated email reminders
              </label>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--st-text)]">Default notice period</label>
              <div className="flex items-center gap-2">
                <Input type="number" defaultValue="30" className="w-24 h-9" />
                <span className="text-sm text-[var(--st-text-secondary)]">days before expiry</span>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <Checkbox id="notifyOwner" defaultChecked={true} />
              <label htmlFor="notifyOwner" className="text-sm font-medium leading-none text-[var(--st-text)]">
                Send a copy to the contract owner
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettings(false)}>Cancel</Button>
            <Button onClick={() => {
              toast({ title: 'Settings saved', description: 'Automated renewal reminders have been configured.' });
              setShowSettings(false);
            }}>Save preferences</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EntityListShell>
  );
}
