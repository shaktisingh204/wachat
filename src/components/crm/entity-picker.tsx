'use client';

import {
  Popover,
  ZoruPopoverContent,
  ZoruPopoverTrigger,
  ZoruCommand,
  ZoruCommandEmpty,
  ZoruCommandGroup,
  ZoruCommandInput,
  ZoruCommandItem,
  ZoruCommandList,
  Avatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
  Select,
} from '@/components/zoruui';
import {
  Check,
  ChevronDown,
  Plus,
  X,
  Loader2,
  } from 'lucide-react';

/**
 * <EntityPicker> — unified picker UI for any registered entity.
 *
 * Backed by the single `lookupEntity` server action declared in
 * `src/app/actions/crm-lookup.actions.ts`. The picker itself is
 * entity-agnostic: the chip projection, search fields, and tenant
 * scope all live in the registry, so adding a new entity is a
 * server-side change with zero churn here.
 *
 * Notable behaviours:
 *   - Debounced search (200ms) with AbortController so stale results
 *     never overwrite a fresh query.
 *   - Hydrate-on-mount: if `value` is set, fetch by ids so the chip
 *     can render even if the doc isn't on page 1 of search results.
 *   - Recent ids: max 5 per entity in localStorage. Surfaced as a
 *     "Recent" group when the search box is empty.
 *   - Infinite scroll: appends pages on near-bottom scroll until
 *     `hasMore` is false.
 *   - Quick-create: optional last item that fires `onCreateClick` —
 *     this component never renders a modal itself.
 *
 * Visual: matches the zoru-ui input frame so pickers sit naturally
 * alongside `<Input>`/`<Select>` in CRM forms.
 */

import * as React from 'react';

import { cn } from '@/lib/utils';
import { lookupEntity } from '@/app/actions/crm-lookup.actions';
import {
  rustLookupEntity,
  recordPickedRecent,
} from '@/lib/rust-lookup-client';
import {
  type EntityKey,
  type LookupItem,
  type LookupParams,
  type LookupResult,
  isReferenceEntity,
} from '@/lib/lookup-registry';
import { QuickCreateDialog } from './quick-create-dialog';

/**
 * Env-flag that flips the picker from the TS server action to the Rust
 * `/v1/crm/lookup/{entity}` HTTP endpoint. Read once at module load —
 * callers don't need to react to it changing within a session.
 */
const USE_RUST_LOOKUP =
  process.env.NEXT_PUBLIC_USE_RUST_LOOKUP === 'true';

/**
 * Single dispatch point so every fetch site stays in sync. Returns the
 * same `LookupResult` envelope either way.
 */
function fetchLookup(
  entity: EntityKey,
  params: LookupParams,
): Promise<LookupResult> {
  return USE_RUST_LOOKUP
    ? rustLookupEntity(entity, params)
    : lookupEntity(entity, params);
}

/* ------------------------------------------------------------------ */
/* Public types                                                        */
/* ------------------------------------------------------------------ */

