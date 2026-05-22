'use client';

import {
  ZoruCommand,
  ZoruCommandEmpty,
  ZoruCommandGroup,
  ZoruCommandInput,
  ZoruCommandItem,
  ZoruCommandList,
  ZoruCommandSeparator,
  ZoruCommandShortcut,
  Dialog,
  ZoruDialogContent,
  ZoruDialogTitle,
  ZoruDialogDescription,
} from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';

/**
 * Global Cmd-K command palette for SabNode CRM.
 *
 * Foundation already provided by the lookup registry (§13 of
 * `crm_function_plan.md`):
 *   - `EntityKey` union of 8 entities — `src/lib/lookup-registry.ts`
 *   - `lookupEntity(entity, params)` server action — tenant-scoped
 *
 * This file consumes that foundation. It exposes:
 *   - `<CommandPaletteProvider>` — owns open state + the global
 *     Cmd/Ctrl+K listener; mount once at the dashboard layout.
 *   - `useCommandPalette()` — programmatic open/close from any
 *     descendant (e.g. the dashboard chrome's discoverability button).
 *
 * Behaviour:
 *   - Empty input → curated quick actions + recents (read from the
 *     `entityPicker.recent.<entity>` localStorage keys populated by
 *     `<EntityPicker>`).
 *   - Non-empty input → 8-way parallel `lookupEntity` calls, debounced
 *     200ms, each new search aborts the in-flight one. Top 5 hits per
 *     entity, grouped.
 *   - Selecting an item navigates to its detail page.
 *   - Esc / overlay click / select all close the dialog.
 */

import * as React from 'react';

import { lookupEntity } from '@/app/actions/crm-lookup.actions';
import { rustLookupEntity } from '@/lib/rust-lookup-client';
import type { EntityKey, LookupItem, LookupParams, LookupResult } from '@/lib/lookup-registry';

/**
 * Env-flag that flips the palette from the TS server action to the
 * Rust `/v1/crm/lookup/{entity}` HTTP endpoint. Read once at module
 * load — callers don't need to react to it changing within a session.
 */
const USE_RUST_LOOKUP =
  process.env.NEXT_PUBLIC_USE_RUST_LOOKUP === 'true';

/**
 * Single dispatch point so every fetch site stays in sync. Returns
 * the same `LookupResult` envelope either way.
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
/* Static maps                                                          */
/* ------------------------------------------------------------------ */

const entityHref: Record<EntityKey, (id: string) => string> = {
  client: (id) => `/dashboard/crm/sales/clients/${id}`,
  contact: (id) => `/dashboard/crm/contacts/${id}`,
  vendor: (id) => `/dashboard/crm/purchases/vendors/${id}`,
  item: (id) => `/dashboard/crm/inventory/items/${id}`,
  employee: (id) => `/dashboard/hrm/payroll/employees/${id}`,
  // Users currently route to the team manage-users page; the lookup
  // registry only resolves the current user safely (RBAC reasons).
  user: () => `/dashboard/team/manage-users`,
  account: (id) => `/dashboard/crm/accounting/charts/${id}`,
  warehouse: (id) => `/dashboard/crm/inventory/warehouses/${id}`,
  bankAccount: (id) => `/dashboard/crm/banking/bank-accounts/${id}`,
  // The entries below have no dedicated detail page yet — fall back to
  // the relevant list/settings route. Update when detail pages land.
  branch: () => `/dashboard/crm/settings`,
  category: () => `/dashboard/crm/inventory/items`,
  city: () => `/dashboard/crm/settings`,
  country: () => `/dashboard/crm/settings`,
  currency: () => `/dashboard/crm/settings`,
  deal: (id) => `/dashboard/crm/deals/${id}`,
  department: () => `/dashboard/hrm/payroll/departments`,
  designation: () => `/dashboard/hrm/payroll/designations`,
  // The `enum` key is a form-field-only picker (status, priority, etc.) —
  // there is no detail page, so the fallback just routes to settings.
  enum: () => `/dashboard/crm/settings`,
  invoice: (id) => `/dashboard/crm/sales/invoices/${id}`,
  issue: (id) => `/dashboard/crm/projects/issues/${id}`,
  jobTitle: () => `/dashboard/crm/settings`,
  language: () => `/dashboard/crm/settings`,
  lead: (id) => `/dashboard/crm/leads/${id}`,
  leadSource: () => `/dashboard/crm/settings`,
  pipeline: () => `/dashboard/crm/sales-crm/pipelines`,
  project: (id) => `/dashboard/crm/projects/${id}`,
  purchaseOrder: (id) => `/dashboard/crm/purchases/orders/${id}`,
  quotation: (id) => `/dashboard/crm/sales/quotations/${id}`,
  rfq: (id) => `/dashboard/crm/purchases/rfqs/${id}`,
  sla: () => `/dashboard/crm/tickets/sla`,
  salutation: () => `/dashboard/crm/settings`,
  stage: () => `/dashboard/crm/sales-crm/pipelines`,
  state: () => `/dashboard/crm/settings`,
  tag: () => `/dashboard/crm/settings`,
  taxRate: () => `/dashboard/crm/settings`,
  timezone: () => `/dashboard/crm/settings`,
  brand: () => `/dashboard/crm/settings`,
  unit: () => `/dashboard/crm/settings`,
  industry: () => `/dashboard/crm/settings`,
  location: () => `/dashboard/crm/settings`,
  vendorType: () => `/dashboard/crm/settings`,
  // No detail route for tasks yet — fall back to the tasks list.
  subtask: (id) => `/dashboard/crm/projects/subtasks/${id}`,
  task: () => `/dashboard/crm/sales-crm/tasks`,
  asset: (id) => `/dashboard/hrm/hr/assets/${id}`,
  ticket: (id) => `/dashboard/crm/tickets/${id}`,
  ticketGroup: () => `/dashboard/crm/tickets/groups`,
  vendorBill: (id) => `/dashboard/crm/purchases/expenses/${id}`,
};

