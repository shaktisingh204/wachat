'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCheckbox,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import { Check, Clock, UserCheck, X } from 'lucide-react';
import {
  approveSignup,
  bulkApprove,
  bulkReject,
  getPendingSignups,
  rejectSignup,
  type PendingSignupRow,
} from '@/app/actions/client-signup.actions';

type Kpis = { totalPending: number; oldestDays: number };

export function PendingApprovalsClient({
  initialRows,
  initialKpis,
  loadError,
}: {
  initialRows: PendingSignupRow[];
  initialKpis: Kpis;
  loadError: string | null;
}) {
  const { toast } = useZoruToast();
  const [rows, setRows] = useState(initialRows);
  const [kpis, setKpis] = useState<Kpis>(initialKpis);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [rejectOpen, setRejectOpen] = useState<{ ids: string[] } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const allSelected = useMemo(
    () => rows.length > 0 && selected.size === rows.length,
    [rows, selected],
  );

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r._id)));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const refresh = async () => {
    try {
      const next = await getPendingSignups();
      setRows(next.rows);
      setKpis(next.kpis);
      setSelected(new Set());
    } catch (e: unknown) {
      toast({
        title: 'Reload failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleApprove = (id: string) => {
    startTransition(async () => {
      const res = await approveSignup(id);
      if (res.error) {
        toast({ title: 'Approve failed', description: res.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Signup approved' });
      void refresh();
    });
  };

  const openReject = (ids: string[]) => {
    setRejectReason('');
    setRejectOpen({ ids });
  };

  const handleConfirmReject = () => {
    if (!rejectOpen) return;
    const ids = rejectOpen.ids;
    startTransition(async () => {
      const res =
        ids.length === 1
          ? await rejectSignup(ids[0], rejectReason)
          : await bulkReject(ids, rejectReason);
      if (res.error) {
        toast({ title: 'Reject failed', description: res.error, variant: 'destructive' });
        return;
      }
      toast({ title: `Rejected ${ids.length} signup${ids.length === 1 ? '' : 's'}` });
      setRejectOpen(null);
      void refresh();
    });
  };

  const handleBulkApprove = () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startTransition(async () => {
      const res = await bulkApprove(ids);
      if (res.error) {
        toast({ title: 'Bulk approve failed', description: res.error, variant: 'destructive' });
        return;
      }
      toast({ title: `Approved ${res.count ?? ids.length} signups` });
      void refresh();
    });
  };

  if (loadError) {
    return (
      <ZoruCard className="p-8 text-center">
        <p className="text-sm text-zoru-danger">{loadError}</p>
      </ZoruCard>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Pending approvals</ZoruPageTitle>
          <ZoruPageDescription>
            Review new client signups awaiting admin approval. Approve to activate, or reject with a reason.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </ZoruPageHeader>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2">
        <ZoruCard className="p-6">
          <div className="flex items-center justify-between">
            <p className="text-[12.5px] text-zoru-ink-muted">Total pending</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zoru-surface-2">
              <UserCheck className="h-4 w-4" strokeWidth={1.75} />
            </div>
          </div>
          <p className="mt-3 text-[26px] leading-none text-zoru-ink">{kpis.totalPending}</p>
        </ZoruCard>
        <ZoruCard className="p-6">
          <div className="flex items-center justify-between">
            <p className="text-[12.5px] text-zoru-ink-muted">Oldest pending</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zoru-surface-2">
              <Clock className="h-4 w-4" strokeWidth={1.75} />
            </div>
          </div>
          <p className="mt-3 text-[26px] leading-none text-zoru-ink">
            {kpis.oldestDays} day{kpis.oldestDays === 1 ? '' : 's'}
          </p>
        </ZoruCard>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <ZoruCard className="flex flex-wrap items-center justify-between gap-3 p-4">
          <span className="text-sm text-zoru-ink-muted">
            {selected.size} selected
          </span>
          <div className="flex items-center gap-2">
            <ZoruButton size="sm" onClick={handleBulkApprove} disabled={isPending}>
              <Check className="h-4 w-4" strokeWidth={1.75} /> Approve all
            </ZoruButton>
            <ZoruButton
              size="sm"
              variant="outline"
              onClick={() => openReject(Array.from(selected))}
              disabled={isPending}
            >
              <X className="h-4 w-4" strokeWidth={1.75} /> Reject all
            </ZoruButton>
          </div>
        </ZoruCard>
      )}

      {/* Table */}
      <ZoruCard>
        <ZoruTable>
          <ZoruTableHeader>
            <ZoruTableRow>
              <ZoruTableHead className="w-10">
                <ZoruCheckbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
              </ZoruTableHead>
              <ZoruTableHead>Name</ZoruTableHead>
              <ZoruTableHead>Email</ZoruTableHead>
              <ZoruTableHead>Company</ZoruTableHead>
              <ZoruTableHead>Signed up</ZoruTableHead>
              <ZoruTableHead>Pending</ZoruTableHead>
              <ZoruTableHead className="text-right">Actions</ZoruTableHead>
            </ZoruTableRow>
          </ZoruTableHeader>
          <ZoruTableBody>
            {rows.length === 0 ? (
              <ZoruTableRow>
                <ZoruTableCell colSpan={7} className="py-12 text-center text-sm text-zoru-ink-muted">
                  No signups awaiting approval.
                </ZoruTableCell>
              </ZoruTableRow>
            ) : (
              rows.map((row) => (
                <ZoruTableRow key={row._id}>
                  <ZoruTableCell>
                    <ZoruCheckbox
                      checked={selected.has(row._id)}
                      onCheckedChange={() => toggleOne(row._id)}
                      aria-label={`Select ${row.name}`}
                    />
                  </ZoruTableCell>
                  <ZoruTableCell className="font-medium">{row.name}</ZoruTableCell>
                  <ZoruTableCell className="text-zoru-ink-muted">{row.email}</ZoruTableCell>
                  <ZoruTableCell>{row.company || '—'}</ZoruTableCell>
                  <ZoruTableCell className="text-zoru-ink-muted">
                    {new Date(row.signedUpAt).toLocaleString()}
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <ZoruBadge variant={row.daysPending > 7 ? 'destructive' : 'ghost'}>
                      {row.daysPending}d
                    </ZoruBadge>
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <div className="flex items-center justify-end gap-2">
                      <ZoruButton
                        size="sm"
                        onClick={() => handleApprove(row._id)}
                        disabled={isPending}
                      >
                        Approve
                      </ZoruButton>
                      <ZoruButton
                        size="sm"
                        variant="outline"
                        onClick={() => openReject([row._id])}
                        disabled={isPending}
                      >
                        Reject
                      </ZoruButton>
                    </div>
                  </ZoruTableCell>
                </ZoruTableRow>
              ))
            )}
          </ZoruTableBody>
        </ZoruTable>
      </ZoruCard>

      <ZoruDialog open={rejectOpen !== null} onOpenChange={(o) => !o && setRejectOpen(null)}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Reject signup{rejectOpen && rejectOpen.ids.length > 1 ? 's' : ''}</ZoruDialogTitle>
            <ZoruDialogDescription>
              The user will be notified. Rejected accounts are kept for 30 days then auto-deleted.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <ZoruTextarea
            placeholder="Reason for rejection (optional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
          />
          <ZoruDialogFooter>
            <ZoruButton variant="outline" onClick={() => setRejectOpen(null)}>
              Cancel
            </ZoruButton>
            <ZoruButton onClick={handleConfirmReject} disabled={isPending}>
              Confirm reject
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>
    </div>
  );
}