export interface EntityPickerProps {
  entity: EntityKey;
  value: string | string[] | null;
  onChange: (
    next: string | string[] | null,
    hydrated?: LookupItem | LookupItem[],
  ) => void;
  multi?: boolean;
  required?: boolean;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  filter?: Record<string, unknown>;
  scope?: 'project' | 'tenant' | 'global';
  /**
   * Show a "Create new" item at the bottom of the dropdown.
   * - For reference entities (country/city/etc) `onCreateClick` is unused
   *   — the picker commits the typed search value directly via `onChange`.
   *   This is the default for reference entities (`inlineCreate` auto-on).
   * - For tenant entities (client/project/etc) callers should provide
   *   `onCreateClick` to open their own create dialog.
   */
  allowCreate?: boolean;
  onCreateClick?: () => void;
  /**
   * Force inline-create behavior (commit raw search string via onChange).
   * Defaults to `true` for entities listed in `REFERENCE_ENTITY_KEYS`.
   * Set explicitly to opt-in/out on a per-instance basis.
   */
  inlineCreate?: boolean;
  recentLimit?: number;
  showChipMeta?: boolean;
  popoverWidth?: 'trigger' | 'auto' | number;
  className?: string;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const ENTITY_LABEL: Record<EntityKey, string> = {
  client: 'client',
  contact: 'contact',
  vendor: 'vendor',
  item: 'item',
  employee: 'employee',
  user: 'user',
  account: 'account',
  warehouse: 'warehouse',
  bankAccount: 'bank account',
  branch: 'branch',
  category: 'category',
  city: 'city',
  country: 'country',
  currency: 'currency',
  deal: 'deal',
  department: 'department',
  designation: 'designation',
  enum: 'option',
  industry: 'industry',
  invoice: 'invoice',
  issue: 'issue',
  jobTitle: 'job title',
  language: 'language',
  lead: 'lead',
  leadSource: 'lead source',
  location: 'location',
  pipeline: 'pipeline',
  project: 'project',
  purchaseOrder: 'purchase order',
  quotation: 'quotation',
  rfq: 'RFQ',
  sla: 'SLA',
  salutation: 'salutation',
  stage: 'stage',
  state: 'state',
  subtask: 'subtask',
  tag: 'tag',
  task: 'task',
  taxRate: 'tax rate',
  ticket: 'ticket',
  ticketGroup: 'ticket group',
  timezone: 'timezone',
  brand: 'brand',
  unit: 'unit',
  vendorBill: 'vendor bill',
  vendorType: 'vendor type',
  asset: 'asset',
};

/**
 * Recents storage key. The localStorage path is the LEGACY mechanism —
 * when `NEXT_PUBLIC_USE_RUST_LOOKUP === 'true'` the server-side Redis
 * LRU is the source of truth (see `crm-lookup::recents`) and the
 * picker reads `LookupResult.recent` directly from the empty-state
 * response. This local cache only kicks in when the flag is off.
 */
function recentsKey(entity: EntityKey) {
  return `entityPicker.recent.${entity}`;
}

function loadRecents(entity: EntityKey): string[] {
  if (typeof window === 'undefined') return [];
  if (USE_RUST_LOOKUP) return [];
  try {
    const raw = window.localStorage.getItem(recentsKey(entity));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id) => typeof id === 'string').slice(0, 5)
      : [];
  } catch {
    return [];
  }
}

function pushRecent(entity: EntityKey, id: string, max = 5) {
  if (typeof window === 'undefined') return;
  // When the Rust flag is on, `recordPickedRecent` already POSTs to
  // /v1/crm/lookup/{entity}/recent/{itemId} which feeds the per-tenant
  // Redis LRU. Skip the duplicate localStorage write.
  if (USE_RUST_LOOKUP) return;
  try {
    const current = loadRecents(entity).filter((x) => x !== id);
    const next = [id, ...current].slice(0, max);
    window.localStorage.setItem(recentsKey(entity), JSON.stringify(next));
  } catch {
    /* localStorage might be unavailable / full — non-fatal. */
  }
}