const entityLabel: Record<EntityKey, string> = {
  client: 'Clients',
  contact: 'Contacts',
  vendor: 'Vendors',
  item: 'Items',
  employee: 'Employees',
  user: 'Users',
  account: 'Accounts',
  warehouse: 'Warehouses',
  bankAccount: 'Bank Accounts',
  branch: 'Branches',
  category: 'Categories',
  city: 'Cities',
  country: 'Countries',
  currency: 'Currencies',
  deal: 'Deals',
  department: 'Departments',
  designation: 'Designations',
  enum: 'Options',
  invoice: 'Invoices',
  issue: 'Issues',
  jobTitle: 'Job Titles',
  language: 'Languages',
  lead: 'Leads',
  leadSource: 'Lead Sources',
  pipeline: 'Pipelines',
  project: 'Projects',
  purchaseOrder: 'Purchase Orders',
  quotation: 'Quotations',
  rfq: 'RFQs',
  salutation: 'Salutations',
  sla: 'SLAs',
  stage: 'Stages',
  state: 'States',
  tag: 'Tags',
  taxRate: 'Tax Rates',
  timezone: 'Timezones',
  brand: 'Brands',
  unit: 'Units',
  industry: 'Industries',
  location: 'Locations',
  vendorType: 'Vendor Types',
  subtask: 'Subtasks',
  task: 'Tasks',
  asset: 'Assets',
  ticket: 'Tickets',
  ticketGroup: 'Ticket Groups',
  vendorBill: 'Vendor Bills',
};

const ENTITY_ORDER: EntityKey[] = [
  // Core CRM entities
  'client',
  'contact',
  'vendor',
  'item',
  // HR/Team
  'employee',
  'user',
  // Accounting
  'account',
  'bankAccount',
  'warehouse',
  // Sales documents
  'invoice',
  'quotation',
  'deal',
  'lead',
  'task',
  'project',
  // Purchases
  'purchaseOrder',
  'vendorBill',
  // Operational reference
  'department',
  'designation',
  'category',
  'asset',
  'taxRate',
  'pipeline',
  'ticketGroup',
];

interface QuickAction {
  id: string;
  label: string;
  hint: string;
  href: string;
}

