'use client';

/**
 * SabCRM Commerce — Storefronts list client
 * (`/sabcrm/commerce/storefronts`).
 *
 * Doc-surface adopter (spec WI-14): KPI strip (published / draft /
 * archived), the config-driven DocListPage and a FULL-field 20ui
 * Dialog drawer — name, auto-slug, domain, currency, theme, SabFiles
 * logo (NEVER a free-text URL — repo policy) and repeatable homepage
 * blocks (kind select + JSON config textarea with validation).
 *
 * Rows carry the full editable field set (homepage blocks included),
 * so the edit drawer seeds without a second fetch; a row click
 * deep-links to `?edit=<id>`. Publish / Archive run inline as bulk +
 * drawer status edits.
 */

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Archive,
  FileStack,
  Globe,
  Plus,
  Send,
  Store,
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
  Textarea,
  toast,
  type SelectOption,
} from '@/components/sabcrm/20ui';
import { KpiCard } from '@/components/sabcrm/20ui/composites/charts';
import { SabFileUrlInput } from '@/components/sabfiles';

import {
  DocListPage,
  type DocListColumn,
  type DocListPageConfig,
} from '@/app/sabcrm/finance/_components/doc-surface';
import {
  STOREFRONT_BLOCK_KINDS,
  STOREFRONT_STATUSES,
  STOREFRONTS_PATH,
  slugify,
  toStorefrontFilters,
} from './storefronts-config';

import {
  createSabcrmStorefrontFull,
  exportSabcrmStorefrontRows,
  listSabcrmStorefrontsPage,
} from '@/app/actions/sabcrm-commerce-storefronts.actions';
import { updateSabcrmStorefront } from '@/app/actions/sabcrm-commerce-docs.actions';
import {
  publishSabcrmStorefront,
  archiveSabcrmStorefront,
} from '@/app/actions/sabcrm-commerce.actions';
import type { SabcrmStorefrontListRow } from '@/app/actions/sabcrm-commerce-storefronts.actions.types';
import type { SabcrmStorefrontKpis } from '@/app/actions/sabcrm-commerce-storefronts.actions.types';
import type {
  CrmStoreHomepageBlock,
  CrmStorefrontStatus,
} from '@/lib/rust-client/crm-store';

/* ─── Columns ─────────────────────────────────────────────────── */

const COLUMNS: DocListColumn<SabcrmStorefrontListRow>[] = [
  { key: 'name', header: 'Name', kind: 'text', value: (r) => r.name },
  { key: 'slug', header: 'Slug', kind: 'text', value: (r) => r.slug },
  {
    key: 'domain',
    header: 'Domain',
    kind: 'text',
    value: (r) => r.domain ?? '',
  },
  { key: 'currency', header: 'Currency', kind: 'text', value: (r) => r.currency },
  {
    key: 'blocks',
    header: 'Blocks',
    kind: 'text',
    align: 'right',
    value: (r) => String(r.blocksCount),
  },
  { key: 'status', header: 'Status', kind: 'status', value: (r) => r.status },
];

/* ─── Drawer ──────────────────────────────────────────────────── */

const CURRENCY_OPTIONS: SelectOption[] = [
  { value: 'INR', label: 'INR — Indian Rupee' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'AED', label: 'AED — UAE Dirham' },
];

const BLOCK_KIND_OPTIONS: SelectOption[] = STOREFRONT_BLOCK_KINDS.map((k) => ({
  value: k.value,
  label: k.label,
}));

const STATUS_OPTIONS: SelectOption[] = STOREFRONT_STATUSES.map((s) => ({
  value: s.value,
  label: s.label,
}));

interface BlockRow {
  rowId: string;
  kind: string;
  config: string;
}

interface StorefrontFormState {
  name: string;
  slug: string;
  slugTouched: boolean;
  domain: string;
  currency: string | null;
  themeId: string;
  logoUrl: string;
  status: string | null;
  blocks: BlockRow[];
}

function rid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

function emptyForm(): StorefrontFormState {
  return {
    name: '',
    slug: '',
    slugTouched: false,
    domain: '',
    currency: 'INR',
    themeId: '',
    logoUrl: '',
    status: 'draft',
    blocks: [],
  };
}

function rowToForm(row: SabcrmStorefrontListRow): StorefrontFormState {
  return {
    name: row.name,
    slug: row.slug,
    slugTouched: true,
    domain: row.domain ?? '',
    currency: row.currency || 'INR',
    themeId: row.themeId ?? '',
    logoUrl: row.logoUrl ?? '',
    status: row.status,
    blocks: row.homepageBlocks.map((b) => ({
      rowId: rid(),
      kind: b.kind || 'custom',
      config:
        b.config === undefined || b.config === null
          ? ''
          : JSON.stringify(b.config, null, 2),
    })),
  };
}

