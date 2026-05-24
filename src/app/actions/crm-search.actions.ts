'use server';

/**
 * CRM Global Search — server action per CRM_REBUILD_PLAN §5.2.
 *
 * `searchCrmEntities(q)` fans out across every registered entity in the
 * `lookupEntity` registry (`src/lib/lookup-registry.ts`) in parallel,
 * gates each entity on the user's RBAC `view` permission, caps results
 * per group at 10, and returns a flat list of `SearchResultGroup` for
 * the `/dashboard/crm/search` page to render grouped cards.
 *
 * Design notes:
 *  - Empty `q` short-circuits to `[]` so we don't accidentally page the
 *    entire tenant's data on a stray render.
 *  - We swallow per-entity failures so one slow/broken collection can't
 *    take down the whole search page.
 *  - RBAC: we use `canServer(<crm_key>, 'view')` per kind. Kinds without
 *    a dedicated RBAC key (reference data like `country`, `currency`)
 *    are visible to anyone signed in — same posture as the Cmd-K palette
 *    and `<EntityPicker>`.
 *  - Permission keys mirror the modules listed in `src/lib/permission-modules.ts`.
 *    No new RBAC keys are introduced (per the task constraints).
 */

import { lookupEntity } from '@/app/actions/crm-lookup.actions';
import { canServer } from '@/lib/rbac-server';
import { getSession } from '@/app/actions/user.actions';
import { ENTITY_KEYS, type EntityKey } from '@/lib/lookup-registry';

/** A single result row for the search page. */
export interface SearchResult {
  /** Stable id — Mongo `_id` for DB-backed entities, code/name for static ones. */
  id: string;
  /** Primary label rendered as the row title. */
  primary: string;
  /** Optional sub-label (sku, gstin, etc). */
  secondary?: string;
  /** Optional avatar URL — falls back to initials in the UI. */
  avatarUrl?: string;
  /** Detail-page route the row should navigate to on click. */
  route: string;
}

/** A grouped section of search results — one per entity kind. */
export interface SearchResultGroup {
  entityKind: EntityKey;
  /** Human-readable label, e.g. "Clients", "Invoices". */
  label: string;
  results: SearchResult[];
}

/** Hard cap per group so a single kind can't dominate the page. */
const PER_GROUP_LIMIT = 10;

/* ------------------------------------------------------------------ */
/* Static maps — kept here (instead of importing from the Cmd-K        */
/* palette) so this server file stays free of `'use client'` imports.  */
/* ------------------------------------------------------------------ */

const ENTITY_LABEL: Record<EntityKey, string> = {
  client: 'Clients',
  contact: 'Contacts',
  vendor: 'Vendors',
  item: 'Items',
  employee: 'Employees',
  user: 'Users',
  account: 'Chart of Accounts',
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
  sla: 'SLAs',
  salutation: 'Salutations',
  stage: 'Stages',
  state: 'States',
  tag: 'Tags',
  taxRate: 'Tax Rates',
  timezone: 'Timezones',
  brand: 'Brands',
  unit: 'Units',
  industry: 'Industries',
  location: 'Locations',
  vendorBill: 'Vendor Bills',
  vendorType: 'Vendor Types',
  subtask: 'Subtasks',
  task: 'Tasks',
  asset: 'Assets',
  ticket: 'Tickets',
  ticketGroup: 'Ticket Groups',
};

const ENTITY_ROUTE: Record<EntityKey, (id: string) => string> = {
  client: (id) => `/dashboard/crm/sales/clients/${id}`,
  contact: (id) => `/dashboard/crm/contacts/${id}`,
  vendor: (id) => `/dashboard/crm/purchases/vendors/${id}`,
  item: (id) => `/dashboard/crm/inventory/items/${id}`,
  employee: (id) => `/dashboard/hrm/payroll/employees/${id}`,
  user: () => `/dashboard/crm/team/manage-users`,
  account: (id) => `/dashboard/crm/accounting/charts/${id}`,
  warehouse: (id) => `/dashboard/crm/inventory/warehouses/${id}`,
  bankAccount: (id) => `/dashboard/crm/banking/bank-accounts/${id}`,
  branch: () => `/dashboard/crm/settings`,
  category: () => `/dashboard/crm/inventory/items`,
  city: () => `/dashboard/crm/settings`,
  country: () => `/dashboard/crm/settings`,
  currency: () => `/dashboard/crm/settings`,
  deal: (id) => `/dashboard/crm/deals/${id}`,
  department: () => `/dashboard/hrm/payroll/departments`,
  designation: () => `/dashboard/hrm/payroll/designations`,
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
  subtask: (id) => `/dashboard/crm/projects/subtasks/${id}`,
  task: () => `/dashboard/crm/sales-crm/tasks`,
  asset: (id) => `/dashboard/hrm/hr/assets/${id}`,
  ticket: (id) => `/dashboard/crm/tickets/${id}`,
  ticketGroup: () => `/dashboard/crm/tickets/groups`,
  vendorBill: (id) => `/dashboard/crm/purchases/expenses/${id}`,
};