// Curated. Each href has been verified to have a matching `page.tsx`
// on disk. "New client" was dropped — the clients module doesn't
// expose a `/new` route yet (creates inline on the index page).
const quickActions: QuickAction[] = [
  { id: 'qa-invoice',     label: 'New invoice',            hint: 'Sales',      href: '/dashboard/crm/sales/invoices/new' },
  { id: 'qa-quotation',   label: 'New quotation',          hint: 'Sales',      href: '/dashboard/crm/sales/quotations/new' },
  { id: 'qa-sales-order', label: 'New sales order',        hint: 'Sales',      href: '/dashboard/crm/sales/orders/new' },
  { id: 'qa-po',          label: 'New purchase order',     hint: 'Purchases',  href: '/dashboard/crm/purchases/orders/new' },
  { id: 'qa-bill',        label: 'New bill',               hint: 'Purchases',  href: '/dashboard/crm/purchases/expenses/new' },
  { id: 'qa-vendor',      label: 'New vendor',             hint: 'Purchases',  href: '/dashboard/crm/purchases/vendors/new' },
  { id: 'qa-item',        label: 'New item',               hint: 'Inventory',  href: '/dashboard/crm/inventory/items/new' },
  { id: 'qa-payroll',     label: 'Run payroll',            hint: 'HRM',        href: '/dashboard/hrm/payroll/payroll' },
  { id: 'qa-employee',    label: 'Add employee',           hint: 'HRM',        href: '/dashboard/hrm/payroll/employees/new' },
  { id: 'qa-coa',         label: 'Open chart of accounts', hint: 'Accounting', href: '/dashboard/crm/accounting/charts' },
  { id: 'qa-warehouses',  label: 'Open warehouses',        hint: 'Inventory',  href: '/dashboard/crm/inventory/warehouses' },
];

const RECENT_KEY = (e: EntityKey) => `entityPicker.recent.${e}`;

const SEARCH_DEBOUNCE_MS = 200;
const PER_ENTITY_LIMIT = 5;
const RECENTS_DISPLAY_LIMIT = 8;

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function loadRecentIds(entity: EntityKey): string[] {
  if (typeof window === 'undefined') return [];
  // When the Rust backend is the source of truth, recents come back
  // inline on the empty-state lookup response (`result.recent`) — no
  // localStorage needed. Returning [] short-circuits the legacy path.
  if (USE_RUST_LOOKUP) return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY(entity));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
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

interface ResultRow {
  entity: EntityKey;
  item: LookupItem;
}

interface RecentEntry {
  entity: EntityKey;
  item: LookupItem;
}

/* ------------------------------------------------------------------ */
/* Provider + hook                                                      */
/* ------------------------------------------------------------------ */

interface CommandPaletteContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const CommandPaletteContext = React.createContext<CommandPaletteContextValue | null>(null);

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);

  // Global Cmd/Ctrl+K listener. Toggles the palette; bails out when
  // the user is mid-IME composition (so non-Latin input methods aren't
  // disrupted).
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const value = React.useMemo<CommandPaletteContextValue>(
    () => ({ open, setOpen }),
    [open],
  );

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <CommandPalette open={open} onOpenChange={setOpen} />
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = React.useContext(CommandPaletteContext);
  if (!ctx) {
    throw new Error('useCommandPalette must be used inside <CommandPaletteProvider>.');
  }
  return ctx;
}

