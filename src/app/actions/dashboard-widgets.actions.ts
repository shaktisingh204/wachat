'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { getErrorMessage } from '@/lib/utils';

/**
 * Per-user dashboard widget preferences.
 *
 * Collection: `dashboard_widgets`
 *   { userId, dashboardType, widgetKey, enabled, position }
 *
 * Pure config — does NOT render widgets. The dashboard pages read
 * `getMyWidgets(type)` and decide what to render. Default order/state
 * is materialized on first access from `AVAILABLE_WIDGETS`.
 */

export type DashboardType =
  | 'overview'
  | 'project'
  | 'client'
  | 'hr'
  | 'ticket'
  | 'finance';

export type WidgetKey =
  | 'project-status-counts'
  | 'today-tasks'
  | 'open-tickets'
  | 'active-timer'
  | 'week-timelog'
  | 'pending-leaves'
  | 'upcoming-birthdays'
  | 'latest-discussions'
  | 'recent-notices'
  | 'upcoming-events'
  | 'top-projects'
  | 'revenue-mtd'
  | 'expense-mtd'
  | 'pending-invoices'
  | 'new-leads'
  | 'won-deals'
  | 'upcoming-followups'
  | 'activity-feed'
  | 'calendar'
  | 'sticky-notes'
  | 'my-team';

export const AVAILABLE_WIDGETS: Array<{
  key: WidgetKey;
  label: string;
  description: string;
  defaultDashboards: DashboardType[];
}> = [
  { key: 'project-status-counts', label: 'Project status counts', description: 'In-progress / on-hold / completed', defaultDashboards: ['overview', 'project'] },
  { key: 'today-tasks', label: "Today's tasks", description: 'Your tasks due today', defaultDashboards: ['overview', 'project'] },
  { key: 'open-tickets', label: 'Open tickets', description: 'Tickets assigned to you', defaultDashboards: ['overview', 'ticket'] },
  { key: 'active-timer', label: 'Active timer', description: 'Currently running time entry', defaultDashboards: ['overview'] },
  { key: 'week-timelog', label: 'This week’s time log', description: 'Hours logged across projects', defaultDashboards: ['overview', 'hr'] },
  { key: 'pending-leaves', label: 'Pending leaves', description: 'Leave requests to approve', defaultDashboards: ['hr'] },
  { key: 'upcoming-birthdays', label: 'Upcoming birthdays', description: 'Team birthdays this month', defaultDashboards: ['hr'] },
  { key: 'latest-discussions', label: 'Latest discussions', description: 'Project discussion activity', defaultDashboards: ['overview', 'project'] },
  { key: 'recent-notices', label: 'Recent notices', description: 'Company notices', defaultDashboards: ['hr'] },
  { key: 'upcoming-events', label: 'Upcoming events', description: 'Calendar events this week', defaultDashboards: ['overview'] },
  { key: 'top-projects', label: 'Top projects', description: 'Most active projects', defaultDashboards: ['project'] },
  { key: 'revenue-mtd', label: 'Revenue (MTD)', description: 'Month-to-date revenue', defaultDashboards: ['finance', 'overview'] },
  { key: 'expense-mtd', label: 'Expense (MTD)', description: 'Month-to-date expenses', defaultDashboards: ['finance'] },
  { key: 'pending-invoices', label: 'Pending invoices', description: 'Unpaid invoice count', defaultDashboards: ['finance', 'client'] },
  { key: 'new-leads', label: 'New leads', description: 'Leads added this week', defaultDashboards: ['overview'] },
  { key: 'won-deals', label: 'Won deals', description: 'Deals closed-won', defaultDashboards: ['overview', 'finance'] },
  { key: 'upcoming-followups', label: 'Upcoming follow-ups', description: 'Scheduled follow-up reminders', defaultDashboards: ['overview'] },
  { key: 'activity-feed', label: 'Activity feed', description: 'Recent activity across the CRM', defaultDashboards: ['overview'] },
  { key: 'calendar', label: 'Calendar', description: 'Inline calendar widget', defaultDashboards: ['overview'] },
  { key: 'sticky-notes', label: 'Sticky notes', description: 'Personal quick notes', defaultDashboards: ['overview'] },
  { key: 'my-team', label: 'My team', description: 'Direct reports + their open work', defaultDashboards: ['overview', 'hr'] },
];