interface StorefrontDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: SabcrmStorefrontListRow | null;
  onDone: () => void;
}

function StorefrontDialog({
  open,
  onOpenChange,
  editing,
  onDone,
}: StorefrontDialogProps): React.JSX.Element {
  const [form, setForm] = React.useState<StorefrontFormState>(emptyForm());
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!open) return;
    setForm(editing ? rowToForm(editing) : emptyForm());
    setError(null);
  }, [open, editing]);

  const patch = (p: Partial<StorefrontFormState>): void =>
    setForm((f) => ({ ...f, ...p }));

  const onName = (value: string): void =>
    setForm((f) => ({
      ...f,
      name: value,
      slug: f.slugTouched ? f.slug : slugify(value),
    }));

  const addBlock = (): void =>
    setForm((f) => ({
      ...f,
      blocks: [...f.blocks, { rowId: rid(), kind: 'hero', config: '' }],
    }));

  const removeBlock = (rowId: string): void =>
    setForm((f) => ({ ...f, blocks: f.blocks.filter((b) => b.rowId !== rowId) }));

  const setBlock = (rowId: string, p: Partial<BlockRow>): void =>
    setForm((f) => ({
      ...f,
      blocks: f.blocks.map((b) => (b.rowId === rowId ? { ...b, ...p } : b)),
    }));

  const submit = (): void => {
    if (!form.name.trim()) {
      setError('A storefront name is required.');
      return;
    }
    if (!form.slug.trim()) {
      setError('A slug is required.');
      return;
    }
    // Parse + validate the homepage blocks' JSON config.
    const homepageBlocks: CrmStoreHomepageBlock[] = [];
    for (const b of form.blocks) {
      let config: unknown = undefined;
      const raw = b.config.trim();
      if (raw) {
        try {
          config = JSON.parse(raw);
        } catch {
          setError(`Block "${b.kind}" has invalid JSON config.`);
          return;
        }
      }
      homepageBlocks.push({ kind: b.kind, config });
    }
    setError(null);

    startTransition(async () => {
      const res = editing
        ? await updateSabcrmStorefront(editing.id, {
            name: form.name.trim(),
            slug: form.slug.trim().toLowerCase(),
            domain: form.domain.trim() || undefined,
            currency: (form.currency ?? 'INR').toUpperCase(),
            themeId: form.themeId.trim() || undefined,
            logoUrl: form.logoUrl.trim() || undefined,
            homepageBlocks,
            status: (form.status ?? 'draft') as CrmStorefrontStatus,
          })
        : await createSabcrmStorefrontFull({
            name: form.name,
            slug: form.slug,
            domain: form.domain.trim() || undefined,
            currency: form.currency ?? 'INR',
            themeId: form.themeId.trim() || undefined,
            logoUrl: form.logoUrl.trim() || undefined,
            homepageBlocks,
          });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(editing ? `${res.data.name} updated.` : `${res.data.name} created.`);
      onOpenChange(false);
      onDone();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent aria-describedby="sf-desc">
        <DialogHeader>
          <DialogTitle>
            {editing ? `Edit ${editing.name}` : 'New storefront'}
          </DialogTitle>
          <DialogDescription id="sf-desc">
            {editing
              ? 'Update the storefront. Orders keep pointing at it.'
              : 'An online store this workspace runs — slug, domain, currency and homepage layout.'}
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
              <Field label="Name" required>
                <Input
                  value={form.name}
                  onChange={(e) => onName(e.target.value)}
                  placeholder="Acme Store"
                  autoFocus
                  disabled={pending}
                />
              </Field>
              <Field label="Slug" required>
                <Input
                  value={form.slug}
                  onChange={(e) =>
                    patch({ slug: slugify(e.target.value), slugTouched: true })
                  }
                  placeholder="acme-store"
                  disabled={pending}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Custom domain">
                <Input
                  value={form.domain}
                  onChange={(e) => patch({ domain: e.target.value })}
                  placeholder="shop.acme.example"
                  disabled={pending}
                />
              </Field>
              <Field label="Currency">
                <SelectField
                  value={form.currency}
                  onChange={(v) => patch({ currency: v })}
                  options={CURRENCY_OPTIONS}
                  disabled={pending}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Theme id">
                <Input
                  value={form.themeId}
                  onChange={(e) => patch({ themeId: e.target.value })}
                  placeholder="aurora"
                  disabled={pending}
                />
              </Field>
              {editing ? (
                <Field label="Status">
                  <SelectField
                    value={form.status}
                    onChange={(v) => patch({ status: v })}
                    options={STATUS_OPTIONS}
                    disabled={pending}
                  />
                </Field>
              ) : (
                <div />
              )}
            </div>
            <Field label="Logo">
              <SabFileUrlInput
                value={form.logoUrl}
                onChange={(value) => patch({ logoUrl: value })}
                accept="image"
                placeholder="Pick a logo from SabFiles"
                pickerTitle="Storefront logo"
                disabled={pending}
              />
            </Field>

            <fieldset className="flex flex-col gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] p-3">
              <legend className="px-1 text-xs font-medium text-[var(--st-text-secondary)]">
                Homepage blocks
              </legend>
              {form.blocks.length === 0 ? (
                <p className="text-[12px] text-[var(--st-text-secondary)]">
                  No blocks yet — the storefront renders a default homepage.
                </p>
              ) : (
                form.blocks.map((b) => (
                  <div
                    key={b.rowId}
                    className="flex flex-col gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] p-2"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <SelectField
                          value={b.kind}
                          onChange={(v) => setBlock(b.rowId, { kind: v ?? 'custom' })}
                          options={BLOCK_KIND_OPTIONS}
                          disabled={pending}
                          aria-label="Block kind"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        iconLeft={Trash2}
                        aria-label="Remove block"
                        disabled={pending}
                        onClick={() => removeBlock(b.rowId)}
                      />
                    </div>
                    <Textarea
                      value={b.config}
                      onChange={(e) => setBlock(b.rowId, { config: e.target.value })}
                      rows={2}
                      placeholder='{"heading": "Welcome"}'
                      disabled={pending}
                      aria-label="Block config (JSON)"
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
                  onClick={addBlock}
                >
                  Add block
                </Button>
              </div>
            </fieldset>

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
              {editing ? 'Save changes' : 'Create storefront'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main client ─────────────────────────────────────────────── */

export interface StorefrontsClientProps {
  initialRows: SabcrmStorefrontListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmStorefrontKpis | null;
}

export function StorefrontsClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
}: StorefrontsClientProps): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [refreshToken, setRefreshToken] = React.useState(0);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SabcrmStorefrontListRow | null>(
    null,
  );

  const rowsRef = React.useRef<SabcrmStorefrontListRow[]>(initialRows);

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

  const config = React.useMemo<DocListPageConfig<SabcrmStorefrontListRow>>(
    () => ({
      title: 'Storefronts',
      description:
        'Online stores this workspace runs — slug, domain, currency, homepage layout and publish state.',
      icon: Store,
      entity: { singular: 'storefront', plural: 'storefronts' },
      columns: COLUMNS,
      statuses: STOREFRONT_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmStorefrontsPage(toStorefrontFilters(filters));
        if (res.ok) rowsRef.current = res.data.rows;
        return res.ok
          ? { ok: true, data: { rows: res.data.rows, hasMore: res.data.hasMore } }
          : res;
      },
      fetchAllForCsv: (filters) =>
        exportSabcrmStorefrontRows(toStorefrontFilters(filters)),
      csvFileName: 'storefronts.csv',
      rowHref: (row) => `${STOREFRONTS_PATH}?edit=${encodeURIComponent(row.id)}`,
      rowLabel: (row) => `storefront ${row.name}`,
      bulkActions: [
        {
          key: 'publish',
          label: 'Publish',
          icon: Send,
          run: async (rows) => {
            const drafts = rows.filter((r) => r.status === 'draft');
            if (drafts.length === 0) {
              return { ok: false, error: 'Only draft storefronts can be published.' };
            }
            for (const row of drafts) {
              const res = await publishSabcrmStorefront(row.id);
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
            title: 'Archive the selected storefronts?',
            description:
              'Archived storefronts stop serving; their orders and history are preserved.',
            actionLabel: 'Archive storefronts',
          },
          run: async (rows) => {
            for (const row of rows) {
              const res = await archiveSabcrmStorefront(row.id);
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
        label="Published"
        icon={Globe}
        value={String(kpis.publishedCount)}
        delta={`of ${kpis.count} total`}
        deltaTone={kpis.publishedCount > 0 ? 'up' : 'neutral'}
      />
      <KpiCard
        label="Draft"
        icon={FileStack}
        value={String(kpis.draftCount)}
        delta="Not yet live"
      />
      <KpiCard
        label="Archived"
        icon={Archive}
        value={String(kpis.archivedCount)}
        delta="Hidden from serving"
      />
      <KpiCard
        label="Total storefronts"
        icon={Store}
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
            New storefront
          </Button>
        }
        initialRows={initialRows}
        initialHasMore={initialHasMore}
        initialError={initialError}
        refreshToken={refreshToken}
      />

      <StorefrontDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onDone={handleDone}
      />
    </>
  );
}