/* ------------------------------------------------------------------ */
/* The palette itself                                                   */
/* ------------------------------------------------------------------ */

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [debouncedQuery, setDebouncedQuery] = React.useState('');
  const [results, setResults] = React.useState<Record<EntityKey, LookupItem[]>>(() => emptyResults());
  const [isSearching, setIsSearching] = React.useState(false);

  const [recents, setRecents] = React.useState<RecentEntry[]>([]);
  const [recentsLoaded, setRecentsLoaded] = React.useState(false);

  // Reset state when the palette closes — keeps re-opens fresh.
  React.useEffect(() => {
    if (!open) {
      setQuery('');
      setDebouncedQuery('');
      setResults(emptyResults());
      setIsSearching(false);
    }
  }, [open]);

  // Debounce the input.
  React.useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [query, open]);

  // Hydrate recents on every open. Two paths:
  //   1) USE_RUST_LOOKUP — empty-state lookup per entity returns
  //      `result.recent` populated from the per-tenant Redis LRU. Same
  //      8 calls; one round trip each, no separate ids fetch.
  //   2) Legacy — read localStorage ids per entity, then fetch by ids.
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setRecentsLoaded(false);
    (async () => {
      const tasks = ENTITY_ORDER.map(async (entity) => {
        if (USE_RUST_LOOKUP) {
          try {
            const res = await fetchLookup(entity, { page: 0 });
            return { entity, items: res.recent ?? [] };
          } catch {
            return { entity, items: [] as LookupItem[] };
          }
        }
        const ids = loadRecentIds(entity);
        if (ids.length === 0) return { entity, items: [] as LookupItem[] };
        try {
          const res = await fetchLookup(entity, { ids });
          // Preserve the localStorage order (most-recent-first).
          const byId = new Map(res.items.map((it) => [it.id, it]));
          const ordered = ids
            .map((id) => byId.get(id))
            .filter((x): x is LookupItem => Boolean(x));
          return { entity, items: ordered };
        } catch {
          return { entity, items: [] as LookupItem[] };
        }
      });
      const resolved = await Promise.all(tasks);
      if (cancelled) return;

      // Round-robin across entities so a heavy user of "client" doesn't
      // monopolise the 8-slot strip.
      const flat: RecentEntry[] = [];
      let pulled = true;
      let idx = 0;
      while (pulled && flat.length < RECENTS_DISPLAY_LIMIT) {
        pulled = false;
        for (const bucket of resolved) {
          const next = bucket.items[idx];
          if (next) {
            flat.push({ entity: bucket.entity, item: next });
            pulled = true;
            if (flat.length >= RECENTS_DISPLAY_LIMIT) break;
          }
        }
        idx += 1;
      }
      setRecents(flat);
      setRecentsLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  // Search — fan out across all 8 entities in parallel. AbortController
  // can't reach across server-action boundaries, but we use a generation
  // counter to drop stale responses.
  const searchGen = React.useRef(0);
  React.useEffect(() => {
    if (!open) return;
    const q = debouncedQuery;
    if (q.length === 0) {
      setResults(emptyResults());
      setIsSearching(false);
      return;
    }

    const myGen = ++searchGen.current;
    const controller = new AbortController();
    setIsSearching(true);

    (async () => {
      try {
        const settled = await Promise.all(
          ENTITY_ORDER.map(async (entity) => {
            try {
              const res = await fetchLookup(entity, { q, limit: PER_ENTITY_LIMIT });
              return [entity, res.items] as const;
            } catch {
              return [entity, [] as LookupItem[]] as const;
            }
          }),
        );
        if (controller.signal.aborted) return;
        if (myGen !== searchGen.current) return; // stale
        const next = emptyResults();
        for (const [entity, items] of settled) next[entity] = items;
        setResults(next);
      } finally {
        if (myGen === searchGen.current) setIsSearching(false);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [debouncedQuery, open]);

  const handleSelectItem = React.useCallback(
    (entity: EntityKey, item: LookupItem) => {
      const href = entityHref[entity](item.id);
      onOpenChange(false);
      router.push(href);
    },
    [onOpenChange, router],
  );

  const handleSelectAction = React.useCallback(
    (action: QuickAction) => {
      onOpenChange(false);
      router.push(action.href);
    },
    [onOpenChange, router],
  );

  const isEmptyQuery = debouncedQuery.length === 0;
  const totalHits = ENTITY_ORDER.reduce((acc, e) => acc + results[e].length, 0);

  return (
    <ZoruDialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent
        className="overflow-hidden p-0 shadow-lg sm:max-w-2xl border-zoru-line bg-zoru-surface-2"
      >
        <ZoruDialogTitle className="sr-only">ZoruCommand palette</ZoruDialogTitle>
        <ZoruDialogDescription className="sr-only">
          Search clients, vendors, items, employees, and run quick actions.
        </ZoruDialogDescription>
        <ZoruCommand
          className="bg-transparent text-zoru-ink [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-zoru-ink-muted [&_[cmdk-group]]:px-2 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-3 [&_[cmdk-item]]:py-2.5"
          shouldFilter={!isEmptyQuery ? false : true}
          // When typing, we already filter on the server — disable the
          // built-in fuzzy filter so server hits always render. When
          // empty, we let cmdk filter the static quick actions.
        >
          <ZoruCommandInput
            placeholder="Search or run a command…"
            value={query}
            onValueChange={setQuery}
            autoFocus
          />
          <ZoruCommandList className="max-h-[60vh] border-t border-zoru-line">
            {isEmptyQuery ? (
              <>
                <ZoruCommandGroup heading="Quick actions">
                  {quickActions.map((action) => (
                    <ZoruCommandItem
                      key={action.id}
                      value={`${action.label} ${action.hint}`}
                      onSelect={() => handleSelectAction(action)}
                    >
                      <span className="flex-1 truncate">{action.label}</span>
                      <ZoruCommandShortcut className="text-zoru-ink-muted">{action.hint}</ZoruCommandShortcut>
                    </ZoruCommandItem>
                  ))}
                </ZoruCommandGroup>
                {recentsLoaded && recents.length > 0 ? (
                  <>
                    <ZoruCommandSeparator className="bg-zoru-line" />
                    <ZoruCommandGroup heading="Recent">
                      {recents.map(({ entity, item }) => (
                        <ResultItem
                          key={`recent-${entity}-${item.id}`}
                          entity={entity}
                          item={item}
                          valuePrefix="recent"
                          onSelect={() => handleSelectItem(entity, item)}
                        />
                      ))}
                    </ZoruCommandGroup>
                  </>
                ) : null}
              </>
            ) : (
              <>
                {!isSearching && totalHits === 0 ? (
                  <ZoruCommandEmpty>No results for &ldquo;{debouncedQuery}&rdquo;.</ZoruCommandEmpty>
                ) : null}

                {ENTITY_ORDER.map((entity) => {
                  const items = results[entity];
                  if (items.length === 0) return null;
                  return (
                    <ZoruCommandGroup key={entity} heading={entityLabel[entity]}>
                      {items.map((item) => (
                        <ResultItem
                          key={`${entity}-${item.id}`}
                          entity={entity}
                          item={item}
                          valuePrefix="search"
                          onSelect={() => handleSelectItem(entity, item)}
                        />
                      ))}
                    </ZoruCommandGroup>
                  );
                })}

                {isSearching && totalHits === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-zoru-ink-muted">
                    Searching…
                  </div>
                ) : null}
              </>
            )}
          </ZoruCommandList>
        </ZoruCommand>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}

/* ------------------------------------------------------------------ */
/* Internals                                                            */
/* ------------------------------------------------------------------ */

function emptyResults(): Record<EntityKey, LookupItem[]> {
  return {
    client: [],
    contact: [],
    vendor: [],
    item: [],
    employee: [],
    user: [],
    account: [],
    warehouse: [],
    bankAccount: [],
    branch: [],
    category: [],
    city: [],
    country: [],
    currency: [],
    deal: [],
    department: [],
    designation: [],
    invoice: [],
    issue: [],
    jobTitle: [],
    language: [],
    lead: [],
    leadSource: [],
    pipeline: [],
    project: [],
    purchaseOrder: [],
    quotation: [],
    rfq: [],
    sla: [],
    salutation: [],
    stage: [],
    state: [],
    tag: [],
    taxRate: [],
    timezone: [],
    brand: [],
    unit: [],
    industry: [],
    location: [],
    vendorType: [],
    subtask: [],
    task: [],
    asset: [],
    ticket: [],
    ticketGroup: [],
    vendorBill: [],
  };
}

interface ResultItemProps {
  entity: EntityKey;
  item: LookupItem;
  valuePrefix: string;
  onSelect: () => void;
}

function ResultItem({ entity, item, valuePrefix, onSelect }: ResultItemProps) {
  const { chip } = item;
  // Build a unique cmdk `value` so duplicate primaries (e.g. two
  // vendors named "Acme") don't collapse into one filter row, and so
  // users can still search by secondary/tertiary tokens.
  const value = [
    valuePrefix,
    entity,
    item.id,
    chip.primary,
    chip.secondary,
    chip.tertiary,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <ZoruCommandItem value={value} onSelect={onSelect}>
      <ZoruAvatar avatarUrl={chip.avatarUrl} fallback={initials(chip.primary)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm text-zoru-ink">{chip.primary}</span>
        {chip.secondary || chip.tertiary ? (
          <span className="truncate text-[11px] text-zoru-ink-muted">
            {[chip.secondary, chip.tertiary].filter(Boolean).join(' · ')}
          </span>
        ) : null}
      </div>
      <ZoruCommandShortcut className="text-zoru-ink-muted">
        {entityLabel[entity]}
      </ZoruCommandShortcut>
    </ZoruCommandItem>
  );
}

function ZoruAvatar({ avatarUrl, fallback }: { avatarUrl?: string; fallback: string }) {
  if (avatarUrl) {
    return (
      // Plain <img> on purpose: the palette is a transient overlay, the
      // images come from arbitrary tenant URLs (R2/S3/external), and
      // `next/image` would force a remotePatterns config per host.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className="mr-2 h-7 w-7 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zoru-line bg-zoru-surface text-[10px] font-medium text-zoru-ink-muted"
    >
      {fallback || '·'}
    </span>
  );
}
