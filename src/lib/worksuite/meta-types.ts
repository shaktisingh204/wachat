import type { ObjectId } from 'mongodb';

/**
 * Worksuite Meta — misc modules ported from Worksuite PHP/Laravel:
 * custom fields/groups, custom links, taxes, unit types, expense
 * categories (extended), flags, saved searches, and universal search
 * skeleton. Also re-exports Issue / Taskboard / Promotion types that
 * live in sibling files so all "meta" UI can import from one place.
 *
 * Multi-tenant: every entity carries a `userId` ObjectId (or string on
 * the wire) which scopes reads via `@/lib/hr-crud`.
 */

export interface WsMetaBase {
  _id?: ObjectId | string;
  userId: ObjectId | string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Custom Fields
 *  Source: Worksuite models `CustomFieldGroup`, `CustomField`, and
 *          the polymorphic `custom_field_data` table.
 * ══════════════════════════════════════════════════════════════════ */

/**
 * Entity / module a custom field group belongs to. These mirror the
 * `custom_field_groups.name` enum used by Worksuite.
 */
export type WsCustomFieldBelongsTo =
  | 'contact'
  | 'account'
  | 'client'
  | 'deal'
  | 'lead'
  | 'task'
  | 'project'
  | 'employee'
  | 'invoice'
  | 'estimate'
  | 'ticket'
  | 'product'
  | 'vendor'
  | 'expense';

export interface WsCustomFieldGroup extends WsMetaBase {
  /** Human label shown in settings / entity edit dialogs. */
  name: string;
  /** Target entity these fields attach to. */
  belongs_to: WsCustomFieldBelongsTo;
}

export type WsCustomFieldType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'number'
  | 'date'
  | 'checkbox'
  | 'radio'
  | 'email'
  | 'url';

export interface WsCustomField extends WsMetaBase {
  group_id: ObjectId | string;
  /** Target entity (denormalised from group for simpler queries). */
  belongs_to?: WsCustomFieldBelongsTo;
  /** User-facing label. */
  label: string;
  /** Programmatic slug used as the key in the value document. */
  name: string;
  type: WsCustomFieldType;
  /** Options for `select` / `radio` / `checkbox`. */
  values?: string[];
  is_required?: boolean;
  /** Whether the field should appear in listing/table views. */
  display_in_table?: boolean;
  /** Sort order within the group. */
  position?: number;
}

/**
 * Stored values for a custom field set, keyed by the slug in
 * `WsCustomField.name`. Each record ties an entity to its values.
 */
export interface WsCustomFieldValue extends WsMetaBase {
  entity_type: WsCustomFieldBelongsTo;
  entity_id: ObjectId | string;
  /** `{ fieldSlug: value }` — `value` may be string, number, bool, or array. */
  values: Record<string, unknown>;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Custom Link Settings
 *  Source: Worksuite model `CustomLinkSetting`.
 * ══════════════════════════════════════════════════════════════════ */

export interface WsCustomLinkSetting extends WsMetaBase {
  link_name: string;
  url: string;
  open_in_new_tab?: boolean;
  position?: number;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Tax
 *  Source: Worksuite model `Tax`.
 * ══════════════════════════════════════════════════════════════════ */

export interface WsTax extends WsMetaBase {
  tax_name: string;
  rate_percent: number;
  is_default?: boolean;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Unit Type
 *  Source: Worksuite model `UnitType`.
 * ══════════════════════════════════════════════════════════════════ */

export interface WsUnitType extends WsMetaBase {
  unit_name: string;
  short_name?: string;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Promotion (extended — lightweight variant distinct from the
 *  storefront `WsPromotion` in billing-types).
 * ══════════════════════════════════════════════════════════════════ */

export type WsPromotionExtType = 'percent' | 'fixed';
export type WsPromotionExtStatus = 'active' | 'inactive';

export interface WsPromotionExt extends WsMetaBase {
  name: string;
  code: string;
  type: WsPromotionExtType;
  value: number;
  start_date?: Date | string;
  end_date?: Date | string;
  usage_limit?: number;
  status: WsPromotionExtStatus;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Issue (meta-facing shape used by the standalone issue tracker).
 *  The canonical type is `WsIssue` in project-types.ts which is
 *  re-exported below to keep imports centralised.
 * ══════════════════════════════════════════════════════════════════ */

export type { WsIssue, WsIssueStatus, WsIssuePriority } from './project-types';

/* ═══════════════════════════════════════════════════════════════════
 *  Taskboard columns — re-export from project-types.
 * ══════════════════════════════════════════════════════════════════ */

export type { WsTaskboardColumn } from './project-types';

/* ═══════════════════════════════════════════════════════════════════
 *  Expense Categories (extended — not the accounting category).
 *  Source: Worksuite model `ExpensesCategory`.
 * ══════════════════════════════════════════════════════════════════ */

export interface WsExpenseCategoryExt extends WsMetaBase {
  category_name: string;
  description?: string;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Flags — resource flagging (reports / issues / users / contacts).
 *  Source: Worksuite model `Flag`.
 * ══════════════════════════════════════════════════════════════════ */

export interface WsFlag extends WsMetaBase {
  /** Module / entity kind the flag applies to. */
  resource_type: string;
  resource_id: ObjectId | string;
  reason?: string;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Universal Search — saved/recent queries.
 *  Source: Worksuite model `UniversalSearch`.
 * ══════════════════════════════════════════════════════════════════ */

export interface WsSavedSearch extends WsMetaBase {
  search_term: string;
  /** Module searched, e.g. "contacts", "deals", "tasks". */
  module: string;
  result_count?: number;
  last_used_at?: Date | string;
}
