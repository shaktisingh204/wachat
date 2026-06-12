'use client';

/**
 * SabCRM Finance — Voucher books list client
 * (`/sabcrm/finance/vouchers`), doc-surface kit adopter.
 *
 * Full-field surface for the numbering-series books (spec §3.13):
 * KPI strip (active / approval-required / top type / total), kit list
 * (typed columns incl. a live next-number preview, search + status +
 * date filters, a book-type Select in the actions slot, server
 * pagination, bulk archive/restore, CSV export) and a FULL create/edit
 * Dialog (name, type, default flag, prefix/suffix, starting number,
 * padding, reset frequency, approval-required, active flag).
 *
 * Row click deep-links `?edit=<id>` (deep-linkable edit dialog); the
 * edit dialog links into the book's journal entries — the lineage hop
 * the spec calls for. ONLY `@/components/sabcrm/20ui` barrel imports.
 */

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Archive,
  ArchiveRestore,
  BookCopy,
  BookMarked,
  Layers,
  Plus,
  ShieldCheck,
} from 'lucide-react';

import {
  Alert,
  Button,
  Dialog,
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
  type DocListColumn,
  type DocListPageConfig,
} from '../_components/doc-surface';
import {
  VOUCHER_BOOK_STATUSES,
  VOUCHERS_PATH,
  resetFrequencyLabel,
  toVoucherBookFilters,
  voucherBookEntriesHref,
  voucherTypeLabel,
} from './voucher-config';

import {
  createSabcrmVoucherBookFull,
  exportSabcrmVoucherBookRows,
  getSabcrmVoucherBookRow,
  listSabcrmVoucherBooksPage,
  setSabcrmVoucherBookStatus,
  updateSabcrmVoucherBookFull,
} from '@/app/actions/sabcrm-finance-vouchers.actions';
import {
  SABCRM_VOUCHER_BOOK_TYPES,
  type SabcrmVoucherBookFullInput,
  type SabcrmVoucherBookKpis,
  type SabcrmVoucherBookListRow,
  type SabcrmVoucherBookResetFrequency,
  type SabcrmVoucherBookType,
} from '@/app/actions/sabcrm-finance-vouchers.actions.types';

/* ─── Columns ─────────────────────────────────────────────────── */

const COLUMNS: DocListColumn<SabcrmVoucherBookListRow>[] = [
  { key: 'name', header: 'Name', kind: 'text', value: (r) => r.name },
  {
    key: 'type',
    header: 'Type',
    kind: 'badge',
    value: (r) => voucherTypeLabel(r.type),
  },
  {
    key: 'next',
    header: 'Next number',
    kind: 'text',
    value: (r) => r.nextNumberPreview,
  },
  {
    key: 'reset',
    header: 'Resets',
    kind: 'text',
    value: (r) => (r.resetFrequency ? resetFrequencyLabel(r.resetFrequency) : '—'),
  },
  {
    key: 'approval',
    header: 'Approval',
    kind: 'badge',
    value: (r) => (r.approvalRequired ? 'Required' : ''),
    tone: () => 'warning',
    csv: (r) => (r.approvalRequired ? 'Required' : 'No'),
  },
  {
    key: 'default',
    header: 'Default',
    kind: 'badge',
    value: (r) => (r.isDefault ? 'Default' : ''),
    tone: () => 'info',
    csv: (r) => (r.isDefault ? 'Yes' : 'No'),
  },
  { key: 'status', header: 'Status', kind: 'status', value: (r) => r.status },
];

/* ─── Form state ──────────────────────────────────────────────── */

interface BookFormValues {
  name: string;
  type: SabcrmVoucherBookType;
  isDefault: boolean;
  prefix: string;
  suffix: string;
  startingNumber: string;
  padding: string;
  resetFrequency: SabcrmVoucherBookResetFrequency;
  approvalRequired: boolean;
  isActive: boolean;
}

function emptyBookValues(): BookFormValues {
  return {
    name: '',
    type: 'journal',
    isDefault: false,
    prefix: '',
    suffix: '',
    startingNumber: '1',
    padding: '4',
    resetFrequency: 'none',
    approvalRequired: false,
    isActive: true,
  };
}

