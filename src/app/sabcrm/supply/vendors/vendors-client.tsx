'use client';

/**
 * SabCRM Supply — Vendors list client (`/sabcrm/supply/vendors`),
 * rollout WI-7.
 *
 * Master-data adopter of the doc-surface kit: KPI strip (vendors /
 * with GSTIN / with bank details / vendor types), the config-driven
 * DocListPage (full field columns, search + date-range filters, server
 * pagination, CSV export, bulk delete) and a FULL-field bespoke 20ui
 * drawer — DocForm is invoice-shaped and does NOT fit master data.
 *
 * The drawer sections mirror the crate model: Identity (name, display
 * name, industry, type, logo via SabFiles), Contact (email, phone),
 * Address, Tax (GSTIN, PAN, PAN name, treatment, subject), Banking
 * (full bank-account group), Invoice flags and Attachments (SabFiles
 * ids — never a free-text URL). A row click opens the edit drawer via a
 * shareable `?edit=<id>` deep link with no second fetch (rows carry the
 * full editable field set).
 */

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Banknote,
  Building2,
  FileBadge,
  Image as ImageIcon,
  Paperclip,
  Plus,
  Trash2,
  Users,
  X,
} from 'lucide-react';

import {
  Alert,
  Button,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  Field,
  Input,
  SelectField,
  Switch,
  Tag,
  toast,
  type SelectOption,
} from '@/components/sabcrm/20ui';
import { KpiCard } from '@/components/sabcrm/20ui/composites/charts';
import { SabFilePickerButton } from '@/components/sabfiles';

import {
  DocListPage,
  type DocListColumn,
  type DocListPageConfig,
} from '@/app/sabcrm/finance/_components/doc-surface';
import {
  VENDOR_STATUSES,
  VENDOR_TAX_TREATMENTS,
  VENDOR_TYPE_OPTIONS,
  vendorEditHref,
  toVendorFilters,
} from './vendors-config';

import {
  createSabcrmSupplyVendorFull,
  exportSabcrmSupplyVendorRows,
  listSabcrmSupplyVendorsPage,
  updateSabcrmSupplyVendorFull,
} from '@/app/actions/sabcrm-supply-vendors.actions';
import { deleteSabcrmSupplyVendor } from '@/app/actions/sabcrm-supply.actions';
import type {
  SabcrmVendorFullInput,
  SabcrmVendorKpis,
  SabcrmVendorListRow,
} from '@/app/actions/sabcrm-supply-vendors.actions.types';

/* ─── Columns (full field coverage on the list) ───────────────── */

const COLUMNS: DocListColumn<SabcrmVendorListRow>[] = [
  { key: 'name', header: 'Name', kind: 'text', value: (r) => r.name },
  {
    key: 'displayName',
    header: 'Display name',
    kind: 'text',
    value: (r) => r.displayName || '—',
  },
  { key: 'email', header: 'Email', kind: 'text', value: (r) => r.email || '—' },
  { key: 'phone', header: 'Phone', kind: 'text', value: (r) => r.phone || '—' },
  {
    key: 'vendorType',
    header: 'Type',
    kind: 'badge',
    value: (r) => r.vendorType || '—',
    tone: () => 'neutral',
  },
  { key: 'gstin', header: 'GSTIN', kind: 'text', value: (r) => r.gstin || '—' },
  { key: 'city', header: 'City', kind: 'text', value: (r) => r.city || '—' },
];

/* ─── Drawer form ─────────────────────────────────────────────── */

interface VendorFormState {
  name: string;
  displayName: string;
  industry: string;
  logoUrl: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  gstin: string;
  pan: string;
  panName: string;
  vendorType: string | null;
  taxTreatment: string | null;
  subject: string;
  /* banking */
  bankAccountNumber: string;
  bankAccountHolder: string;
  bankIfsc: string;
  bankName: string;
  bankAccountType: string | null;
  bankCurrency: string;
  bankSwiftCode: string;
  bankIbanCode: string;
  /* invoice flags */
  showEmailInInvoice: boolean;
  showPhoneInInvoice: boolean;
  /* attachments (SabFiles refs — id + cached name) */
  attachments: { fileId: string; name: string }[];
}

const ACCOUNT_TYPE_OPTIONS: SelectOption[] = [
  { value: 'current', label: 'Current' },
  { value: 'savings', label: 'Savings' },
];

