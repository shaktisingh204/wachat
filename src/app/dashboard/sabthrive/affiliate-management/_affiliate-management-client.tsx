'use client';

/**
 * Affiliate management — partner list, KPI strip, and create/edit flow.
 *
 *   - PageHeader band with the primary "Add affiliate" action
 *   - KPI strip (active affiliates, blended commission, lifetime earnings)
 *   - Search toolbar + affiliates Table (referral code, commission, earnings)
 *   - Create / edit in a single focused Dialog with labelled Fields
 *   - EmptyState when no partners exist
 */

import * as React from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Users,
  Percent,
  Wallet,
  Handshake,
} from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  EmptyState,
  Field,
  IconButton,
  Input,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
  SearchInput,
  StatCard,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  useToast,
} from '@/components/sabcrm/20ui';

import {
  createAffiliate,
  updateAffiliate,
  deleteAffiliate,
} from '@/app/actions/marketing/affiliate-management.actions';

type Affiliate = {
  _id: string;
  name?: string;
  code?: string;
  commissionRate?: number;
  earnings?: number;
};

const CURRENCY = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function formatRate(rate: number | undefined): string {
  if (typeof rate !== 'number' || Number.isNaN(rate)) return '0%';
  return `${rate}%`;
}

export function AffiliateClient({
  initialData,
}: {
  initialData: Affiliate[];
}): React.JSX.Element {
  const { toast } = useToast();
  const [data, setData] = React.useState<Affiliate[]>(initialData);
  const [search, setSearch] = React.useState('');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Affiliate | null>(null);
  const [saving, setSaving] = React.useState(false);

  const [name, setName] = React.useState('');
  const [code, setCode] = React.useState('');
  const [commissionRate, setCommissionRate] = React.useState('0');

  const query = search.trim().toLowerCase();
  const rows = query
    ? data.filter(
        (item) =>
          (item.name || '').toLowerCase().includes(query) ||
          (item.code || '').toLowerCase().includes(query),
      )
    : data;

  const totals = React.useMemo(() => {
    const earnings = data.reduce((sum, a) => sum + (a.earnings || 0), 0);
    const avgRate =
      data.length > 0
        ? data.reduce((sum, a) => sum + (a.commissionRate || 0), 0) / data.length
        : 0;
    return { earnings, avgRate };
  }, [data]);

  const openNew = React.useCallback(() => {
    setEditing(null);
    setName('');
    setCode('');
    setCommissionRate('0');
    setDialogOpen(true);
  }, []);

  const openEdit = React.useCallback((item: Affiliate) => {
    setEditing(item);
    setName(item.name || '');
    setCode(item.code || '');
    setCommissionRate(String(item.commissionRate ?? 0));
    setDialogOpen(true);
  }, []);

  const handleSave = React.useCallback(async () => {
    const payload = {
      name: name.trim(),
      code: code.trim(),
      commissionRate: Number(commissionRate) || 0,
    };
    if (!payload.name || !payload.code) {
      toast.error({
        title: 'Missing details',
        description: 'Add both a partner name and a referral code.',
      });
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const res = await updateAffiliate(editing._id, payload);
        if (res.success) {
          setData((prev) =>
            prev.map((i) => (i._id === editing._id ? { ...i, ...payload } : i)),
          );
          toast.success('Affiliate updated');
          setDialogOpen(false);
        } else {
          toast.error({
            title: 'Could not update affiliate',
            description: res.error || 'Please try again.',
          });
        }
      } else {
        const res = await createAffiliate(payload);
        if (res.success) {
          window.location.reload();
        } else {
          toast.error({
            title: 'Could not add affiliate',
            description: res.error || 'Please try again.',
          });
        }
      }
    } catch {
      toast.error({
        title: 'Something went wrong',
        description: 'The change was not saved. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  }, [name, code, commissionRate, editing, toast]);

  const handleDelete = React.useCallback(
    async (item: Affiliate) => {
      if (
        !confirm(
          `Remove ${item.name || 'this affiliate'}? This cannot be undone.`,
        )
      )
        return;
      const res = await deleteAffiliate(item._id);
      if (res.success) {
        setData((prev) => prev.filter((i) => i._id !== item._id));
        toast.success('Affiliate removed');
      } else {
        toast.error({
          title: 'Could not remove affiliate',
          description: res.error || 'Please try again.',
        });
      }
    },
    [toast],
  );

  return (
    <main className="flex flex-col gap-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>Marketing</PageEyebrow>
          <PageTitle>Affiliates</PageTitle>
          <PageDescription>
            Manage referral partners, their commission rates, and the earnings
            they have generated.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="primary" iconLeft={Plus} onClick={openNew}>
                Add affiliate
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editing ? 'Edit affiliate' : 'Add affiliate'}
                </DialogTitle>
                <DialogDescription>
                  {editing
                    ? 'Update this partner’s details and commission rate.'
                    : 'Invite a referral partner and set their commission rate.'}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-[var(--st-space-4)] py-[var(--st-space-2)]">
                <Field label="Partner name" required>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Northwind Partners"
                    autoFocus
                  />
                </Field>
                <Field
                  label="Referral code"
                  required
                  help="Shared with customers to attribute referrals."
                >
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="NORTHWIND10"
                  />
                </Field>
                <Field label="Commission rate" help="Percentage of each sale.">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.5"
                    value={commissionRate}
                    onChange={(e) => setCommissionRate(e.target.value)}
                    suffix="%"
                  />
                </Field>
              </div>
              <DialogFooter>
                <Button
                  variant="secondary"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  loading={saving}
                  onClick={handleSave}
                >
                  {editing ? 'Save changes' : 'Add affiliate'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </PageActions>
      </PageHeader>

      <section
        aria-label="Affiliate metrics"
        className="grid grid-cols-1 gap-[var(--st-space-3)] sm:grid-cols-3"
      >
        <StatCard
          label="Active affiliates"
          value={data.length.toLocaleString()}
          icon={Users}
          accent="#3b7af5"
        />
        <StatCard
          label="Average commission"
          value={`${totals.avgRate.toFixed(1)}%`}
          icon={Percent}
          accent="#7c3aed"
        />
        <StatCard
          label="Lifetime earnings"
          value={CURRENCY.format(totals.earnings)}
          icon={Wallet}
          accent="#1f9d55"
        />
      </section>

      <Card className="p-0">
        <div className="flex items-center justify-between gap-[var(--st-space-3)] border-b border-[var(--st-border)] p-[var(--st-space-3)]">
          <div className="w-full max-w-xs">
            <SearchInput
              value={search}
              onValueChange={setSearch}
              placeholder="Search by name or code"
            />
          </div>
          <span className="shrink-0 text-[13px] tabular-nums text-[var(--st-text-secondary)]">
            {rows.length} of {data.length}
          </span>
        </div>

        {data.length === 0 ? (
          <EmptyState
            icon={Handshake}
            title="No affiliates yet"
            description="Add your first referral partner to start tracking commissions and earnings."
            action={
              <Button variant="primary" iconLeft={Plus} onClick={openNew}>
                Add affiliate
              </Button>
            }
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No matches"
            description={`No affiliates match “${search}”. Try a different name or code.`}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <Tr>
                  <Th>Partner</Th>
                  <Th>Referral code</Th>
                  <Th align="right">Commission</Th>
                  <Th align="right">Earnings</Th>
                  <Th align="right">Actions</Th>
                </Tr>
              </THead>
              <TBody>
                {rows.map((item) => (
                  <Tr key={item._id}>
                    <Td className="font-medium text-[var(--st-text)]">
                      {item.name || 'Untitled partner'}
                    </Td>
                    <Td>
                      <Badge tone="neutral" kind="outline">
                        {item.code || '—'}
                      </Badge>
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {formatRate(item.commissionRate)}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {CURRENCY.format(item.earnings || 0)}
                    </Td>
                    <Td align="right">
                      <div className="flex items-center justify-end gap-1">
                        <IconButton
                          label={`Edit ${item.name || 'affiliate'}`}
                          icon={Pencil}
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(item)}
                        />
                        <IconButton
                          label={`Remove ${item.name || 'affiliate'}`}
                          icon={Trash2}
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(item)}
                        />
                      </div>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </Card>
    </main>
  );
}
