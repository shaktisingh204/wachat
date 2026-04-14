import type { ObjectId } from 'mongodb';

/**
 * Worksuite Universal Search — MongoDB type definitions ported from
 * Laravel's `universal_searches` table. Each row is a lightweight
 * denormalized index of a searchable resource across the CRM.
 *
 * All docs are tenant-scoped via `userId`. Collection:
 * `crm_universal_search_index`.
 */

export type WsSearchableType =
  | 'contact'
  | 'account'
  | 'deal'
  | 'lead'
  | 'task'
  | 'project'
  | 'invoice'
  | 'ticket'
  | 'contract'
  | 'kb'
  | 'note'
  | 'client'
  | 'proposal'
  | 'estimate';

export const WS_SEARCHABLE_TYPES: WsSearchableType[] = [
  'contact',
  'account',
  'deal',
  'lead',
  'task',
  'project',
  'invoice',
  'ticket',
  'contract',
  'kb',
  'note',
  'client',
  'proposal',
  'estimate',
];

export interface WsUniversalSearchIndex {
  _id?: ObjectId | string;
  userId: ObjectId | string;
  searchable_type: WsSearchableType;
  /** The `_id` of the source resource, always stored as a string for
   *  portability when the source is either an ObjectId or a UUID. */
  searchable_id: string;
  title: string;
  description?: string;
  keywords?: string[];
  url?: string;
  icon?: string;
  indexed_at?: Date | string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface WsSearchFilters {
  types?: WsSearchableType[];
  limitPerType?: number;
}

export interface WsSearchGroup {
  type: WsSearchableType;
  label: string;
  items: WsUniversalSearchIndex[];
}

export const WS_TYPE_LABELS: Record<WsSearchableType, string> = {
  contact: 'Contacts',
  account: 'Accounts',
  deal: 'Deals',
  lead: 'Leads',
  task: 'Tasks',
  project: 'Projects',
  invoice: 'Invoices',
  ticket: 'Tickets',
  contract: 'Contracts',
  kb: 'Knowledge Base',
  note: 'Notes',
  client: 'Clients',
  proposal: 'Proposals',
  estimate: 'Estimates',
};

/** Default resource-link builder for a search hit — matches the
 *  existing CRM dashboard routes where possible. */
export function defaultSearchUrl(type: WsSearchableType, id: string): string {
  switch (type) {
    case 'contact':
      return `/dashboard/crm/contacts/${id}`;
    case 'account':
      return `/dashboard/crm/accounts/${id}`;
    case 'deal':
      return `/dashboard/crm/deals/${id}`;
    case 'lead':
      return `/dashboard/crm/sales-crm/all-leads`;
    case 'task':
      return `/dashboard/crm/tasks`;
    case 'project':
      return `/dashboard/crm/projects/${id}`;
    case 'invoice':
      return `/dashboard/crm/sales/invoices`;
    case 'ticket':
      return `/dashboard/crm/tickets`;
    case 'contract':
      return `/dashboard/crm/contracts/${id}`;
    case 'kb':
      return `/dashboard/crm/workspace/knowledge-base/${id}`;
    case 'note':
      return `/dashboard/crm/sales-crm/notes`;
    case 'client':
      return `/dashboard/crm/sales/clients`;
    case 'proposal':
      return `/dashboard/crm/sales/proposals/${id}`;
    case 'estimate':
      return `/dashboard/crm/sales/estimate-requests`;
    default:
      return '/dashboard/crm';
  }
}