function emptyForm(): VendorFormState {
  return {
    name: '',
    displayName: '',
    industry: '',
    logoUrl: '',
    email: '',
    phone: '',
    street: '',
    city: '',
    state: '',
    country: '',
    pincode: '',
    gstin: '',
    pan: '',
    panName: '',
    vendorType: null,
    taxTreatment: null,
    subject: '',
    bankAccountNumber: '',
    bankAccountHolder: '',
    bankIfsc: '',
    bankName: '',
    bankAccountType: null,
    bankCurrency: '',
    bankSwiftCode: '',
    bankIbanCode: '',
    showEmailInInvoice: false,
    showPhoneInInvoice: false,
    attachments: [],
  };
}

function rowToForm(row: SabcrmVendorListRow): VendorFormState {
  const bank = row.bankAccountDetails;
  return {
    name: row.name,
    displayName: row.displayName,
    industry: row.industry,
    logoUrl: row.logoUrl,
    email: row.email,
    phone: row.phone,
    street: row.street,
    city: row.city,
    state: row.state,
    country: row.country,
    pincode: row.pincode,
    gstin: row.gstin,
    pan: row.pan,
    panName: row.panName,
    vendorType: row.vendorType || null,
    taxTreatment: row.taxTreatment || null,
    subject: row.subject,
    bankAccountNumber: bank?.accountNumber ?? '',
    bankAccountHolder: bank?.accountHolder ?? '',
    bankIfsc: bank?.ifsc ?? '',
    bankName: bank?.bankName ?? '',
    bankAccountType: bank?.accountType ?? null,
    bankCurrency: bank?.currency ?? '',
    bankSwiftCode: bank?.swiftCode ?? '',
    bankIbanCode: bank?.ibanCode ?? '',
    showEmailInInvoice: row.showEmailInInvoice,
    showPhoneInInvoice: row.showPhoneInInvoice,
    attachments: row.attachments.map((id) => ({ fileId: id, name: 'Attachment' })),
  };
}

function formToInput(form: VendorFormState): SabcrmVendorFullInput {
  return {
    name: form.name,
    displayName: form.displayName,
    industry: form.industry,
    logoUrl: form.logoUrl,
    email: form.email,
    phone: form.phone,
    street: form.street,
    city: form.city,
    state: form.state,
    country: form.country,
    pincode: form.pincode,
    gstin: form.gstin,
    pan: form.pan,
    panName: form.panName,
    vendorType: form.vendorType ?? undefined,
    taxTreatment: form.taxTreatment ?? undefined,
    subject: form.subject,
    bankAccountDetails: {
      accountNumber: form.bankAccountNumber,
      accountHolder: form.bankAccountHolder,
      ifsc: form.bankIfsc,
      bankName: form.bankName,
      accountType:
        (form.bankAccountType as 'current' | 'savings' | null) ?? undefined,
      currency: form.bankCurrency,
      swiftCode: form.bankSwiftCode,
      ibanCode: form.bankIbanCode,
    },
    showEmailInInvoice: form.showEmailInInvoice,
    showPhoneInInvoice: form.showPhoneInInvoice,
    attachments: form.attachments.map((a) => a.fileId),
  };
}

interface VendorDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null ⇒ create; a row ⇒ edit. */
  editing: SabcrmVendorListRow | null;
  onDone: () => void;
}