function valuesFromRow(row: SabcrmVoucherBookListRow): BookFormValues {
  return {
    name: row.name,
    type: (row.type as SabcrmVoucherBookType) || 'journal',
    isDefault: row.isDefault,
    prefix: row.prefix,
    suffix: row.suffix,
    startingNumber: String(row.startingNumber),
    padding: String(row.padding),
    resetFrequency: row.resetFrequency || 'none',
    approvalRequired: row.approvalRequired,
    isActive: row.isActive,
  };
}

function toFullInput(v: BookFormValues): SabcrmVoucherBookFullInput {
  return {
    name: v.name,
    type: v.type,
    isDefault: v.isDefault,
    prefix: v.prefix || undefined,
    suffix: v.suffix || undefined,
    startingNumber: v.startingNumber === '' ? undefined : Number(v.startingNumber),
    padding: v.padding === '' ? undefined : Number(v.padding),
    resetFrequency: v.resetFrequency,
    approvalRequired: v.approvalRequired,
    isActive: v.isActive,
  };
}

/** Live preview: `prefix + zero-padded start + suffix`. */
function previewOf(v: BookFormValues): string {
  const start = Number(v.startingNumber) || 1;
  const padding = Math.max(Number(v.padding) || 0, 0);
  return `${v.prefix}${String(start).padStart(padding, '0')}${v.suffix}`;
}

const TYPE_OPTIONS: SelectOption[] = SABCRM_VOUCHER_BOOK_TYPES.map((t) => ({
  value: t.value,
  label: t.label,
}));

const RESET_OPTIONS: SelectOption[] = [
  { value: 'none', label: 'Never' },
  { value: 'yearly', label: 'Every financial year' },
  { value: 'monthly', label: 'Every month' },
];

/* ─── Component ───────────────────────────────────────────────── */

export interface VouchersClientProps {
  initialRows: SabcrmVoucherBookListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmVoucherBookKpis | null;
}

