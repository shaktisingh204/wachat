'use client';

/**
 * SabCRM Commerce — Gift cards list client
 * (`/sabcrm/commerce/gift-cards`).
 *
 * Doc-surface adopter (spec WI-16): KPI strip (active / outstanding
 * balance / total issued), the config-driven DocListPage and a
 * FULL-field 20ui Dialog drawer — code (blank ⇒ server-generated),
 * value, recipient + email, expiry, transferable and notes. Edit mode
 * additionally exposes a balance adjustment + status (crate
 * `UpdateGiftCardInput.balance`).
 *
 * Rows carry the full editable field set, so the edit drawer seeds
 * without a second fetch; a row click deep-links to `?edit=<id>`.
 */

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Archive,
  CalendarClock,
  Gift,
  Plus,
  Wallet,
} from 'lucide-react';

import {
  Alert,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  SelectField,
  Switch,
  toast,
  type SelectOption,
} from '@/components/sabcrm/20ui';
import { KpiCard } from '@/components/sabcrm/20ui/composites/charts';

import {
  DocListPage,
  formatDocMoney,
  type DocListColumn,
  type DocListPageConfig,
} from '@/app/sabcrm/finance/_components/doc-surface';
import {
  GIFT_CARD_STATUSES,
  GIFT_CARDS_PATH,
  toGiftCardFilters,
} from './gift-cards-config';

import {
  createSabcrmGiftCardFull,
  exportSabcrmGiftCardRows,
  listSabcrmGiftCardsPage,
} from '@/app/actions/sabcrm-commerce-gift-cards.actions';
import { updateSabcrmGiftCard } from '@/app/actions/sabcrm-commerce-docs.actions';
import { archiveSabcrmGiftCard } from '@/app/actions/sabcrm-commerce.actions';
import type {
  SabcrmGiftCardKpis,
  SabcrmGiftCardListRow,
} from '@/app/actions/sabcrm-commerce-gift-cards.actions.types';
import type { CrmGiftCardStatus } from '@/lib/rust-client/crm-gift-cards';

/* ─── Columns ─────────────────────────────────────────────────── */

const COLUMNS: DocListColumn<SabcrmGiftCardListRow>[] = [
  { key: 'code', header: 'Code', kind: 'text', value: (r) => r.code },
  {
    key: 'value',
    header: 'Value',
    kind: 'money',
    value: (r) => r.value,
    currency: () => 'INR',
  },
  {
    key: 'balance',
    header: 'Balance',
    kind: 'money',
    value: (r) => r.balance,
    currency: () => 'INR',
  },
  {
    key: 'issuedTo',
    header: 'Issued to',
    kind: 'text',
    value: (r) => r.issuedTo ?? '',
  },
  {
    key: 'issuedToEmail',
    header: 'Email',
    kind: 'text',
    value: (r) => r.issuedToEmail ?? '',
  },
  {
    key: 'expiryDate',
    header: 'Expires',
    kind: 'date',
    value: (r) => r.expiryDate ?? '',
  },
  { key: 'status', header: 'Status', kind: 'status', value: (r) => r.status },
];

/* ─── Drawer ──────────────────────────────────────────────────── */

const STATUS_OPTIONS: SelectOption[] = GIFT_CARD_STATUSES.map((s) => ({
  value: s.value,
  label: s.label,
}));

interface GiftCardFormState {
  code: string;
  value: string;
  balance: string;
  issuedTo: string;
  issuedToEmail: string;
  expiryDate: string;
  transferable: boolean;
  status: string | null;
  notes: string;
}

function emptyForm(): GiftCardFormState {
  return {
    code: '',
    value: '',
    balance: '',
    issuedTo: '',
    issuedToEmail: '',
    expiryDate: '',
    transferable: false,
    status: 'active',
    notes: '',
  };
}

function rowToForm(row: SabcrmGiftCardListRow): GiftCardFormState {
  return {
    code: row.code,
    value: String(row.value ?? ''),
    balance: String(row.balance ?? ''),
    issuedTo: row.issuedTo ?? '',
    issuedToEmail: row.issuedToEmail ?? '',
    expiryDate: row.expiryDate ? row.expiryDate.slice(0, 10) : '',
    transferable: row.transferable,
    status: row.status,
    notes: row.notes ?? '',
  };
}