function VendorDrawer({
  open,
  onOpenChange,
  editing,
  onDone,
}: VendorDrawerProps): React.JSX.Element {
  const [form, setForm] = React.useState<VendorFormState>(emptyForm());
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!open) return;
    setForm(editing ? rowToForm(editing) : emptyForm());
    setError(null);
  }, [open, editing]);

  const patch = (p: Partial<VendorFormState>): void =>
    setForm((f) => ({ ...f, ...p }));

  const submit = (): void => {
    if (!form.name.trim()) {
      setError('A vendor name is required.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const input = formToInput(form);
      const res = editing
        ? await updateSabcrmSupplyVendorFull(editing.id, input)
        : await createSabcrmSupplyVendorFull(input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(
        editing ? `${res.data.name} updated.` : `${res.data.name} created.`,
      );
      onOpenChange(false);
      onDone();
    });
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => !pending && onOpenChange(next)}
      side="right"
    >
      <DrawerContent aria-describedby="vendor-desc" className="fdoc-form-drawer">
        <DrawerHeader>
          <DrawerTitle>
            {editing ? `Edit ${editing.name}` : 'New vendor'}
          </DrawerTitle>
          <DrawerDescription id="vendor-desc">
            {editing
              ? 'Update the vendor details. Purchase orders, GRNs and bids keep pointing at this vendor.'
              : 'Vendors are the suppliers your purchasing documents are raised against.'}
          </DrawerDescription>
        </DrawerHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 pb-4 pt-1">
            {/* Identity */}
            <fieldset className="flex flex-col gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] p-3">
              <legend className="px-1 text-xs font-medium text-[var(--st-text-secondary)]">
                <span className="inline-flex items-center gap-1.5">
                  <Building2 size={12} aria-hidden="true" /> Identity
                </span>
              </legend>
              <Field label="Name" required>
                <Input
                  value={form.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  placeholder="Acme Supplies Pvt Ltd"
                  autoFocus
                  disabled={pending}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Display name" help="Shown on documents.">
                  <Input
                    value={form.displayName}
                    onChange={(e) => patch({ displayName: e.target.value })}
                    placeholder="Acme"
                    disabled={pending}
                  />
                </Field>
                <Field label="Industry">
                  <Input
                    value={form.industry}
                    onChange={(e) => patch({ industry: e.target.value })}
                    placeholder="Electronics"
                    disabled={pending}
                  />
                </Field>
              </div>
              <Field label="Vendor type">
                <SelectField
                  value={form.vendorType}
                  onChange={(v) => patch({ vendorType: v })}
                  options={VENDOR_TYPE_OPTIONS}
                  placeholder="Select a type"
                  disabled={pending}
                />
              </Field>
              <Field
                label="Logo"
                help="Files live in SabFiles — pick from the library or upload."
              >
                <div className="flex items-center gap-3">
                  {form.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={form.logoUrl}
                      alt=""
                      className="h-9 w-9 rounded-[var(--st-radius)] border border-[var(--st-border)] object-cover"
                    />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] text-[var(--st-text-secondary)]">
                      <ImageIcon size={14} aria-hidden="true" />
                    </span>
                  )}
                  <SabFilePickerButton
                    accept="image"
                    onPick={(pick) => patch({ logoUrl: pick.url })}
                  >
                    <ImageIcon size={14} aria-hidden="true" />{' '}
                    {form.logoUrl ? 'Change logo' : 'Pick logo'}
                  </SabFilePickerButton>
                  {form.logoUrl ? (
                    <Button
                      type="button"
                      variant="ghost"
                      iconLeft={X}
                      disabled={pending}
                      onClick={() => patch({ logoUrl: '' })}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              </Field>
            </fieldset>

            {/* Contact */}
            <fieldset className="flex flex-col gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] p-3">
              <legend className="px-1 text-xs font-medium text-[var(--st-text-secondary)]">
                Contact
              </legend>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email">
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => patch({ email: e.target.value })}
                    placeholder="accounts@acme.com"
                    disabled={pending}
                  />
                </Field>
                <Field label="Phone">
                  <Input
                    value={form.phone}
                    onChange={(e) => patch({ phone: e.target.value })}
                    placeholder="+91 98xxxxxx00"
                    disabled={pending}
                  />
                </Field>
              </div>
            </fieldset>

            {/* Address */}
            <fieldset className="flex flex-col gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] p-3">
              <legend className="px-1 text-xs font-medium text-[var(--st-text-secondary)]">
                Address
              </legend>
              <Field label="Street">
                <Input
                  value={form.street}
                  onChange={(e) => patch({ street: e.target.value })}
                  placeholder="12 Industrial Estate"
                  disabled={pending}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="City">
                  <Input
                    value={form.city}
                    onChange={(e) => patch({ city: e.target.value })}
                    placeholder="Mumbai"
                    disabled={pending}
                  />
                </Field>
                <Field label="State">
                  <Input
                    value={form.state}
                    onChange={(e) => patch({ state: e.target.value })}
                    placeholder="Maharashtra"
                    disabled={pending}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Country">
                  <Input
                    value={form.country}
                    onChange={(e) => patch({ country: e.target.value })}
                    placeholder="India"
                    disabled={pending}
                  />
                </Field>
                <Field label="Pincode">
                  <Input
                    value={form.pincode}
                    onChange={(e) => patch({ pincode: e.target.value })}
                    placeholder="400001"
                    disabled={pending}
                  />
                </Field>
              </div>
            </fieldset>

            {/* Tax */}
            <fieldset className="flex flex-col gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] p-3">
              <legend className="px-1 text-xs font-medium text-[var(--st-text-secondary)]">
                <span className="inline-flex items-center gap-1.5">
                  <FileBadge size={12} aria-hidden="true" /> Tax
                </span>
              </legend>
              <div className="grid grid-cols-2 gap-3">
                <Field label="GSTIN">
                  <Input
                    value={form.gstin}
                    onChange={(e) => patch({ gstin: e.target.value })}
                    placeholder="27AAAAA0000A1Z5"
                    disabled={pending}
                  />
                </Field>
                <Field label="Tax treatment">
                  <SelectField
                    value={form.taxTreatment}
                    onChange={(v) => patch({ taxTreatment: v })}
                    options={VENDOR_TAX_TREATMENTS}
                    placeholder="Select treatment"
                    disabled={pending}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="PAN">
                  <Input
                    value={form.pan}
                    onChange={(e) => patch({ pan: e.target.value })}
                    placeholder="AAAAA0000A"
                    disabled={pending}
                  />
                </Field>
                <Field label="PAN name">
                  <Input
                    value={form.panName}
                    onChange={(e) => patch({ panName: e.target.value })}
                    placeholder="As per PAN card"
                    disabled={pending}
                  />
                </Field>
              </div>
              <Field label="Subject / GST notes">
                <Input
                  value={form.subject}
                  onChange={(e) => patch({ subject: e.target.value })}
                  placeholder="Reverse charge applicable"
                  disabled={pending}
                />
              </Field>
            </fieldset>

            {/* Banking */}
            <fieldset className="flex flex-col gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] p-3">
              <legend className="px-1 text-xs font-medium text-[var(--st-text-secondary)]">
                <span className="inline-flex items-center gap-1.5">
                  <Banknote size={12} aria-hidden="true" /> Banking
                </span>
              </legend>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Bank name">
                  <Input
                    value={form.bankName}
                    onChange={(e) => patch({ bankName: e.target.value })}
                    placeholder="HDFC Bank"
                    disabled={pending}
                  />
                </Field>
                <Field label="Account holder">
                  <Input
                    value={form.bankAccountHolder}
                    onChange={(e) => patch({ bankAccountHolder: e.target.value })}
                    placeholder="Acme Supplies Pvt Ltd"
                    disabled={pending}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Account number">
                  <Input
                    value={form.bankAccountNumber}
                    onChange={(e) => patch({ bankAccountNumber: e.target.value })}
                    placeholder="50100123456789"
                    disabled={pending}
                  />
                </Field>
                <Field label="IFSC">
                  <Input
                    value={form.bankIfsc}
                    onChange={(e) => patch({ bankIfsc: e.target.value })}
                    placeholder="HDFC0000001"
                    disabled={pending}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Account type">
                  <SelectField
                    value={form.bankAccountType}
                    onChange={(v) => patch({ bankAccountType: v })}
                    options={ACCOUNT_TYPE_OPTIONS}
                    placeholder="Select type"
                    disabled={pending}
                  />
                </Field>
                <Field label="Currency">
                  <Input
                    value={form.bankCurrency}
                    onChange={(e) => patch({ bankCurrency: e.target.value })}
                    placeholder="INR"
                    disabled={pending}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="SWIFT code">
                  <Input
                    value={form.bankSwiftCode}
                    onChange={(e) => patch({ bankSwiftCode: e.target.value })}
                    placeholder="HDFCINBB"
                    disabled={pending}
                  />
                </Field>
                <Field label="IBAN">
                  <Input
                    value={form.bankIbanCode}
                    onChange={(e) => patch({ bankIbanCode: e.target.value })}
                    placeholder="Optional"
                    disabled={pending}
                  />
                </Field>
              </div>
            </fieldset>

            {/* Invoice flags */}
            <fieldset className="flex flex-col gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] p-3">
              <legend className="px-1 text-xs font-medium text-[var(--st-text-secondary)]">
                Invoice display
              </legend>
              <Switch
                checked={form.showEmailInInvoice}
                onCheckedChange={(checked) =>
                  patch({ showEmailInInvoice: checked })
                }
                disabled={pending}
                label="Show email on documents"
              />
              <Switch
                checked={form.showPhoneInInvoice}
                onCheckedChange={(checked) =>
                  patch({ showPhoneInInvoice: checked })
                }
                disabled={pending}
                label="Show phone on documents"
              />
            </fieldset>

            {/* Attachments */}
            <Field
              label="Attachments"
              help="Files live in SabFiles — pick from the library or upload."
            >
              <div className="fdoc-attachments">
                {form.attachments.map((att) => (
                  <Tag
                    key={att.fileId}
                    onRemove={
                      pending
                        ? undefined
                        : () =>
                            patch({
                              attachments: form.attachments.filter(
                                (a) => a.fileId !== att.fileId,
                              ),
                            })
                    }
                  >
                    {att.name}
                  </Tag>
                ))}
                <SabFilePickerButton
                  onPick={(pick) => {
                    if (form.attachments.some((a) => a.fileId === pick.id)) {
                      return;
                    }
                    patch({
                      attachments: [
                        ...form.attachments,
                        { fileId: pick.id, name: pick.name },
                      ],
                    });
                  }}
                >
                  <Paperclip size={14} aria-hidden="true" /> Attach file
                </SabFilePickerButton>
              </div>
            </Field>

            {error ? (
              <Alert tone="danger" role="alert">
                {error}
              </Alert>
            ) : null}
          </div>

          <DrawerFooter>
            <Button
              type="button"
              variant="ghost"
              iconLeft={X}
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={pending}>
              {editing ? 'Save changes' : 'Create vendor'}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}