/**
 * RBAC module key per entity. `null` means "no gate" — reference-data
 * kinds like countries/currencies don't have a per-feature permission;
 * they're treated as visible to any authenticated user.
 */
const ENTITY_PERMISSION_KEY: Record<EntityKey, string | null> = {
  client: 'crm_clients',
  contact: 'crm_contact',
  vendor: 'crm_vendors',
  item: 'crm_inventory_items',
  employee: 'crm_employee',
  user: 'team_users',
  account: 'crm_chart_of_accounts',
  warehouse: 'crm_warehouse',
  bankAccount: 'crm_bank_accounts',
  branch: 'crm_branch',
  category: 'crm_inventory_items',
  deal: 'crm_deals',
  department: 'crm_department',
  designation: 'crm_designation',
  invoice: 'crm_invoices',
  issue: 'crm_issue',
  lead: 'crm_leads',
  pipeline: 'crm_pipelines',
  project: 'crm_projects',
  purchaseOrder: 'crm_purchase_orders',
  quotation: 'crm_quotations',
  rfq: 'crm_rfq',
  sla: 'crm_ticket_groups',
  stage: 'crm_pipelines',
  tag: 'crm_settings',
  taxRate: 'crm_settings',
  brand: 'crm_inventory_items',
  subtask: 'crm_subtask',
  task: 'crm_tasks',
  asset: 'crm_asset',
  ticket: 'crm_ticket',
  ticketGroup: 'crm_ticket_groups',
  vendorBill: 'crm_bill',
  // Reference-data / static kinds — no RBAC gate.
  city: null,
  country: null,
  currency: null,
  enum: null,
  jobTitle: null,
  language: null,
  leadSource: null,
  salutation: null,
  state: null,
  timezone: null,
  unit: null,
  industry: null,
  location: null,
  vendorType: null,
};

/**
 * Global search across every registered `EntityKey`. Returns groups in
 * the declaration order of `ENTITY_KEYS` (the same canonical order used
 * elsewhere). Empty/whitespace queries short-circuit to `[]`.
 */
export async function searchCrmEntities(
  q: string,
  limit: number = 50,
): Promise<SearchResultGroup[]> {
  const query = q?.trim() ?? '';
  if (query.length === 0) return [];

  // Bail out cheaply if the user isn't signed in — `lookupEntity` would
  // return empty envelopes anyway, but no need to spin up 39 of them.
  const session = await getSession();
  if (!session?.user) return [];

  const perGroup = Math.max(1, Math.min(PER_GROUP_LIMIT, limit));

  const groups = await Promise.all(
    ENTITY_KEYS.map(async (entity): Promise<SearchResultGroup | null> => {
      // Permission gate. Unknown / static kinds (`null`) skip the gate.
      const permKey = ENTITY_PERMISSION_KEY[entity];
      if (permKey) {
        try {
          const allowed = await canServer(permKey, 'view');
          if (!allowed) return null;
        } catch {
          // If the RBAC layer throws, be conservative — drop the group.
          return null;
        }
      }

      try {
        const res = await lookupEntity(entity, { q: query, limit: perGroup });
        if (!res.items || res.items.length === 0) return null;

        const route = ENTITY_ROUTE[entity];
        const results: SearchResult[] = res.items.slice(0, perGroup).map((it) => ({
          id: it.id,
          primary: it.chip.primary,
          secondary: it.chip.secondary || it.chip.tertiary || undefined,
          avatarUrl: it.chip.avatarUrl,
          route: route(it.id),
        }));

        return {
          entityKind: entity,
          label: ENTITY_LABEL[entity],
          results,
        };
      } catch (err) {
        console.error(`[searchCrmEntities] ${entity} failed:`, err);
        return null;
      }
    }),
  );

  return groups.filter((g): g is SearchResultGroup => g !== null);
}

/**
 * Read-only export for the search page so it can render the input chip
 * row without re-deriving labels from the registry.
 */
export async function getEntityLabel(entity: EntityKey): Promise<string> {
  return ENTITY_LABEL[entity];
}