interface GiftCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: SabcrmGiftCardListRow | null;
  onDone: () => void;
}

function GiftCardDialog({
  open,
  onOpenChange,
  editing,
  onDone,
}: GiftCardDialogProps): React.JSX.Element {
  const [form, setForm] = React.useState<GiftCardFormState>(emptyForm());
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!open) return;
    setForm(editing ? rowToForm(editing) : emptyForm());
    setError(null);
  }, [open, editing]);

  const patch = (p: Partial<GiftCardFormState>): void =>
    setForm((f) => ({ ...f, ...p }));

  const submit = (): void => {
    const value = Number(form.value);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Value must be greater than zero.');
      return;
    }
    setError(null);

    startTransition(async () => {
      const balance = Number(form.balance);
      const res = editing
        ? await updateSabcrmGiftCard(editing.id, {
            value,
            balance:
              form.balance.trim() && Number.isFinite(balance)
                ? balance
                : undefined,
            issuedTo: form.issuedTo.trim() || undefined,
            issuedToEmail: form.issuedToEmail.trim() || undefined,
            expiryDate: form.expiryDate || undefined,
            transferable: form.transferable,
            notes: form.notes.trim() || undefined,
            status: (form.status ?? 'active') as CrmGiftCardStatus,
          })
        : await createSabcrmGiftCardFull({
            code: form.code.trim() || undefined,
            value,
            issuedTo: form.issuedTo.trim() || undefined,
            issuedToEmail: form.issuedToEmail.trim() || undefined,
            expiryDate: form.expiryDate || undefined,
            transferable: form.transferable,
            notes: form.notes.trim() || undefined,
          });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(editing ? `${res.data.code} updated.` : `${res.data.code} issued.`);
      onOpenChange(false);
      onDone();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent aria-describedby="gc-desc">
        <DialogHeader>
          <DialogTitle>
            {editing ? `Edit ${editing.code}` : 'Issue gift card'}
          </DialogTitle>
          <DialogDescription id="gc-desc">
            {editing
              ? 'Adjust the balance, recipient or status. The code is fixed.'
              : 'A prepaid balance issued to a customer. Leave the code blank to auto-generate one.'}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex max-h-[68vh] flex-col gap-3 overflow-y-auto pb-2 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Code">
                <Input
                  value={form.code}
                  onChange={(e) => patch({ code: e.target.value })}
                  placeholder={editing ? undefined : 'Auto if blank'}
                  disabled={pending || Boolean(editing)}
                  autoFocus={!editing}
                />
              </Field>
              <Field label="Value" required>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={form.value}
                  onChange={(e) => patch({ value: e.target.value })}
                  placeholder="1000.00"
                  disabled={pending}
                />
              </Field>
            </div>
            {editing ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Balance">
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={form.balance}
                    onChange={(e) => patch({ balance: e.target.value })}
                    placeholder="Remaining balance"
                    disabled={pending}
                  />
                </Field>
                <Field label="Status">
                  <SelectField
                    value={form.status}
                    onChange={(v) => patch({ status: v })}
                    options={STATUS_OPTIONS}
                    disabled={pending}
                  />
                </Field>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Issued to">
                <Input
                  value={form.issuedTo}
                  onChange={(e) => patch({ issuedTo: e.target.value })}
                  placeholder="Asha Rao"
                  disabled={pending}
                />
              </Field>
              <Field label="Recipient email">
                <Input
                  type="email"
                  value={form.issuedToEmail}
                  onChange={(e) => patch({ issuedToEmail: e.target.value })}
                  placeholder="asha@example.com"
                  disabled={pending}
                />
              </Field>
            </div>
            <Field label="Expiry">
              <Input
                type="date"
                value={form.expiryDate}
                onChange={(e) => patch({ expiryDate: e.target.value })}
                disabled={pending}
                aria-label="Expiry date"
              />
            </Field>
            <Switch
              checked={form.transferable}
              onCheckedChange={(checked) => patch({ transferable: checked })}
              disabled={pending}
              label="Transferable between customers"
            />
            <Field label="Notes">
              <Input
                value={form.notes}
                onChange={(e) => patch({ notes: e.target.value })}
                placeholder="Internal note (optional)"
                disabled={pending}
              />
            </Field>
            {error ? (
              <Alert tone="danger" role="alert">
                {error}
              </Alert>
            ) : null}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant="primary" loading={pending}>
              {editing ? 'Save changes' : 'Issue gift card'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main client ─────────────────────────────────────────────── */

export interface GiftCardsClientProps {
  initialRows: SabcrmGiftCardListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmGiftCardKpis | null;
}

export function GiftCardsClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
}: GiftCardsClientProps): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [refreshToken, setRefreshToken] = React.useState(0);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SabcrmGiftCardListRow | null>(
    null,
  );

  const rowsRef = React.useRef<SabcrmGiftCardListRow[]>(initialRows);

  const editId = searchParams.get('edit');
  React.useEffect(() => {
    if (!editId) return;
    const row = rowsRef.current.find((r) => r.id === editId);
    if (row) {
      setEditing(row);
      setDialogOpen(true);
    }
    router.replace(pathname, { scroll: false });
  }, [editId, pathname, router]);

  const config = React.useMemo<DocListPageConfig<SabcrmGiftCardListRow>>(
    () => ({
      title: 'Gift cards',
      description:
        'Prepaid balances issued to customers — value, remaining balance, expiry and transferability.',
      icon: Gift,
      entity: { singular: 'gift card', plural: 'gift cards' },
      columns: COLUMNS,
      statuses: GIFT_CARD_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmGiftCardsPage(toGiftCardFilters(filters));
        if (res.ok) rowsRef.current = res.data.rows;
        return res.ok
          ? { ok: true, data: { rows: res.data.rows, hasMore: res.data.hasMore } }
          : res;
      },
      fetchAllForCsv: (filters) =>
        exportSabcrmGiftCardRows(toGiftCardFilters(filters)),
      csvFileName: 'gift-cards.csv',
      rowHref: (row) => `${GIFT_CARDS_PATH}?edit=${encodeURIComponent(row.id)}`,
      rowLabel: (row) => `gift card ${row.code}`,
      bulkActions: [
        {
          key: 'archive',
          label: 'Archive',
          icon: Archive,
          tone: 'danger',
          confirm: {
            title: 'Archive the selected gift cards?',
            description:
              'Archived gift cards can no longer be redeemed; their balance history is preserved.',
            actionLabel: 'Archive gift cards',
          },
          run: async (rows) => {
            for (const row of rows) {
              const res = await archiveSabcrmGiftCard(row.id);
              if (!res.ok) return res;
            }
            return { ok: true, data: null };
          },
        },
      ],
    }),
    [],
  );

  const kpiStrip = kpis ? (
    <>
      <KpiCard
        label="Active cards"
        icon={Gift}
        value={String(kpis.activeCount)}
        delta={`of ${kpis.count} total`}
        deltaTone={kpis.activeCount > 0 ? 'up' : 'neutral'}
      />
      <KpiCard
        label="Outstanding balance"
        icon={Wallet}
        value={formatDocMoney(kpis.outstandingBalance, kpis.currency)}
        delta="Across active cards"
        deltaTone={kpis.outstandingBalance > 0 ? 'down' : 'neutral'}
      />
      <KpiCard
        label="Total issued value"
        icon={CalendarClock}
        value={formatDocMoney(kpis.totalIssuedValue, kpis.currency)}
        delta={kpis.sampled ? 'Sampled' : 'All-time'}
      />
      <KpiCard
        label="Total cards"
        icon={Gift}
        value={String(kpis.count)}
        delta={kpis.sampled ? 'Sampled' : 'All-time'}
      />
    </>
  ) : null;

  const handleDone = (): void => {
    setRefreshToken((t) => t + 1);
    router.refresh();
  };

  return (
    <>
      <DocListPage
        config={config}
        kpis={kpiStrip}
        primaryAction={
          <Button
            variant="primary"
            iconLeft={Plus}
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            Issue gift card
          </Button>
        }
        initialRows={initialRows}
        initialHasMore={initialHasMore}
        initialError={initialError}
        refreshToken={refreshToken}
      />

      <GiftCardDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onDone={handleDone}
      />
    </>
  );
}