export function VouchersClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
}: VouchersClientProps): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');

  const [refreshToken, setRefreshToken] = React.useState(0);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SabcrmVoucherBookListRow | null>(
    null,
  );
  const [values, setValues] = React.useState<BookFormValues>(emptyBookValues);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Book-type toolbar filter (outside the kit; read via ref).
  const [typeFilter, setTypeFilter] = React.useState<string | null>('');
  const typeRef = React.useRef<SabcrmVoucherBookType | ''>('');
  typeRef.current = (typeFilter ?? '') as SabcrmVoucherBookType | '';

  // Display-row cache so `?edit=` opens instantly from listed rows.
  const rowsRef = React.useRef(new Map<string, SabcrmVoucherBookListRow>());
  if (rowsRef.current.size === 0 && initialRows.length > 0) {
    for (const row of initialRows) rowsRef.current.set(row.id, row);
  }

  const patch = (p: Partial<BookFormValues>): void =>
    setValues((v) => ({ ...v, ...p }));

  const openCreate = (): void => {
    setEditing(null);
    setValues(emptyBookValues());
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = React.useCallback((row: SabcrmVoucherBookListRow): void => {
    setEditing(row);
    setValues(valuesFromRow(row));
    setFormError(null);
    setFormOpen(true);
  }, []);

  const closeDialog = (): void => {
    if (busy) return;
    setFormOpen(false);
    setEditing(null);
    if (editId) router.replace(pathname, { scroll: false });
  };

  // `?edit=<id>` deep link → open the edit dialog (cache, then fetch).
  React.useEffect(() => {
    if (!editId) return;
    const cached = rowsRef.current.get(editId);
    if (cached) {
      openEdit(cached);
      return;
    }
    let cancelled = false;
    void getSabcrmVoucherBookRow(editId).then((res) => {
      if (cancelled) return;
      if (res.ok) openEdit(res.data);
      else toast.error(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [editId, openEdit]);

  const refresh = (): void => {
    setRefreshToken((t) => t + 1);
    router.refresh();
  };

  const submit = async (): Promise<void> => {
    setBusy(true);
    setFormError(null);
    try {
      const input = toFullInput(values);
      const res = editing
        ? await updateSabcrmVoucherBookFull(editing.id, input)
        : await createSabcrmVoucherBookFull(input);
      if (!res.ok) {
        setFormError(res.error);
        return;
      }
      toast.success(
        editing ? `${res.data.name} updated.` : `${res.data.name} created.`,
      );
      setFormOpen(false);
      setEditing(null);
      if (editId) router.replace(pathname, { scroll: false });
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const toggleArchive = async (): Promise<void> => {
    if (!editing) return;
    setBusy(true);
    try {
      const next = editing.status === 'archived' ? 'active' : 'archived';
      const res = await setSabcrmVoucherBookStatus(editing.id, next);
      if (!res.ok) {
        setFormError(res.error);
        return;
      }
      toast.success(
        next === 'archived'
          ? `${editing.name} archived.`
          : `${editing.name} restored.`,
      );
      setFormOpen(false);
      setEditing(null);
      if (editId) router.replace(pathname, { scroll: false });
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const config = React.useMemo<DocListPageConfig<SabcrmVoucherBookListRow>>(
    () => ({
      title: 'Voucher books',
      description:
        'Numbering series for journal vouchers — prefixes, counters, reset rules and approvals.',
      icon: BookMarked,
      entity: { singular: 'voucher book', plural: 'voucher books' },
      columns: COLUMNS,
      statuses: VOUCHER_BOOK_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmVoucherBooksPage(
          toVoucherBookFilters(filters, typeRef.current),
        );
        if (!res.ok) return res;
        for (const row of res.data.rows) rowsRef.current.set(row.id, row);
        return {
          ok: true,
          data: { rows: res.data.rows, hasMore: res.data.hasMore },
        };
      },
      fetchAllForCsv: (filters) =>
        exportSabcrmVoucherBookRows(
          toVoucherBookFilters(filters, typeRef.current),
        ),
      csvFileName: 'voucher-books.csv',
      rowHref: (row) => `${VOUCHERS_PATH}?edit=${encodeURIComponent(row.id)}`,
      rowLabel: (row) => `voucher book ${row.name}`,
      bulkActions: [
        {
          key: 'archive',
          label: 'Archive',
          icon: Archive,
          tone: 'danger',
          confirm: {
            title: 'Archive the selected voucher books?',
            description:
              'Archived books stop appearing in pickers; their entries are kept.',
            actionLabel: 'Archive books',
          },
          run: async (rows) => {
            for (const row of rows.filter((r) => r.status !== 'archived')) {
              const res = await setSabcrmVoucherBookStatus(row.id, 'archived');
              if (!res.ok) return res;
            }
            return { ok: true, data: null };
          },
        },
        {
          key: 'restore',
          label: 'Restore',
          icon: ArchiveRestore,
          run: async (rows) => {
            const archived = rows.filter((r) => r.status === 'archived');
            if (archived.length === 0) {
              return { ok: false, error: 'Only archived books can be restored.' };
            }
            for (const row of archived) {
              const res = await setSabcrmVoucherBookStatus(row.id, 'active');
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
        label="Active books"
        icon={BookMarked}
        value={String(kpis.activeCount)}
        delta={`${kpis.archivedCount} archived`}
      />
      <KpiCard
        label="Approval required"
        icon={ShieldCheck}
        value={String(kpis.approvalRequiredCount)}
        delta={
          kpis.approvalRequiredCount === 1
            ? 'book needs approval'
            : 'books need approval'
        }
        deltaTone={kpis.approvalRequiredCount > 0 ? 'up' : 'neutral'}
      />
      <KpiCard
        label="Top type"
        icon={Layers}
        value={kpis.topType ? voucherTypeLabel(kpis.topType) : '—'}
        delta={
          kpis.topType
            ? `${kpis.topTypeCount} ${kpis.topTypeCount === 1 ? 'book' : 'books'}`
            : 'No books yet'
        }
      />
      <KpiCard
        label="Total books"
        icon={BookCopy}
        value={String(kpis.count)}
        delta={
          kpis.sampled
            ? 'Across the latest 500 books'
            : `${kpis.defaultCount} default`
        }
      />
    </>
  ) : null;

  const editingArchived = editing?.status === 'archived';

  return (
    <>
      <DocListPage
        config={config}
        kpis={kpiStrip}
        primaryAction={
          <>
            <div className="w-40">
              <SelectField
                value={typeFilter}
                onChange={(v) => {
                  setTypeFilter(v);
                  setRefreshToken((t) => t + 1);
                }}
                options={[{ value: '', label: 'All types' }, ...TYPE_OPTIONS]}
                aria-label="Filter by book type"
              />
            </div>
            <Button variant="primary" iconLeft={Plus} onClick={openCreate}>
              New voucher book
            </Button>
          </>
        }
        initialRows={initialRows}
        initialHasMore={initialHasMore}
        initialError={initialError}
        refreshToken={refreshToken}
      />

      <Dialog open={formOpen} onOpenChange={(next) => !next && closeDialog()}>
        <DialogContent aria-describedby="voucher-book-form-desc">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Edit ${editing.name}` : 'New voucher book'}
            </DialogTitle>
            <DialogDescription id="voucher-book-form-desc">
              {editing
                ? 'Update the numbering series. Existing entries keep their numbers.'
                : 'Define a numbering series for journal vouchers.'}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <div className="grid grid-cols-2 gap-3 px-1 py-2">
              <Field label="Name" required>
                <Input
                  value={values.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  placeholder="Sales vouchers"
                  disabled={busy}
                />
              </Field>
              <Field label="Type" required>
                <SelectField
                  value={values.type}
                  onChange={(v) =>
                    patch({ type: (v as SabcrmVoucherBookType) ?? 'journal' })
                  }
                  options={TYPE_OPTIONS}
                  disabled={busy}
                />
              </Field>
              <Field label="Prefix">
                <Input
                  value={values.prefix}
                  onChange={(e) => patch({ prefix: e.target.value })}
                  placeholder="JV-"
                  disabled={busy}
                />
              </Field>
              <Field label="Suffix">
                <Input
                  value={values.suffix}
                  onChange={(e) => patch({ suffix: e.target.value })}
                  placeholder="/26"
                  disabled={busy}
                />
              </Field>
              <Field label="Starting number">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={values.startingNumber}
                  onChange={(e) => patch({ startingNumber: e.target.value })}
                  disabled={busy}
                />
              </Field>
              <Field label="Padding" help={`Preview: ${previewOf(values)}`}>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={10}
                  step={1}
                  value={values.padding}
                  onChange={(e) => patch({ padding: e.target.value })}
                  disabled={busy}
                />
              </Field>
              <Field label="Reset frequency">
                <SelectField
                  value={values.resetFrequency}
                  onChange={(v) =>
                    patch({
                      resetFrequency:
                        (v as SabcrmVoucherBookResetFrequency) ?? 'none',
                    })
                  }
                  options={RESET_OPTIONS}
                  disabled={busy}
                />
              </Field>
              <div className="flex flex-col justify-end gap-2 pb-1">
                <Switch
                  checked={values.approvalRequired}
                  onCheckedChange={(approvalRequired) =>
                    patch({ approvalRequired })
                  }
                  label="Entries need approval"
                  disabled={busy}
                />
                <Switch
                  checked={values.isDefault}
                  onCheckedChange={(isDefault) => patch({ isDefault })}
                  label="Default book for its type"
                  disabled={busy}
                />
                <Switch
                  checked={values.isActive}
                  onCheckedChange={(isActive) => patch({ isActive })}
                  label="Active"
                  disabled={busy}
                />
              </div>
            </div>

            {formError ? (
              <div className="px-1 pb-2">
                <Alert tone="danger" role="alert">
                  {formError}
                </Alert>
              </div>
            ) : null}

            <DialogFooter>
              {editing ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      router.push(voucherBookEntriesHref(editing.id))
                    }
                  >
                    View journal entries
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    iconLeft={editingArchived ? ArchiveRestore : Archive}
                    disabled={busy}
                    onClick={() => void toggleArchive()}
                  >
                    {editingArchived ? 'Restore' : 'Archive'}
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={closeDialog}
                >
                  Cancel
                </Button>
              )}
              <Button type="submit" variant="primary" loading={busy}>
                {editing ? 'Save changes' : 'Create book'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
