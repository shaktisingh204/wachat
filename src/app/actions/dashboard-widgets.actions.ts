'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { getErrorMessage } from '@/lib/utils';
import {
  AVAILABLE_WIDGETS,
  type DashboardType,
  type WidgetKey,
  type WidgetPref,
} from './dashboard-widgets.config';

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