export type WidgetPref = {
  widgetKey: WidgetKey;
  label: string;
  description: string;
  enabled: boolean;
  position: number;
};

async function requireUser() {
  const session = await getSession();
  if (!session?.user?._id) throw new Error('Not authenticated.');
  return new ObjectId(String(session.user._id));
}

function defaultsFor(dashboardType: DashboardType): WidgetPref[] {
  return AVAILABLE_WIDGETS.filter((w) => w.defaultDashboards.includes(dashboardType)).map(
    (w, i) => ({
      widgetKey: w.key,
      label: w.label,
      description: w.description,
      enabled: true,
      position: i,
    }),
  );
}

export async function getMyWidgets(dashboardType: DashboardType): Promise<WidgetPref[]> {
  try {
    const userId = await requireUser();
    const { db } = await connectToDatabase();
    const rows = await db
      .collection('dashboard_widgets')
      .find({ userId, dashboardType })
      .sort({ position: 1 })
      .toArray();

    const labelByKey = new Map(AVAILABLE_WIDGETS.map((w) => [w.key, w]));
    const seen = new Set<string>();

    const prefs: WidgetPref[] = rows
      .map((r, idx) => {
        const key = String(r.widgetKey) as WidgetKey;
        const meta = labelByKey.get(key);
        if (!meta) return null;
        seen.add(key);
        return {
          widgetKey: key,
          label: meta.label,
          description: meta.description,
          enabled: Boolean(r.enabled),
          position: typeof r.position === 'number' ? (r.position as number) : idx,
        };
      })
      .filter((x): x is WidgetPref => x !== null);

    // Backfill widgets that didn't exist yet for this user (new defaults).
    for (const w of AVAILABLE_WIDGETS) {
      if (seen.has(w.key)) continue;
      if (!w.defaultDashboards.includes(dashboardType)) continue;
      prefs.push({
        widgetKey: w.key,
        label: w.label,
        description: w.description,
        enabled: true,
        position: prefs.length,
      });
    }

    // If nothing stored yet, seed with defaults (in-memory only — the DB
    // row is written on first toggle/reorder).
    if (prefs.length === 0) return defaultsFor(dashboardType);

    return prefs.sort((a, b) => a.position - b.position);
  } catch {
    return defaultsFor(dashboardType);
  }
}

export async function toggleWidget(
  dashboardType: DashboardType,
  widgetKey: WidgetKey,
  enabled: boolean,
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const userId = await requireUser();
    const { db } = await connectToDatabase();
    await db.collection('dashboard_widgets').updateOne(
      { userId, dashboardType, widgetKey },
      {
        $set: {
          userId,
          dashboardType,
          widgetKey,
          enabled,
          updatedAt: new Date(),
        },
        $setOnInsert: { position: 999, createdAt: new Date() },
      },
      { upsert: true },
    );
    revalidatePath('/dashboard/crm');
    return { ok: true };
  } catch (e: unknown) {
    return { error: getErrorMessage(e) };
  }
}

export async function reorderWidgets(
  dashboardType: DashboardType,
  orderedKeys: WidgetKey[],
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const userId = await requireUser();
    if (!Array.isArray(orderedKeys) || orderedKeys.length === 0) {
      return { error: 'No widget order provided.' };
    }
    const { db } = await connectToDatabase();
    const ops = orderedKeys.map((widgetKey, position) => ({
      updateOne: {
        filter: { userId, dashboardType, widgetKey },
        update: {
          $set: { position, updatedAt: new Date() },
          $setOnInsert: {
            userId,
            dashboardType,
            widgetKey,
            enabled: true,
            createdAt: new Date(),
          },
        },
        upsert: true,
      },
    }));
    await db.collection('dashboard_widgets').bulkWrite(ops);
    revalidatePath('/dashboard/crm');
    return { ok: true };
  } catch (e: unknown) {
    return { error: getErrorMessage(e) };
  }
}