/* ─── Main client ─────────────────────────────────────────────── */

export interface VendorsClientProps {
  initialRows: SabcrmVendorListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmVendorKpis | null;
}

export function VendorsClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
}: VendorsClientProps): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [refreshToken, setRefreshToken] = React.useState(0);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SabcrmVendorListRow | null>(null);

  // Latest loaded rows — the `?edit=<id>` deep link resolves against them.
  const rowsRef = React.useRef<SabcrmVendorListRow[]>(initialRows);

  const editId = searchParams.get('edit');
  React.useEffect(() => {
    if (!editId) return;
    const row = rowsRef.current.find((r) => r.id === editId);
    if (row) {
      setEditing(row);
      setDrawerOpen(true);
    }
    router.replace(pathname, { scroll: false });
  }, [editId, pathname, router]);

  const config = React.useMemo<DocListPageConfig<SabcrmVendorListRow>>(
    () => ({
      title: 'Vendors',
      description:
        'Suppliers your purchase orders, GRNs and bids are raised against — search, edit and export.',
      icon: Users,
      entity: { singular: 'vendor', plural: 'vendors' },
      columns: COLUMNS,
      statuses: VENDOR_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmSupplyVendorsPage(toVendorFilters(filters));
        if (res.ok) rowsRef.current = res.data.rows;
        return res.ok
          ? { ok: true, data: { rows: res.data.rows, hasMore: res.data.hasMore } }
          : res;
      },
      fetchAllForCsv: (filters) =>
        exportSabcrmSupplyVendorRows(toVendorFilters(filters)),
      csvFileName: 'vendors.csv',
      rowHref: (row) => vendorEditHref(row.id),
      rowLabel: (row) => `vendor ${row.name}`,
      bulkActions: [
        {
          key: 'delete',
          label: 'Delete',
          icon: Trash2,
          tone: 'danger',
          confirm: {
            title: 'Delete the selected vendors?',
            description:
              'This permanently removes them. Documents already raised against them keep their history.',
            actionLabel: 'Delete vendors',
          },
          run: async (rows) => {
            for (const row of rows) {
              const res = await deleteSabcrmSupplyVendor(row.id);
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
        label="Vendors"
        icon={Users}
        value={String(kpis.count)}
        delta={kpis.sampled ? 'Sampled (latest 500)' : 'In this workspace'}
      />
      <KpiCard
        label="With GSTIN"
        icon={FileBadge}
        value={String(kpis.withGstin)}
        delta={
          kpis.count > 0
            ? `${Math.round((kpis.withGstin / kpis.count) * 100)}% of vendors`
            : 'No vendors yet'
        }
      />
      <KpiCard
        label="With bank details"
        icon={Banknote}
        value={String(kpis.withBankDetails)}
        delta="Ready for payouts"
      />
      <KpiCard
        label="Vendor types"
        icon={Building2}
        value={String(kpis.vendorTypeCount)}
        delta="Distinct categories"
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
              setDrawerOpen(true);
            }}
          >
            New vendor
          </Button>
        }
        initialRows={initialRows}
        initialHasMore={initialHasMore}
        initialError={initialError}
        refreshToken={refreshToken}
      />

      <VendorDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        editing={editing}
        onDone={handleDone}
      />
    </>
  );
}
