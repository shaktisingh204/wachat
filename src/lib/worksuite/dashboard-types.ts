import type { ObjectId } from 'mongodb';

/**
 * Worksuite Dashboard — types ported from Worksuite PHP/Laravel.
 *
 * Source models:
 *   - DashboardWidget            → WsDashboardWidget
 *   - UserTaskboardSetting       → WsUserTaskboardSetting
 *   - UserLeadboardSetting       → WsUserLeadboardSetting
 *   - Pinned                     → WsPinnedItem
 *
 * Multi-tenant: each record carries `userId` (tenant/workspace scope)
 * plus a separate `user_id` (the viewer/pinner) where the original
 * Laravel schema used only `user_id + company_id`. Keeping both lets
 * us enforce tenant isolation via `@/lib/hr-crud` while still allowing
 * per-user preferences inside a tenant.
 */

/* ─────────────────────────────────────────────────────────────────
 * Shared base
 * ──────────────────────────────────────────────────────────────── */

export interface WsDashboardBase {
  _id?: ObjectId | string;
  /** Tenant / workspace owner. Matches Worksuite `company_id`. */
  userId: ObjectId | string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

/* ─────────────────────────────────────────────────────────────────
 * Dashboard Widgets
 *
 * Generalised from Worksuite's flat `dashboard_widgets` table which
 * only stored `widget_name + status + dashboard_type`. We keep the
 * same identity concept (widget_name) but add per-user layout so
 * users can build bespoke dashboards.
 * ──────────────────────────────────────────────────────────────── */

export type WsDashboardWidgetType =
  | 'stats'
  | 'chart'
  | 'list'
  | 'calendar'
  | 'custom';

export interface WsDashboardWidgetConfig {
  /** Data source key the client renderer uses (e.g. 'deals.recent'). */
  data_source?: string;
  /** Optional filter DSL passed to the data source. */
  filter?: Record<string, unknown>;
  /** Display options (e.g. show legend, color, compact). */
  display_options?: Record<string, unknown>;
}

export interface WsDashboardWidget extends WsDashboardBase {
  /** The viewer this widget belongs to. */
  user_id: ObjectId | string;
  /** Stable identifier of the widget (slug-like). */
  widget_name: string;
  /** Presentation kind. */
  type: WsDashboardWidgetType;
  /** Ordering within the user's dashboard grid (asc). */
  position: number;
  /** Column span on a 12-col grid (1..12). */
  width: number;
  /** Soft-hide without deleting. */
  is_visible: boolean;
  /** Free-form config object. */
  config?: WsDashboardWidgetConfig;
}

/* ─────────────────────────────────────────────────────────────────
 * User Taskboard Settings
 * ──────────────────────────────────────────────────────────────── */

export type WsTaskboardGroupBy =
  | 'none'
  | 'assignee'
  | 'priority'
  | 'label';

export type WsTaskboardSortBy =
  | 'due_date'
  | 'priority'
  | 'created';

export interface WsUserTaskboardSetting extends WsDashboardBase {
  /** The viewer these preferences apply to. */
  user_id: ObjectId | string;
  /** Optional scope — null / omitted means "global default". */
  project_id?: ObjectId | string | null;
  hide_done: boolean;
  group_by: WsTaskboardGroupBy;
  sort_by: WsTaskboardSortBy;
  /** Column keys the user wants visible on the board. */
  visible_columns: string[];
}

/* ─────────────────────────────────────────────────────────────────
 * User Leadboard Settings
 * ──────────────────────────────────────────────────────────────── */

export type WsLeadboardSortBy =
  | 'value'
  | 'stage'
  | 'created'
  | 'owner';

export interface WsUserLeadboardSetting extends WsDashboardBase {
  user_id: ObjectId | string;
  pipeline_id: ObjectId | string;
  /** Stage ids/keys the viewer wants hidden from their board. */
  hide_stages: string[];
  sort_by: WsLeadboardSortBy;
  visible_columns: string[];
}

/* ─────────────────────────────────────────────────────────────────
 * Pinned Items
 *
 * Generalised from Worksuite's `pinned` table (project_id / task_id
 * only) to a polymorphic resource shape that works for every CRM
 * module.
 * ──────────────────────────────────────────────────────────────── */

export type WsPinnedResourceType =
  | 'project'
  | 'task'
  | 'lead'
  | 'deal'
  | 'ticket'
  | 'kb'
  | 'note';

export interface WsPinnedItem extends WsDashboardBase {
  /** The user who pinned the item. */
  user_id: ObjectId | string;
  resource_type: WsPinnedResourceType;
  resource_id: ObjectId | string;
  pinned_at: Date | string;
  /** Denormalised display title captured at pin time. */
  title?: string;
}
