'use client';

/**
 * SabCRM — generic record INDEX page (`/sabcrm/<objectSlug>`).
 *
 * One screen renders every object. It resolves the object's metadata, then
 * exposes a **view toolbar** that switches between two metadata-driven layouts:
 *
 *   - **Table** — every field flagged `inTable` becomes a column.
 *   - **Board** — kanban columns derived from the object's `board.groupByField`
 *     (a SELECT field). Only offered when the object declares the `board` view.
 *
 * The toolbar also drives:
 *   - free-text search (debounced, server-side),
 *   - per-field filters (one typed condition per filterable column),
 *   - sort (field + direction, applied as a single-key multiSort clause),
 *   - the metadata-driven Create dialog.
 *
 * This page is a Client Component on purpose: the surrounding
 * `src/app/sabcrm/layout.tsx` already enforces the SabNode auth / onboarding /
 * `RBACGuard`, mounts the project provider, and opens the `.zoruui` scope — so
 * the page inherits all of that and only owns the interactive runtime. All data
 * access goes through the gated `sabcrm.actions.ts` server actions, every one of
 * which returns an {@link ActionResult}; we render the `error` branch inline
 * (covering the RBAC-denied and plan-locked cases the gate surfaces).
 */

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  AlertTriangle,
  Database,
  Loader2,
  Table2,
  Columns3,
  ArrowDownUp,
  Filter as FilterIcon,
  X,
} from 'lucide-react';

import {
  Button,
  Input,
  Label,
  Textarea,
  Checkbox,
  Badge,
  Skeleton,
  EmptyState,
  Alert,
  ZoruAlertTitle,
  ZoruAlertDescription,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Dialog,
  ZoruDialogContent,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogDescription,
  ZoruDialogFooter,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/zoruui';
import { SabFileUrlInput } from '@/components/sabfiles';
import { useProject } from '@/context/project-context';
import {
  listObjectsAction,
  listRecordsAction,
  createRecordAction,
  groupRecordsAction,
} from '@/app/actions/sabcrm.actions';
import type {
  SabcrmRecordQuery,
  SabcrmRecordPage,
  SabcrmGroupedRecordPage,
  SabcrmRecordGroup,
  SabcrmSortClause,
  SabcrmFilterValue,
} from '@/app/actions/sabcrm.actions.types';
import type {
  ObjectMetadata,
  FieldMetadata,
  CrmRecordWithLabel,
} from '@/lib/sabcrm/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 25;
const BOARD_CAP = 500;
const SEARCH_DEBOUNCE_MS = 300;

/** The two layouts the runtime can render. */
type ViewKind = 'table' | 'board';

/** Field types that we expose as a column filter in the toolbar. */
const FILTERABLE_TYPES: ReadonlySet<FieldMetadata['type']> = new Set<
  FieldMetadata['type']
>(['TEXT', 'EMAIL', 'PHONE', 'LINK', 'SELECT', 'BOOLEAN']);

// ---------------------------------------------------------------------------
// Value formatting
// ---------------------------------------------------------------------------

/** Map a SELECT option color token to a Badge variant. */
function badgeVariantForColor(
  color?: string,
): 'default' | 'secondary' | 'success' | 'warning' | 'danger' | 'outline' {
  if (!color) return 'secondary';
  const c = color.toLowerCase();
  if (c.includes('green') || c.includes('emerald') || c.includes('success'))
    return 'success';
  if (c.includes('amber') || c.includes('yellow') || c.includes('orange') || c.includes('warning'))
    return 'warning';
  if (c.includes('red') || c.includes('rose') || c.includes('danger') || c.includes('pink'))
    return 'danger';
  if (c.includes('accent') || c.includes('blue') || c.includes('sky') || c.includes('brand') || c.includes('primary') || c.includes('purple'))
    return 'default';
  return 'outline';
}

/** Render a single cell value according to its field type. */
function renderCellValue(
  field: FieldMetadata,
  value: unknown,
): React.ReactNode {
  if (value === null || value === undefined || value === '') {
    return <span className="text-zoru-ink-muted">—</span>;
  }

  switch (field.type) {
    case 'BOOLEAN':
      return value ? 'Yes' : 'No';

    case 'DATE': {
      const d = new Date(String(value));
      return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
    }

    case 'DATE_TIME': {
      const d = new Date(String(value));
      return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
    }

    case 'CURRENCY': {
      const n = Number(value);
      return Number.isNaN(n)
        ? String(value)
        : n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
    }

    case 'EMAIL':
      return (
        <a
          href={`mailto:${String(value)}`}
          className="text-zoru-accent hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {String(value)}
        </a>
      );

    case 'PHONE':
      return (
        <a
          href={`tel:${String(value)}`}
          className="text-zoru-accent hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {String(value)}
        </a>
      );

    case 'LINK':
    case 'FILE': {
      const url = String(value);
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-zoru-accent hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {field.type === 'FILE' ? 'View file' : url}
        </a>
      );
    }

    case 'SELECT': {
      const opt = field.options?.find((o) => o.value === value);
      return (
        <Badge variant={badgeVariantForColor(opt?.color)}>
          {opt?.label ?? String(value)}
        </Badge>
      );
    }

    case 'MULTI_SELECT': {
      const arr = Array.isArray(value) ? value : [value];
      return (
        <div className="flex flex-wrap gap-1">
          {arr.map((v) => {
            const opt = field.options?.find((o) => o.value === v);
            return (
              <Badge key={String(v)} variant={badgeVariantForColor(opt?.color)}>
                {opt?.label ?? String(v)}
              </Badge>
            );
          })}
        </div>
      );
    }

    case 'RATING': {
      const n = Number(value);
      return Number.isNaN(n)
        ? String(value)
        : '★'.repeat(Math.max(0, Math.round(n)));
    }

    case 'RELATION':
      // Records arrive with relation values already resolved to a label by the
      // server; fall back to the raw value otherwise.
      return String(value);

    default:
      return String(value);
  }
}