function initials(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/** Hand-rolled debounced value hook — kept inline to avoid a new dep. */
function useDebouncedValue<T>(value: T, delay = 200): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/* ------------------------------------------------------------------ */
/* Chip row                                                            */
/* ------------------------------------------------------------------ */

function ChipRow({
  item,
  showMeta,
}: {
  item: LookupItem;
  showMeta: boolean;
}) {
  const { primary, secondary, tertiary, avatarUrl } = item.chip;
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar className="h-6 w-6 shrink-0">
        {avatarUrl ? (
          <ZoruAvatarImage src={avatarUrl} alt={primary} />
        ) : null}
        <ZoruAvatarFallback className="bg-zoru-surface-2 text-[10px] text-zoru-ink-muted">
          {initials(primary) || '·'}
        </ZoruAvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-sm text-zoru-ink">{primary}</span>
        {showMeta && (secondary || tertiary) ? (
          <span className="truncate text-[11px] text-zoru-ink-muted">
            {[secondary, tertiary].filter(Boolean).join(' · ')}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Read-only chip — hydrates one id, useful in table cells             */
/* ------------------------------------------------------------------ */

export function EntityPickerChip({
  entity,
  id,
  fallback,
  showMeta = false,
  className,
}: {
  entity: EntityKey;
  id: string | null | undefined;
  fallback?: string;
  showMeta?: boolean;
  className?: string;
}) {
  const [item, setItem] = React.useState<LookupItem | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!id) {
      setItem(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    fetchLookup(entity, { ids: [id] })
      .then((res) => {
        if (cancelled) return;
        setItem(res.items[0] ?? null);
      })
      .catch(() => {
        /* network/auth failures fall through to fallback */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entity, id]);

  if (!id) {
    return (
      <span className={cn('text-sm text-zoru-ink-muted', className)}>
        {fallback ?? '—'}
      </span>
    );
  }

  if (loading) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-2 text-sm text-zoru-ink-muted',
          className,
        )}
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        {fallback ?? '…'}
      </span>
    );
  }

  if (!item) {
    return (
      <span
        className={cn(
          'inline-flex max-w-full items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-500',
          className,
        )}
        title={`ID not found: ${id}`}
      >
        Unknown/Deleted
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-2 rounded-md border border-zoru-line bg-zoru-bg px-2 py-1',
        className,
      )}
    >
      <ChipRow item={item} showMeta={showMeta} />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Main picker                                                         */
/* ------------------------------------------------------------------ */

export function EntityPicker({
  entity,
  value,
  onChange,
  multi = false,
  required = false,
  disabled = false,
  label,
  placeholder,
  filter,
  scope,
  // CRM ecosystem rule: every entity-reference field offers inline "Create new"
  // by default. Pass `allowCreate={false}` only when the entity is truly
  // immutable from this surface (rare — typically system catalogues).
  allowCreate = true,
  onCreateClick,
  inlineCreate,
  recentLimit = 5,
  showChipMeta = true,
  popoverWidth = 'trigger',
  className,
}: EntityPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebouncedValue(search, 200);

  // Result state — separate buckets for "search results" and the
  // hydrated chips so closing/reopening the popover doesn't lose the
  // selected item display.
  const [results, setResults] = React.useState<LookupItem[]>([]);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const [recentItems, setRecentItems] = React.useState<LookupItem[]>([]);

  // Hydrated currently-selected items (keyed by id).
  const [selectedItems, setSelectedItems] = React.useState<
    Record<string, LookupItem>
  >({});

  const abortRef = React.useRef<AbortController | null>(null);
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);

  const valueAsArray: string[] = React.useMemo(() => {
    if (value == null) return [];
    return Array.isArray(value) ? value : [value];
  }, [value]);

  // Stable signature so the hydration effect doesn't fire each render
  // when the parent passes a fresh array literal.
  const valueKey = React.useMemo(
    () => valueAsArray.join('|'),
    [valueAsArray],
  );

  // Hydrate selected ids on mount + whenever the upstream value changes.
  React.useEffect(() => {
    if (valueAsArray.length === 0) {
      setSelectedItems((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      return;
    }
    const missing = valueAsArray.filter((id) => !selectedItems[id]);
    if (missing.length === 0) return;

    let cancelled = false;
    fetchLookup(entity, { ids: missing })
      .then((res: LookupResult) => {
        if (cancelled) return;
        setSelectedItems((prev) => {
          const next = { ...prev };
          for (const it of res.items) next[it.id] = it;
          return next;
        });
      })
      .catch(() => {
        /* leave id raw — chip will render id-only fallback */
      });
    return () => {
      cancelled = true;
    };
    // We deliberately exclude `selectedItems` to avoid a refetch loop;
    // hydration is keyed by the *upstream* value identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, valueKey]);

  // Hydrate recents when the popover opens (or entity changes) so
  // chips render immediately without the user having to type.
  //
  // Two paths:
  //   1) USE_RUST_LOOKUP — the empty-state response carries `recent`
  //      hydrated from the per-tenant Redis LRU. One round trip.
  //   2) Legacy localStorage — read the cached id list, then fetch
  //      details by ids.
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;

    if (USE_RUST_LOOKUP) {
      // Empty-state lookup: no q, no ids, page=0 — the Rust handler
      // returns `result.recent` populated for the current user.
      fetchLookup(entity, { page: 0 })
        .then((res) => {
          if (cancelled) return;
          setRecentItems((res.recent ?? []).slice(0, recentLimit));
        })
        .catch(() => {
          if (!cancelled) setRecentItems([]);
        });
    } else {
      const ids = loadRecents(entity).slice(0, recentLimit);
      if (ids.length === 0) {
        setRecentItems([]);
        return;
      }
      fetchLookup(entity, { ids })
        .then((res) => {
          if (cancelled) return;
          const byId = new Map(res.items.map((it) => [it.id, it]));
          const ordered: LookupItem[] = [];
          for (const id of ids) {
            const it = byId.get(id);
            if (it) ordered.push(it);
          }
          setRecentItems(ordered);
        })
        .catch(() => {
          if (!cancelled) setRecentItems([]);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [open, entity, recentLimit]);

  // Run the search whenever the debounced query (or filter/scope) changes
  // while the popover is open. Aborts the previous in-flight request.
  React.useEffect(() => {
    if (!open) return;

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const params: LookupParams = {
      q: debouncedSearch || undefined,
      page: 1,
      limit: 20,
      filter,
      scope,
    };

    setLoading(true);
    fetchLookup(entity, params)
      .then((res) => {
        if (ac.signal.aborted) return;
        setResults(res.items);
        setPage(res.page);
        setHasMore(res.hasMore);
      })
      .catch(() => {
        if (ac.signal.aborted) return;
        setResults([]);
        setHasMore(false);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });

    return () => {
      ac.abort();
    };
    // `filter` is an object — stringify guards against new-literal churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entity, debouncedSearch, scope, JSON.stringify(filter ?? null)]);

  const loadNextPage = React.useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const res = await fetchLookup(entity, {
        q: debouncedSearch || undefined,
        page: page + 1,
        limit: 20,
        filter,
        scope,
      });
      setResults((prev) => {
        // Dedupe by id in case a doc shifts pages.
        const seen = new Set(prev.map((it) => it.id));
        const merged = [...prev];
        for (const it of res.items) {
          if (!seen.has(it.id)) merged.push(it);
        }
        return merged;
      });
      setPage(res.page);
      setHasMore(res.hasMore);
    } catch {
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, entity, debouncedSearch, page, filter, scope]);

  const handleScroll = React.useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) {
        void loadNextPage();
      }
    },
    [loadNextPage],
  );

  const commitSelection = React.useCallback(
    (item: LookupItem) => {
      pushRecent(entity, item.id, recentLimit);
      // When the Rust backend is enabled, also notify it so its
      // server-side LRU stays warm. No-op (and no token leak) when the
      // flag is off — see `recordPickedRecent` for the guard.
      void recordPickedRecent(entity, item.id);
      setSelectedItems((prev) => ({ ...prev, [item.id]: item }));

      if (multi) {
        const current = valueAsArray;
        let next: string[];
        let hydrated: LookupItem[];
        if (current.includes(item.id)) {
          next = current.filter((x) => x !== item.id);
          hydrated = next
            .map((id) => (id === item.id ? item : selectedItems[id]))
            .filter((x): x is LookupItem => Boolean(x));
        } else {
          next = [...current, item.id];
          hydrated = [
            ...current
              .map((id) => selectedItems[id])
              .filter((x): x is LookupItem => Boolean(x)),
            item,
          ];
        }
        onChange(next.length > 0 ? next : null, hydrated);
      } else {
        onChange(item.id, item);
        setOpen(false);
        setSearch('');
      }
    },
    [
      entity,
      recentLimit,
      multi,
      valueAsArray,
      selectedItems,
      onChange,
    ],
  );

  const removeSelected = React.useCallback(
    (id: string) => {
      if (multi) {
        const next = valueAsArray.filter((x) => x !== id);
        const hydrated = next
          .map((x) => selectedItems[x])
          .filter((x): x is LookupItem => Boolean(x));
        onChange(next.length > 0 ? next : null, hydrated);
      } else {
        onChange(null, undefined);
      }
    },
    [multi, valueAsArray, selectedItems, onChange],
  );

  // Keyboard: backspace on an empty search input in multi mode pops
  // the last chip — matches the standard token-input affordance.
  const handleSearchKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (
        multi &&
        e.key === 'Backspace' &&
        search.length === 0 &&
        valueAsArray.length > 0
      ) {
        e.preventDefault();
        removeSelected(valueAsArray[valueAsArray.length - 1]);
      }
    },
    [multi, search, valueAsArray, removeSelected],
  );

  /* ----- trigger contents ----- */

  const selectedHydrated: LookupItem[] = valueAsArray
    .map((id) => selectedItems[id])
    .filter((x): x is LookupItem => Boolean(x));

  const triggerPlaceholder =
    placeholder ??
    (multi
      ? `Select ${ENTITY_LABEL[entity]}s…`
      : `Select ${ENTITY_LABEL[entity]}…`);

  const popoverStyle: React.CSSProperties | undefined =
    typeof popoverWidth === 'number'
      ? { width: popoverWidth }
      : popoverWidth === 'trigger'
      ? { width: 'var(--radix-popover-trigger-width)' }
      : undefined;

  const showRecent =
    debouncedSearch.trim() === '' && recentItems.length > 0;

  return (
    <div className={cn('w-full', className)}>
      {label ? (
        <label className="mb-1 block text-xs text-zoru-ink">
          {label}
          {required ? <span className="ml-0.5 text-zoru-danger">*</span> : null}
        </label>
      ) : null}

      <Popover open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
        <ZoruPopoverTrigger asChild>
          <button
            ref={triggerRef}
            type="button"
            disabled={disabled}
            aria-required={required || undefined}
            aria-haspopup="listbox"
            aria-expanded={open}
            // Defensive: belt-and-braces guard so a wrapping <form>'s
            // submit handler never fires when the user is just opening
            // the picker. Radix's ZoruPopoverTrigger handles its own click,
            // we only stop bubbling so ancestor handlers don't react.
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'flex h-9 w-full items-center justify-between gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg px-3 text-left text-sm text-zoru-ink',
              'transition-colors hover:border-zoru-ink/40',
              'focus-visible:outline-none focus-visible:border-zoru-ink',
              'disabled:cursor-not-allowed disabled:opacity-50',
              multi && selectedHydrated.length > 0 && 'h-auto min-h-9 py-1.5',
            )}
          >
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
              {selectedHydrated.length === 0 ? (
                <span className="truncate text-zoru-ink-subtle">
                  {triggerPlaceholder}
                </span>
              ) : multi ? (
                selectedHydrated.map((it) => (
                  <span
                    key={it.id}
                    className="inline-flex max-w-full items-center gap-1 rounded-md border border-zoru-line bg-zoru-surface-2 px-1.5 py-0.5 text-xs text-zoru-ink"
                  >
                    <span className="truncate">{it.chip.primary}</span>
                    {!disabled && (
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label={`Remove ${it.chip.primary}`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          removeSelected(it.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            removeSelected(it.id);
                          }
                        }}
                        className="rounded p-0.5 text-zoru-ink-muted hover:text-zoru-ink"
                      >
                        <X className="h-3 w-3" />
                      </span>
                    )}
                  </span>
                ))
              ) : (
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <ChipRow
                    item={selectedHydrated[0]}
                    showMeta={showChipMeta}
                  />
                </span>
              )}
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 text-zoru-ink-muted" />
          </button>
        </ZoruPopoverTrigger>
        <ZoruPopoverContent
          align="start"
          className="z-[100] p-0"
          style={popoverStyle}
        >
          <ZoruCommand shouldFilter={false}>
            <ZoruCommandInput
              placeholder={`Search ${ENTITY_LABEL[entity]}s…`}
              value={search}
              onValueChange={setSearch}
              onKeyDown={handleSearchKeyDown}
            />
            <ZoruCommandList ref={listRef} onScroll={handleScroll}>
              <ZoruCommandEmpty>
                {loading ? (
                  <span className="inline-flex items-center gap-2 text-zoru-ink-muted">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Searching…
                  </span>
                ) : (
                  <span className="text-zoru-ink-muted">
                    No {ENTITY_LABEL[entity]}s found.
                  </span>
                )}
              </ZoruCommandEmpty>

              {(() => {
                const isReference = isReferenceEntity(entity);
                const useInline = inlineCreate ?? isReference;
                const showCreate = allowCreate || useInline;
                if (!showCreate) return null;
                const typed = search.trim();
                const hasExactMatch = results.some(
                  (r) => r.chip.primary.toLowerCase() === typed.toLowerCase(),
                );
                
                if (useInline) {
                  if (!typed || hasExactMatch) return null;
                }
                
                const ENTITY_CREATE_HREF: Partial<Record<EntityKey, string>> = {
                  invoice: '/dashboard/crm/sales/invoices/new',
                  quotation: '/dashboard/crm/sales/quotations/new',
                  purchaseOrder: '/dashboard/crm/purchases/orders/new',
                  vendorBill: '/dashboard/crm/purchases/expenses/new',
                  vendor: '/dashboard/crm/purchases/vendors/new',
                  item: '/dashboard/crm/inventory/items/new',
                  employee: '/dashboard/hrm/payroll/employees/new',
                  deal: '/dashboard/crm/deals',
                  lead: '/dashboard/crm/leads',
                  project: '/dashboard/crm/projects',
                  client: '/dashboard/crm/sales-crm/clients',
                  contact: '/dashboard/crm/contacts',
                  account: '/dashboard/crm/accounting/charts',
                  warehouse: '/dashboard/crm/inventory/warehouses',
                  bankAccount: '/dashboard/crm/banking/bank-accounts',
                  issue: '/dashboard/crm/projects/issues',
                  subtask: '/dashboard/crm/projects/subtasks',
                  task: '/dashboard/crm/sales-crm/tasks',
                  asset: '/dashboard/hrm/hr/assets',
                  ticket: '/dashboard/crm/tickets',
                  user: '/dashboard/team/manage-users',
                };

                return (
                  <ZoruCommandGroup>
                    <ZoruCommandItem
                      key="__create__"
                      value="__create__"
                      onSelect={() => {
                        if (useInline && typed) {
                          const synthetic: LookupItem = {
                            id: typed,
                            chip: { primary: typed },
                            raw: { name: typed, _inlineCreated: true },
                          };
                          commitSelection(synthetic);
                          return;
                        }
                        setOpen(false);
                        if (onCreateClick) {
                          onCreateClick();
                        } else {
                          const CORE_QUICK_CREATE = ['client', 'contact', 'vendor', 'item', 'employee', 'lead', 'project', 'task'];
                          if (CORE_QUICK_CREATE.includes(entity)) {
                            setQuickCreateOpen(true);
                          } else {
                            const href = ENTITY_CREATE_HREF[entity] || `/dashboard/crm/settings`;
                            window.open(href, '_blank');
                          }
                        }
                      }}
                      className="text-zoru-primary font-medium"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {useInline ? `Use` : `Create new ${ENTITY_LABEL[entity]}`}
                      {typed ? (
                        <span className="ml-1 truncate text-zoru-ink-muted font-normal">
                          “{typed}”
                        </span>
                      ) : null}
                    </ZoruCommandItem>
                  </ZoruCommandGroup>
                );
              })()}

              {showRecent ? (
                <ZoruCommandGroup heading="Recent">
                  {recentItems.map((item) => {
                    const selected = valueAsArray.includes(item.id);
                    return (
                      <ZoruCommandItem
                        key={`recent-${item.id}`}
                        value={`recent-${item.id}`}
                        onSelect={() => commitSelection(item)}
                      >
                        <ChipRow item={item} showMeta={showChipMeta} />
                        {selected ? (
                          <Check className="ml-auto h-4 w-4 text-zoru-ink" />
                        ) : null}
                      </ZoruCommandItem>
                    );
                  })}
                </ZoruCommandGroup>
              ) : null}

              <ZoruCommandGroup
                heading={
                  showRecent ? 'All results' : undefined
                }
              >
                {results.map((item) => {
                  const selected = valueAsArray.includes(item.id);
                  return (
                    <ZoruCommandItem
                      key={item.id}
                      value={item.id}
                      onSelect={() => commitSelection(item)}
                    >
                      <ChipRow item={item} showMeta={showChipMeta} />
                      {selected ? (
                        <Check className="ml-auto h-4 w-4 text-zoru-ink" />
                      ) : null}
                    </ZoruCommandItem>
                  );
                })}
                {loading && results.length > 0 ? (
                  <div className="flex items-center justify-center py-2 text-xs text-zoru-ink-muted">
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Loading…
                  </div>
                ) : null}
              </ZoruCommandGroup>
            </ZoruCommandList>
          </ZoruCommand>
        </ZoruPopoverContent>
      </Popover>

      <QuickCreateDialog
        open={quickCreateOpen}
        onOpenChange={setQuickCreateOpen}
        entity={entity}
        onCreated={(item) => commitSelection(item)}
      />
    </div>
  );
}

export default EntityPicker;
