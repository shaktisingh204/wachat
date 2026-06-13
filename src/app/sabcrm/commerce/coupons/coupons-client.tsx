'use client';

/**
 * SabCRM Commerce — Coupons list client (`/sabcrm/commerce/coupons`).
 *
 * Doc-surface adopter (spec WI-15): KPI strip (active / redemptions /
 * expiring soon), the config-driven DocListPage and a FULL-field 20ui
 * Dialog drawer exposing every `CreateCouponInput` rule field — code,
 * type, value, minimum cart, max uses, per-customer limit, validity
 * window, applicable products (REAL item pickers — never placeholder
 * ids), stackable and notes.
 *
 * Rows carry the full editable field set (product ids + resolved
 * labels), so the edit drawer seeds without a second fetch — a row
 * click deep-links to `?edit=<id>`.
 */

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Archive,
  BadgePercent,
  CalendarClock,
  CheckCircle2,
  Plus,
  TicketPercent,
  Trash2,
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
  EntityPicker,
  formatDocMoney,
  type DocListColumn,
  type DocListPageConfig,
} from '@/app/sabcrm/finance/_components/doc-surface';
import {
  COUPON_STATUSES,
  COUPON_TYPES,
  COUPONS_PATH,
  toCouponFilters,
} from './coupons-config';

import {
  createSabcrmCouponFull,
  exportSabcrmCouponRows,
  listSabcrmCouponsPage,
} from '@/app/actions/sabcrm-commerce-coupons.actions';
import { updateSabcrmCoupon } from '@/app/actions/sabcrm-commerce-docs.actions';
import { searchSabcrmSupplyItemOptions } from '@/app/actions/sabcrm-supply-docs.actions';
import { archiveSabcrmCoupon } from '@/app/actions/sabcrm-commerce.actions';
import type {
  SabcrmCouponKpis,
  SabcrmCouponListRow,
} from '@/app/actions/sabcrm-commerce-coupons.actions.types';
import type { CrmCouponStatus, CrmCouponType } from '@/lib/rust-client/crm-coupons';

/* ─── Columns (full field coverage on the list) ───────────────── */

const COLUMNS: DocListColumn<SabcrmCouponListRow>[] = [
  { key: 'code', header: 'Code', kind: 'text', value: (r) => r.code },
  {
    key: 'type',
    header: 'Type',
    kind: 'badge',
    value: (r) => (r.type === 'fixed' ? 'Fixed' : 'Percent'),
    tone: (r) => (r.type === 'fixed' ? 'neutral' : 'info'),
  },
  {
    key: 'value',
    header: 'Value',
    kind: 'text',
    align: 'right',
    value: (r) =>
      r.type === 'fixed' ? formatDocMoney(r.value, 'INR') : `${r.value}%`,
    csv: (r) => (r.type === 'fixed' ? String(r.value) : `${r.value}%`),
  },
  {
    key: 'minCart',
    header: 'Min cart',
    kind: 'money',
    value: (r) => r.minCart ?? 0,
    currency: () => 'INR',
  },
  {
    key: 'usage',
    header: 'Used',
    kind: 'text',
    align: 'right',
    value: (r) => `${r.usedCount} / ${r.maxUses ?? '∞'}`,
  },
  { key: 'validTo', header: 'Valid until', kind: 'date', value: (r) => r.validTo ?? '' },
  { key: 'status', header: 'Status', kind: 'status', value: (r) => r.status },
];

/* ─── Drawer ──────────────────────────────────────────────────── */

const TYPE_OPTIONS: SelectOption[] = COUPON_TYPES.map((t) => ({
  value: t.value,
  label: t.label,
}));

const STATUS_OPTIONS: SelectOption[] = COUPON_STATUSES.map((s) => ({
  value: s.value,
  label: s.label,
}));

interface ProductRow {
  rowId: string;
  id: string | null;
  label: string | null;
}