// ---------------------------------------------------------------------------
// Create dialog (metadata-driven)
// ---------------------------------------------------------------------------

interface CreateRecordDialogProps {
  object: ObjectMetadata;
  projectId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

/** Fields a user may fill on create — system + relation fields are skipped. */
function editableFields(object: ObjectMetadata): FieldMetadata[] {
  return object.fields.filter((f) => !f.system && f.type !== 'RELATION');
}

function CreateRecordDialog({
  object,
  projectId,
  open,
  onOpenChange,
  onCreated,
}: CreateRecordDialogProps) {
  const fields = React.useMemo(() => editableFields(object), [object]);
  const [values, setValues] = React.useState<Record<string, unknown>>({});
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Reset the form each time the dialog (re)opens.
  React.useEffect(() => {
    if (open) {
      setValues({});
      setError(null);
      setSaving(false);
    }
  }, [open]);

  const setValue = React.useCallback((key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);

    // Drop empty values so server defaults apply cleanly.
    const payload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(values)) {
      if (v !== undefined && v !== '') payload[k] = v;
    }

    const res = await createRecordAction(
      object.slug,
      payload,
      projectId ?? undefined,
    );
    setSaving(false);

    if (res.ok) {
      onOpenChange(false);
      onCreated();
    } else {
      setError(res.error);
    }
  };

