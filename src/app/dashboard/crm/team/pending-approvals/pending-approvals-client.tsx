'use client';

import { useMemo, useState, useTransition } from 'react';
import { Badge, Button, Card, Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, PageDescription, PageHeader, PageHeading, PageTitle, Table, TBody, Td, Th, THead, Tr, Textarea, useToast } from '@/components/sabcrm/20ui';
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
  const { toast } = useToast();
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
      <Card className="p-8 text-center">
        <p className="text-sm text-[var(--st-danger)]">{loadError}</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>Pending approvals</PageTitle>
          <PageDescription>
            Review new client signups awaiting admin approval. Approve to activate, or reject with a reason.
          </PageDescription>
        </PageHeading>
      </PageHeader>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <p className="text-[12.5px] text-[var(--st-text-secondary)]">Total pending</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--st-bg-muted)]">
              <UserCheck className="h-4 w-4" strokeWidth={1.75} />
            </div>
          </div>
          <p className="mt-3 text-[26px] leading-none text-[var(--st-text)]">{kpis.totalPending}</p>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <p className="text-[12.5px] text-[var(--st-text-secondary)]">Oldest pending</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--st-bg-muted)]">
              <Clock className="h-4 w-4" strokeWidth={1.75} />
            </div>
          </div>
          <p className="mt-3 text-[26px] leading-none text-[var(--st-text)]">
            {kpis.oldestDays} day{kpis.oldestDays === 1 ? '' : 's'}
          </p>
        </Card>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <span className="text-sm text-[var(--st-text-secondary)]">
            {selected.size} selected
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleBulkApprove} disabled={isPending}>
              <Check className="h-4 w-4" strokeWidth={1.75} /> Approve all
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => openReject(Array.from(selected))}
              disabled={isPending}
            >
              <X className="h-4 w-4" strokeWidth={1.75} /> Reject all
            </Button>
          </div>
        </Card>
      )}

      {/* Table */}
      <Card>
        <Table>
          <THead>
            <Tr>
              <Th className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
              </Th>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Company</Th>
              <Th>Signed up</Th>
              <Th>Pending</Th>
              <Th className="text-right">Actions</Th>
            </Tr>
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <Tr>
                <Td colSpan={7} className="py-12 text-center text-sm text-[var(--st-text-secondary)]">
                  No signups awaiting approval.
                </Td>
              </Tr>
            ) : (
              rows.map((row) => (
                <Tr key={row._id}>
                  <Td>
                    <Checkbox
                      checked={selected.has(row._id)}
                      onCheckedChange={() => toggleOne(row._id)}
                      aria-label={`Select ${row.name}`}
                    />
                  </Td>
                  <Td className="font-medium">{row.name}</Td>
                  <Td className="text-[var(--st-text-secondary)]">{row.email}</Td>
                  <Td>{row.company || '—'}</Td>
                  <Td className="text-[var(--st-text-secondary)]">
                    {(() => {
                      const date = new Date(row.signedUpAt);
                      if (Number.isNaN(date.getTime())) return '—';
                      const day = String(date.getUTCDate()).padStart(2, '0');
                      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                      const month = months[date.getUTCMonth()];
                      const year = date.getUTCFullYear();
                      const hours = String(date.getUTCHours()).padStart(2, '0');
                      const minutes = String(date.getUTCMinutes()).padStart(2, '0');
                      return `${day} ${month} ${year} ${hours}:${minutes} UTC`;
                    })()}
                  </Td>
                  <Td>
                    <Badge variant={row.daysPending > 7 ? 'destructive' : 'ghost'}>
                      {row.daysPending}d
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleApprove(row._id)}
                        disabled={isPending}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openReject([row._id])}
                        disabled={isPending}
                      >
                        Reject
                      </Button>
                    </div>
                  </Td>
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </Card>

      <Dialog open={rejectOpen !== null} onOpenChange={(o) => !o && setRejectOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject signup{rejectOpen && rejectOpen.ids.length > 1 ? 's' : ''}</DialogTitle>
            <DialogDescription>
              The user will be notified. Rejected accounts are kept for 30 days then auto-deleted.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection (optional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(null)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmReject} disabled={isPending}>
              Confirm reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