interface CouponFormState {
  code: string;
  type: string | null;
  status: string | null;
  value: string;
  minCart: string;
  maxUses: string;
  perCustomerLimit: string;
  validFrom: string;
  validTo: string;
  products: ProductRow[];
  stackable: boolean;
  notes: string;
}

function rid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

function emptyForm(): CouponFormState {
  return {
    code: '',
    type: 'percent',
    status: 'draft',
    value: '',
    minCart: '',
    maxUses: '',
    perCustomerLimit: '',
    validFrom: '',
    validTo: '',
    products: [],
    stackable: false,
    notes: '',
  };
}

function rowToForm(row: SabcrmCouponListRow): CouponFormState {
  return {
    code: row.code,
    type: (row.type as string) || 'percent',
    status: row.status,
    value: String(row.value ?? ''),
    minCart: row.minCart != null ? String(row.minCart) : '',
    maxUses: row.maxUses != null ? String(row.maxUses) : '',
    perCustomerLimit:
      row.perCustomerLimit != null ? String(row.perCustomerLimit) : '',
    validFrom: row.validFrom ? row.validFrom.slice(0, 10) : '',
    validTo: row.validTo ? row.validTo.slice(0, 10) : '',
    products: row.applicableProducts.map((id, i) => ({
      rowId: rid(),
      id,
      label: row.applicableProductLabels[i] ?? null,
    })),
    stackable: row.stackable,
    notes: row.notes ?? '',
  };
}

interface CouponDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: SabcrmCouponListRow | null;
  onDone: () => void;
}