  function renderInput(field: FieldMetadata) {
    const raw = values[field.key];

    switch (field.type) {
      case 'BOOLEAN':
        return (
          <div className="flex items-center gap-2">
            <Checkbox
              id={field.key}
              checked={Boolean(raw)}
              onCheckedChange={(checked) => setValue(field.key, checked === true)}
            />
            <Label htmlFor={field.key} className="text-sm font-normal">
              {field.label}
            </Label>
          </div>
        );

      case 'SELECT':
        return (
          <Select
            value={raw !== undefined ? String(raw) : undefined}
            onValueChange={(v) => setValue(field.key, v)}
          >
            <SelectTrigger id={field.key}>
              <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'FILE':
        // SabFiles is the single source for file inputs — the control sources
        // from the user's library or a fresh upload; there is intentionally no
        // free-text URL paste.
        return (
          <SabFileUrlInput
            value={typeof raw === 'string' ? raw : ''}
            onChange={(url) => setValue(field.key, url)}
            accept="all"
            placeholder={`Choose ${field.label.toLowerCase()}`}
          />
        );

      case 'NUMBER':
      case 'CURRENCY':
      case 'RATING':
        return (
          <Input
            id={field.key}
            type="number"
            step="any"
            required={field.required}
            value={raw !== undefined ? String(raw) : ''}
            onChange={(e) =>
              setValue(
                field.key,
                e.target.value === '' ? '' : Number(e.target.value),
              )
            }
            placeholder={field.description}
          />
        );

      case 'DATE':
        return (
          <Input
            id={field.key}
            type="date"
            required={field.required}
            value={typeof raw === 'string' ? raw : ''}
            onChange={(e) => setValue(field.key, e.target.value)}
          />
        );

      case 'DATE_TIME':
        return (
          <Input
            id={field.key}
            type="datetime-local"
            required={field.required}
            value={typeof raw === 'string' ? raw : ''}
            onChange={(e) => setValue(field.key, e.target.value)}
          />
        );

      case 'EMAIL':
        return (
          <Input
            id={field.key}
            type="email"
            required={field.required}
            value={typeof raw === 'string' ? raw : ''}
            onChange={(e) => setValue(field.key, e.target.value)}
            placeholder={field.description}
          />
        );

      case 'PHONE':
        return (
          <Input
            id={field.key}
            type="tel"
            required={field.required}
            value={typeof raw === 'string' ? raw : ''}
            onChange={(e) => setValue(field.key, e.target.value)}
            placeholder={field.description}
          />
        );

      case 'LINK':
        return (
          <Input
            id={field.key}
            type="url"
            required={field.required}
            value={typeof raw === 'string' ? raw : ''}
            onChange={(e) => setValue(field.key, e.target.value)}
            placeholder="https://"
          />
        );

      default:
        // TEXT and any future scalar types.
        if (field.type === 'TEXT' && field.description) {
          return (
            <Textarea
              id={field.key}
              required={field.required}
              value={typeof raw === 'string' ? raw : ''}
              onChange={(e) => setValue(field.key, e.target.value)}
              placeholder={field.description}
            />
          );
        }
        return (
          <Input
            id={field.key}
            type="text"
            required={field.required}
            value={typeof raw === 'string' ? raw : ''}
            onChange={(e) => setValue(field.key, e.target.value)}
            placeholder={field.description}
          />
        );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="sm:max-w-[480px]">
        <ZoruDialogHeader>
          <ZoruDialogTitle>New {object.labelSingular}</ZoruDialogTitle>
          <ZoruDialogDescription>
            Add a new {object.labelSingular.toLowerCase()} record.
          </ZoruDialogDescription>
        </ZoruDialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
            {fields.map((field) => (
              <div key={field.key} className="space-y-2">
                {field.type !== 'BOOLEAN' && (
                  <Label htmlFor={field.key}>
                    {field.label}
                    {field.required && (
                      <span className="ml-0.5 text-rose-500">*</span>
                    )}
                  </Label>
                )}
                {renderInput(field)}
              </div>
            ))}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <ZoruAlertTitle>Couldn’t create record</ZoruAlertTitle>
              <ZoruAlertDescription>{error}</ZoruAlertDescription>
            </Alert>
          )}

          <ZoruDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create {object.labelSingular}
            </Button>
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// View toolbar (search + view switch + sort + filters)
// ---------------------------------------------------------------------------

interface SortState {
  field: string;
  dir: 'asc' | 'desc';
}

interface ViewToolbarProps {
  object: ObjectMetadata;
  /** Layouts available for this object (`board` only when declared). */
  availableViews: ViewKind[];
  view: ViewKind;
  onViewChange: (view: ViewKind) => void;
  searchInput: string;
  onSearchInput: (value: string) => void;
  sort: SortState | null;
  onSortChange: (sort: SortState | null) => void;
  filters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  onClearFilters: () => void;
  resultCount: number;
  loading: boolean;
}

const NO_SORT = '__none__';
const ANY_FILTER = '__any__';

function ViewToolbar({
  object,
  availableViews,
  view,
  onViewChange,
  searchInput,
  onSearchInput,
  sort,
  onSortChange,
  filters,
  onFilterChange,
  onClearFilters,
  resultCount,
  loading,
}: ViewToolbarProps) {
  const sortableFields = React.useMemo(
    () => object.fields.filter((f) => f.type !== 'RELATION' && f.type !== 'FILE'),
    [object],
  );
  const filterableFields = React.useMemo(
    () => object.fields.filter((f) => FILTERABLE_TYPES.has(f.type)),
    [object],
  );

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="mb-4 flex flex-col gap-3">
      {/* Row 1: search + view switch */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
          <Input
            value={searchInput}
            onChange={(e) => onSearchInput(e.target.value)}
            placeholder={`Search ${object.labelPlural.toLowerCase()}…`}
            className="pl-9"
            aria-label={`Search ${object.labelPlural}`}
          />
        </div>

        <div className="flex items-center gap-3">
          {!loading && (
            <span className="text-sm text-zoru-ink-muted">
              {resultCount}{' '}
              {resultCount === 1
                ? object.labelSingular.toLowerCase()
                : object.labelPlural.toLowerCase()}
            </span>
          )}

          {availableViews.length > 1 && (
            <div
              className="inline-flex items-center gap-1 rounded-lg border border-zoru-line p-0.5"
              role="tablist"
              aria-label="View"
            >
              <Button
                type="button"
                size="sm"
                variant={view === 'table' ? 'secondary' : 'ghost'}
                onClick={() => onViewChange('table')}
                aria-pressed={view === 'table'}
                role="tab"
              >
                <Table2 className="mr-1.5 h-4 w-4" />
                Table
              </Button>
              {availableViews.includes('board') && (
                <Button
                  type="button"
                  size="sm"
                  variant={view === 'board' ? 'secondary' : 'ghost'}
                  onClick={() => onViewChange('board')}
                  aria-pressed={view === 'board'}
                  role="tab"
                >
                  <Columns3 className="mr-1.5 h-4 w-4" />
                  Board
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Row 2: sort + filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Sort field */}
        <div className="flex items-center gap-1.5">
          <ArrowDownUp className="h-4 w-4 text-zoru-ink-muted" />
          <Select
            value={sort?.field ?? NO_SORT}
            onValueChange={(field) =>
              onSortChange(
                field === NO_SORT
                  ? null
                  : { field, dir: sort?.dir ?? 'asc' },
              )
            }
          >
            <SelectTrigger className="h-9 w-[170px]" aria-label="Sort by">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_SORT}>No sorting</SelectItem>
              {sortableFields.map((f) => (
                <SelectItem key={f.key} value={f.key}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {sort && (
            <Select
              value={sort.dir}
              onValueChange={(dir) =>
                onSortChange({ field: sort.field, dir: dir === 'desc' ? 'desc' : 'asc' })
              }
            >
              <SelectTrigger className="h-9 w-[120px]" aria-label="Sort direction">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Ascending</SelectItem>
                <SelectItem value="desc">Descending</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Per-field filters */}
        {filterableFields.map((field) => {
          const value = filters[field.key] ?? '';
          if (field.type === 'SELECT' || field.type === 'BOOLEAN') {
            const options =
              field.type === 'BOOLEAN'
                ? [
                    { value: 'true', label: 'Yes' },
                    { value: 'false', label: 'No' },
                  ]
                : (field.options ?? []).map((o) => ({
                    value: o.value,
                    label: o.label,
                  }));
            return (
              <Select
                key={field.key}
                value={value === '' ? ANY_FILTER : value}
                onValueChange={(v) =>
                  onFilterChange(field.key, v === ANY_FILTER ? '' : v)
                }
              >
                <SelectTrigger
                  className="h-9 w-[160px]"
                  aria-label={`Filter by ${field.label}`}
                >
                  <SelectValue placeholder={field.label} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY_FILTER}>Any {field.label.toLowerCase()}</SelectItem>
                  {options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            );
          }
          // TEXT / EMAIL / PHONE / LINK → contains-style text filter.
          return (
            <Input
              key={field.key}
              value={value}
              onChange={(e) => onFilterChange(field.key, e.target.value)}
              placeholder={`Filter ${field.label.toLowerCase()}…`}
              className="h-9 w-[170px]"
              aria-label={`Filter by ${field.label}`}
            />
          );
        })}

        {(activeFilterCount > 0 || sort) && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              onClearFilters();
              onSortChange(null);
            }}
          >
            <X className="mr-1 h-4 w-4" />
            Clear
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1.5">
                <FilterIcon className="mr-1 h-3 w-3" />
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Record table
// ---------------------------------------------------------------------------

interface RecordTableProps {
  object: ObjectMetadata;
  columns: FieldMetadata[];
  records: CrmRecordWithLabel[];
  onOpen: (id: string) => void;
}

function RecordTableView({ object, columns, records, onOpen }: RecordTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-zoru-line">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.key}>{col.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => (
            <TableRow
              key={record._id}
              className="cursor-pointer"
              onClick={() => onOpen(record._id)}
            >
              {columns.map((col, idx) => (
                <TableCell key={col.key}>
                  {idx === 0 ? (
                    <Link
                      href={`/sabcrm/${object.slug}/${record._id}`}
                      className="font-medium text-zoru-ink hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {record.label || renderCellValue(col, record.data[col.key])}
                    </Link>
                  ) : (
                    renderCellValue(col, record.data[col.key])
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Record board (kanban)
// ---------------------------------------------------------------------------

interface RecordBoardProps {
  object: ObjectMetadata;
  groups: SabcrmRecordGroup[];
  onOpen: (id: string) => void;
}

function RecordBoardView({ object, groups, onOpen }: RecordBoardProps) {
  /** Pick up to two extra inTable columns (besides the label) for card preview. */
  const previewFields = React.useMemo(
    () =>
      object.fields
        .filter((f) => f.inTable && !f.isLabel && f.type !== 'RELATION')
        .slice(0, 2),
    [object],
  );

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {groups.map((group) => (
        <div
          key={group.key}
          className="flex w-72 shrink-0 flex-col rounded-xl border border-zoru-line bg-zoru-surface"
        >
          <div className="flex items-center justify-between border-b border-zoru-line px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Badge variant={badgeVariantForColor(group.color)}>
                {group.label}
              </Badge>
            </div>
            <span className="text-xs text-zoru-ink-muted">{group.total}</span>
          </div>

          <div className="flex flex-col gap-2 p-2">
            {group.records.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-zoru-ink-muted">
                Nothing here
              </p>
            ) : (
              group.records.map((record) => (
                <button
                  key={record._id}
                  type="button"
                  onClick={() => onOpen(record._id)}
                  className="w-full rounded-lg border border-zoru-line bg-zoru-bg px-3 py-2.5 text-left transition-colors hover:border-zoru-ink/30"
                >
                  <div className="truncate text-sm font-medium text-zoru-ink">
                    {record.label}
                  </div>
                  {previewFields.map((f) => {
                    const v = record.data[f.key];
                    if (v === null || v === undefined || v === '') return null;
                    return (
                      <div
                        key={f.key}
                        className="mt-1 truncate text-xs text-zoru-ink-muted"
                      >
                        {renderCellValue(f, v)}
                      </div>
                    );
                  })}
                </button>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading & error states
// ---------------------------------------------------------------------------

function TableSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="w-72 shrink-0 space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ))}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <ZoruAlertTitle>Unable to load</ZoruAlertTitle>
      <ZoruAlertDescription>{message}</ZoruAlertDescription>
    </Alert>
  );
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/**
 * Build the `filters` map for the actions layer. SELECT/BOOLEAN values are
 * exact-match; the BOOLEAN strings are coerced to real booleans. Text-style
 * fields become a case-insensitive `$regex` operator object.
 */
function buildFilters(
  object: ObjectMetadata,
  raw: Record<string, string>,
): Record<string, SabcrmFilterValue> {
  const out: Record<string, SabcrmFilterValue> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!value) continue;
    const field = object.fields.find((f) => f.key === key);
    if (!field) continue;
    if (field.type === 'BOOLEAN') {
      out[key] = value === 'true';
    } else if (field.type === 'SELECT') {
      out[key] = value;
    } else {
      out[key] = { $regex: value, $options: 'i' };
    }
  }
  return out;
}

function buildSort(sort: SortState | null): SabcrmSortClause[] | undefined {
  if (!sort) return undefined;
  return [{ field: sort.field, dir: sort.dir }];
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmObjectIndexPage() {
  const params = useParams<{ objectSlug: string }>();
  const router = useRouter();
  const objectSlug = params?.objectSlug ?? '';
  const { activeProjectId } = useProject();

  const [object, setObject] = React.useState<ObjectMetadata | null>(null);

  // View + query state.
  const [view, setView] = React.useState<ViewKind>('table');
  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [sort, setSort] = React.useState<SortState | null>(null);
  const [filters, setFilters] = React.useState<Record<string, string>>({});
  const [pageNum, setPageNum] = React.useState(1);

  // Data.
  const [page, setPage] = React.useState<SabcrmRecordPage | null>(null);
  const [board, setBoard] = React.useState<SabcrmGroupedRecordPage | null>(null);

  // Status.
  const [loadingObject, setLoadingObject] = React.useState(true);
  const [loadingRecords, setLoadingRecords] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [refreshTick, setRefreshTick] = React.useState(0);

  // Reset transient view state when the object changes.
  React.useEffect(() => {
    setSearchInput('');
    setSearch('');
    setSort(null);
    setFilters({});
    setPageNum(1);
  }, [objectSlug]);

  // Debounce the search box → committed `search`.
  React.useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPageNum(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Load object metadata when the slug or project changes.
  React.useEffect(() => {
    let cancelled = false;
    setLoadingObject(true);
    setError(null);

    (async () => {
      const res = await listObjectsAction(activeProjectId ?? undefined);
      if (cancelled) return;

      if (!res.ok) {
        setError(res.error);
        setObject(null);
        setLoadingObject(false);
        return;
      }

      const found = res.data.find((o) => o.slug === objectSlug) ?? null;
      setObject(found);
      // Default to whatever the object's first declared view is.
      if (found) {
        setView(found.views.includes('board') ? 'table' : 'table');
      }
      setLoadingObject(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [objectSlug, activeProjectId]);

  const availableViews = React.useMemo<ViewKind[]>(() => {
    if (!object) return ['table'];
    const v: ViewKind[] = ['table'];
    if (object.views.includes('board') && object.board?.groupByField) {
      v.push('board');
    }
    return v;
  }, [object]);

  // If the active view is no longer available (e.g. after switching objects),
  // fall back to table.
  React.useEffect(() => {
    if (!availableViews.includes(view)) setView('table');
  }, [availableViews, view]);

  // Committed (debounced + applied) filter map for the active object.
  const appliedFilters = React.useMemo(
    () => (object ? buildFilters(object, filters) : {}),
    [object, filters],
  );
  // Stable key so the data effect re-runs only when filters actually change.
  const filtersKey = React.useMemo(
    () => JSON.stringify(appliedFilters),
    [appliedFilters],
  );
  const sortKey = React.useMemo(() => JSON.stringify(sort), [sort]);

  // Load records / board whenever the query changes.
  React.useEffect(() => {
    if (!objectSlug || !object) return;
    let cancelled = false;
    setLoadingRecords(true);

    (async () => {
      if (view === 'board') {
        const res = await groupRecordsAction(
          {
            object: objectSlug,
            search: search || undefined,
            filters: appliedFilters,
            multiSort: buildSort(sort),
            pageSize: BOARD_CAP,
          },
          activeProjectId ?? undefined,
        );
        if (cancelled) return;
        if (!res.ok) {
          setError(res.error);
          setBoard(null);
        } else {
          setError(null);
          setBoard(res.data);
        }
      } else {
        const query: SabcrmRecordQuery = {
          object: objectSlug,
          page: pageNum,
          pageSize: PAGE_SIZE,
          search: search || undefined,
          filters: appliedFilters,
          multiSort: buildSort(sort),
        };
        const res = await listRecordsAction(query, activeProjectId ?? undefined);
        if (cancelled) return;
        if (!res.ok) {
          setError(res.error);
          setPage(null);
        } else {
          setError(null);
          setPage(res.data);
        }
      }
      setLoadingRecords(false);
    })();

    return () => {
      cancelled = true;
    };
    // `appliedFilters`/`sort` are tracked via their serialized keys to avoid
    // re-running on referentially-new-but-equal objects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    objectSlug,
    object,
    view,
    search,
    pageNum,
    filtersKey,
    sortKey,
    activeProjectId,
    refreshTick,
  ]);

  const tableColumns = React.useMemo(
    () => (object ? object.fields.filter((f) => f.inTable) : []),
    [object],
  );

  const handleCreated = React.useCallback(() => {
    setRefreshTick((t) => t + 1);
  }, []);

  const handleFilterChange = React.useCallback((key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPageNum(1);
  }, []);

  const handleClearFilters = React.useCallback(() => {
    setFilters({});
    setPageNum(1);
  }, []);

  const openRecord = React.useCallback(
    (id: string) => {
      if (!object) return;
      router.push(`/sabcrm/${object.slug}/${id}`);
    },
    [router, object],
  );

  // ---- Render --------------------------------------------------------------

  // RBAC-denied / plan-locked / load failure surfaces from the action error.
  if (error && !object && !loadingObject) {
    return (
      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        <ErrorState message={error} />
      </main>
    );
  }

  // Object metadata still resolving.
  if (loadingObject) {
    return (
      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        <Skeleton className="mb-6 h-8 w-48" />
        <TableSkeleton />
      </main>
    );
  }

  // Slug doesn't match any object in this workspace.
  if (!object) {
    return (
      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        <EmptyState
          icon={<Database />}
          title="Object not found"
          description={`No CRM object matches “${objectSlug}”. It may have been removed or you may not have access.`}
          action={
            <Button asChild variant="outline">
              <Link href="/sabcrm">Back to SabCRM</Link>
            </Button>
          }
        />
      </main>
    );
  }

  const records: CrmRecordWithLabel[] = page?.records ?? [];
  const boardGroups: SabcrmRecordGroup[] = board?.groups ?? [];
  const total = view === 'board' ? (board?.total ?? 0) : (page?.total ?? 0);
  const hasMore = view === 'table' && pageNum * PAGE_SIZE < total;
  const hasActiveQuery =
    !!search || Object.values(filters).some(Boolean);
  const isEmpty =
    view === 'board'
      ? boardGroups.every((g) => g.records.length === 0)
      : records.length === 0;

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zoru-ink">
            {object.labelPlural}
          </h1>
          {object.description && (
            <p className="mt-1 text-sm text-zoru-ink-muted">
              {object.description}
            </p>
          )}
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New {object.labelSingular}
        </Button>
      </div>

      {/* Toolbar */}
      <ViewToolbar
        object={object}
        availableViews={availableViews}
        view={view}
        onViewChange={(v) => {
          setView(v);
          setPageNum(1);
        }}
        searchInput={searchInput}
        onSearchInput={setSearchInput}
        sort={sort}
        onSortChange={(s) => {
          setSort(s);
          setPageNum(1);
        }}
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        resultCount={total}
        loading={loadingRecords}
      />

      {/* Inline error (records failed but object loaded) */}
      {error && (
        <div className="mb-4">
          <ErrorState message={error} />
        </div>
      )}

      {/* Body */}
      {loadingRecords && !page && !board ? (
        view === 'board' ? (
          <BoardSkeleton />
        ) : (
          <TableSkeleton />
        )
      ) : isEmpty ? (
        <EmptyState
          icon={<Database />}
          title={
            hasActiveQuery
              ? `No matching ${object.labelPlural.toLowerCase()}`
              : `No ${object.labelPlural.toLowerCase()} yet`
          }
          description={
            hasActiveQuery
              ? 'Try a different search term or clear your filters.'
              : `Create your first ${object.labelSingular.toLowerCase()} to get started.`
          }
          action={
            hasActiveQuery ? (
              <Button variant="outline" onClick={handleClearFilters}>
                <X className="mr-2 h-4 w-4" />
                Clear filters
              </Button>
            ) : (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New {object.labelSingular}
              </Button>
            )
          }
        />
      ) : view === 'board' ? (
        <RecordBoardView
          object={object}
          groups={boardGroups}
          onOpen={openRecord}
        />
      ) : (
        <RecordTableView
          object={object}
          columns={tableColumns}
          records={records}
          onOpen={openRecord}
        />
      )}

      {/* Pagination (table only) */}
      {view === 'table' &&
        records.length > 0 &&
        (pageNum > 1 || hasMore) && (
          <div className="mt-4 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              disabled={pageNum <= 1 || loadingRecords}
              onClick={() => setPageNum((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="text-sm text-zoru-ink-muted">Page {pageNum}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasMore || loadingRecords}
              onClick={() => setPageNum((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}

      {/* Create dialog */}
      <CreateRecordDialog
        object={object}
        projectId={activeProjectId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />
    </main>
  );
}