function CouponDialog({
  open,
  onOpenChange,
  editing,
  onDone,
}: CouponDialogProps): React.JSX.Element {
  const [form, setForm] = React.useState<CouponFormState>(emptyForm());
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!open) return;
    setForm(editing ? rowToForm(editing) : emptyForm());
    setError(null);
  }, [open, editing]);

  const patch = (p: Partial<CouponFormState>): void =>
    setForm((f) => ({ ...f, ...p }));

  const addProduct = (): void =>
    setForm((f) => ({
      ...f,
      products: [...f.products, { rowId: rid(), id: null, label: null }],
    }));

  const removeProduct = (rowId: string): void =>
    setForm((f) => ({
      ...f,
      products: f.products.filter((p) => p.rowId !== rowId),
    }));

  const setProduct = (
    rowId: string,
    id: string | null,
    label: string | null,
  ): void =>
    setForm((f) => ({
      ...f,
      products: f.products.map((p) =>
        p.rowId === rowId ? { ...p, id, label } : p,
      ),
    }));

  const submit = (): void => {
    if (!form.code.trim()) {
      setError('A coupon code is required.');
      return;
    }
    const value = Number(form.value);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Value must be greater than zero.');
      return;
    }
    if (form.type === 'percent' && value > 100) {
      setError('A percent coupon cannot exceed 100%.');
      return;
    }
    setError(null);

    const applicableProducts = form.products
      .map((p) => p.id)
      .filter((id): id is string => Boolean(id));
    const num = (v: string): number | undefined => {
      const n = Number(v);
      return v.trim() && Number.isFinite(n) ? n : undefined;
    };

    startTransition(async () => {
      const res = editing
        ? await updateSabcrmCoupon(editing.id, {
            code: form.code.trim().toUpperCase(),
            type: (form.type ?? 'percent') as CrmCouponType,
            value,
            minCart: num(form.minCart),
            maxUses:
              num(form.maxUses) !== undefined
                ? Math.trunc(num(form.maxUses)!)
                : undefined,
            perCustomerLimit:
              num(form.perCustomerLimit) !== undefined
                ? Math.trunc(num(form.perCustomerLimit)!)
                : undefined,
            validFrom: form.validFrom || undefined,
            validTo: form.validTo || undefined,
            applicableProducts,
            stackable: form.stackable,
            notes: form.notes.trim() || undefined,
            status: (form.status ?? 'draft') as CrmCouponStatus,
          })
        : await createSabcrmCouponFull({
            code: form.code,
            type: (form.type ?? 'percent') as CrmCouponType,
            value,
            minCart: num(form.minCart),
            maxUses: num(form.maxUses),
            perCustomerLimit: num(form.perCustomerLimit),
            validFrom: form.validFrom || undefined,
            validTo: form.validTo || undefined,
            applicableProducts,
            stackable: form.stackable,
            notes: form.notes.trim() || undefined,
          });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(editing ? `${res.data.code} updated.` : `${res.data.code} created.`);
      onOpenChange(false);
      onDone();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent aria-describedby="coupon-desc">
        <DialogHeader>
          <DialogTitle>
            {editing ? `Edit ${editing.code}` : 'New coupon'}
          </DialogTitle>
          <DialogDescription id="coupon-desc">
            {editing
              ? 'Update the discount rule. Existing redemptions are preserved.'
              : 'Promotional discount code with usage limits and a validity window.'}
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
              <Field label="Code" required>
                <Input
                  value={form.code}
                  onChange={(e) => patch({ code: e.target.value.toUpperCase() })}
                  placeholder="SUMMER50"
                  autoFocus
                  disabled={pending}
                />
              </Field>
              <Field label="Type" required>
                <SelectField
                  value={form.type}
                  onChange={(v) => patch({ type: v })}
                  options={TYPE_OPTIONS}
                  disabled={pending}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label={form.type === 'fixed' ? 'Amount off' : 'Percent off'}
                required
              >
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={form.value}
                  onChange={(e) => patch({ value: e.target.value })}
                  placeholder={form.type === 'fixed' ? '500' : '10'}
                  disabled={pending}
                />
              </Field>
              <Field label="Minimum cart">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={form.minCart}
                  onChange={(e) => patch({ minCart: e.target.value })}
                  placeholder="0.00"
                  disabled={pending}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Max uses">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={form.maxUses}
                  onChange={(e) => patch({ maxUses: e.target.value })}
                  placeholder="Unlimited"
                  disabled={pending}
                />
              </Field>
              <Field label="Per-customer limit">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={form.perCustomerLimit}
                  onChange={(e) => patch({ perCustomerLimit: e.target.value })}
                  placeholder="Unlimited"
                  disabled={pending}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Valid from">
                <Input
                  type="date"
                  value={form.validFrom}
                  onChange={(e) => patch({ validFrom: e.target.value })}
                  disabled={pending}
                  aria-label="Valid from"
                />
              </Field>
              <Field label="Valid until">
                <Input
                  type="date"
                  value={form.validTo}
                  onChange={(e) => patch({ validTo: e.target.value })}
                  disabled={pending}
                  aria-label="Valid until"
                />
              </Field>
            </div>
            {editing ? (
              <Field label="Status">
                <SelectField
                  value={form.status}
                  onChange={(v) => patch({ status: v })}
                  options={STATUS_OPTIONS}
                  disabled={pending}
                />
              </Field>
            ) : null}

            <fieldset className="flex flex-col gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] p-3">
              <legend className="px-1 text-xs font-medium text-[var(--st-text-secondary)]">
                Applicable products (leave empty to apply to the whole cart)
              </legend>
              {form.products.length === 0 ? (
                <p className="text-[12px] text-[var(--st-text-secondary)]">
                  Applies to every product.
                </p>
              ) : (
                form.products.map((p) => (
                  <div key={p.rowId} className="flex items-center gap-2">
                    <div className="flex-1">
                      <EntityPicker
                        value={p.id}
                        valueLabel={p.label}
                        onChange={(opt) =>
                          setProduct(p.rowId, opt?.id ?? null, opt?.label ?? null)
                        }
                        search={async (q) => {
                          const res = await searchSabcrmSupplyItemOptions(q);
                          return res.ok ? res.data : [];
                        }}
                        placeholder="Search items…"
                        aria-label="Applicable product"
                        disabled={pending}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      iconLeft={Trash2}
                      aria-label="Remove product"
                      disabled={pending}
                      onClick={() => removeProduct(p.rowId)}
                    />
                  </div>
                ))
              )}
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  iconLeft={Plus}
                  disabled={pending}
                  onClick={addProduct}
                >
                  Add product
                </Button>
              </div>
            </fieldset>

            <Switch
              checked={form.stackable}
              onCheckedChange={(checked) => patch({ stackable: checked })}
              disabled={pending}
              label="Stackable with other coupons"
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
              {editing ? 'Save changes' : 'Create coupon'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main client ─────────────────────────────────────────────── */

export interface CouponsClientProps {
  initialRows: SabcrmCouponListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmCouponKpis | null;
}

export function CouponsClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
}: CouponsClientProps): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [refreshToken, setRefreshToken] = React.useState(0);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SabcrmCouponListRow | null>(null);

  const rowsRef = React.useRef<SabcrmCouponListRow[]>(initialRows);

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

  const config = React.useMemo<DocListPageConfig<SabcrmCouponListRow>>(
    () => ({
      title: 'Coupons',
      description:
        'Promotional discount codes — usage limits, validity windows, product scoping and stacking.',
      icon: TicketPercent,
      entity: { singular: 'coupon', plural: 'coupons' },
      columns: COLUMNS,
      statuses: COUPON_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmCouponsPage(toCouponFilters(filters));
        if (res.ok) rowsRef.current = res.data.rows;
        return res.ok
          ? { ok: true, data: { rows: res.data.rows, hasMore: res.data.hasMore } }
          : res;
      },
      fetchAllForCsv: (filters) => exportSabcrmCouponRows(toCouponFilters(filters)),
      csvFileName: 'coupons.csv',
      rowHref: (row) => `${COUPONS_PATH}?edit=${encodeURIComponent(row.id)}`,
      rowLabel: (row) => `coupon ${row.code}`,
      bulkActions: [
        {
          key: 'activate',
          label: 'Activate',
          icon: CheckCircle2,
          run: async (rows) => {
            for (const row of rows) {
              const res = await updateSabcrmCoupon(row.id, { status: 'active' });
              if (!res.ok) return res;
            }
            return { ok: true, data: null };
          },
        },
        {
          key: 'archive',
          label: 'Archive',
          icon: Archive,
          tone: 'danger',
          confirm: {
            title: 'Archive the selected coupons?',
            description:
              'Archived coupons stop applying at checkout; redemption history is preserved.',
            actionLabel: 'Archive coupons',
          },
          run: async (rows) => {
            for (const row of rows) {
              const res = await archiveSabcrmCoupon(row.id);
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
        label="Active coupons"
        icon={BadgePercent}
        value={String(kpis.activeCount)}
        delta={`of ${kpis.count} total`}
        deltaTone={kpis.activeCount > 0 ? 'up' : 'neutral'}
      />
      <KpiCard
        label="Total redemptions"
        icon={CheckCircle2}
        value={String(kpis.totalRedemptions)}
        delta={kpis.sampled ? 'Across the latest sample' : 'All-time'}
      />
      <KpiCard
        label="Expiring soon"
        icon={CalendarClock}
        value={String(kpis.expiringSoonCount)}
        delta="Within 7 days"
        deltaTone={kpis.expiringSoonCount > 0 ? 'down' : 'neutral'}
      />
      <KpiCard
        label="Total coupons"
        icon={TicketPercent}
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
            New coupon
          </Button>
        }
        initialRows={initialRows}
        initialHasMore={initialHasMore}
        initialError={initialError}
        refreshToken={refreshToken}
      />

      <CouponDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onDone={handleDone}
      />
    </>
  );
}
