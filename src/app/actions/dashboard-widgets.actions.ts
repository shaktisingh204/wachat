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

/* ─────────────────────────────────────────────────────────────────
 *  Widget data aggregator — one tenant-scoped roll-up that powers
 *  every default registry widget. Returns zero-shaped fallbacks on
 *  any per-collection failure so the dashboard never throws.
 * ──────────────────────────────────────────────────────────────── */

export interface DashboardWidgetItem {
  _id: string;
  title: string;
  subtitle?: string;
  meta?: string;
}

export interface DashboardWidgetsData {
  projectStatus: { inProgress: number; onHold: number; completed: number };
  todayTasks: { count: number; items: DashboardWidgetItem[] };
  openTickets: { count: number; items: DashboardWidgetItem[] };
  activeTimer: { running: boolean; title?: string; startedAt?: string };
  weekTimelog: { hours: number; entries: number };
  pendingLeaves: { count: number; items: DashboardWidgetItem[] };
  upcomingBirthdays: { items: DashboardWidgetItem[] };
  latestDiscussions: { items: DashboardWidgetItem[] };
  recentNotices: { items: DashboardWidgetItem[] };
  upcomingEvents: { items: DashboardWidgetItem[] };
  topProjects: { items: DashboardWidgetItem[] };
  revenueMtd: { amount: number; currency: string };
  expenseMtd: { amount: number; currency: string };
  pendingInvoices: { count: number; amount: number; currency: string };
  newLeads: { count: number; items: DashboardWidgetItem[] };
  wonDeals: { count: number; amount: number; currency: string };
  upcomingFollowups: { count: number; items: DashboardWidgetItem[] };
  activityFeed: { items: DashboardWidgetItem[] };
  stickyNotes: { items: DashboardWidgetItem[] };
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfToday(): Date {
  const d = startOfToday();
  d.setDate(d.getDate() + 1);
  return d;
}
function startOfWeek(): Date {
  const d = startOfToday();
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? 6 : day - 1; // ISO week (Mon start)
  d.setDate(d.getDate() - diff);
  return d;
}
function startOfMonth(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d;
}

const EMPTY_WIDGETS_DATA: DashboardWidgetsData = {
  projectStatus: { inProgress: 0, onHold: 0, completed: 0 },
  todayTasks: { count: 0, items: [] },
  openTickets: { count: 0, items: [] },
  activeTimer: { running: false },
  weekTimelog: { hours: 0, entries: 0 },
  pendingLeaves: { count: 0, items: [] },
  upcomingBirthdays: { items: [] },
  latestDiscussions: { items: [] },
  recentNotices: { items: [] },
  upcomingEvents: { items: [] },
  topProjects: { items: [] },
  revenueMtd: { amount: 0, currency: 'USD' },
  expenseMtd: { amount: 0, currency: 'USD' },
  pendingInvoices: { count: 0, amount: 0, currency: 'USD' },
  newLeads: { count: 0, items: [] },
  wonDeals: { count: 0, amount: 0, currency: 'USD' },
  upcomingFollowups: { count: 0, items: [] },
  activityFeed: { items: [] },
  stickyNotes: { items: [] },
};

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

export async function getDashboardWidgetsData(): Promise<DashboardWidgetsData> {
  let userId: ObjectId;
  let currency = 'USD';
  try {
    const session = await getSession();
    if (!session?.user?._id) return EMPTY_WIDGETS_DATA;
    userId = new ObjectId(String(session.user._id));
    currency = session.user.plan?.currency || 'USD';
  } catch {
    return EMPTY_WIDGETS_DATA;
  }

  const { db } = await connectToDatabase();
  const today = startOfToday();
  const tomorrow = endOfToday();
  const weekStart = startOfWeek();
  const monthStart = startOfMonth();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const next30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const projectStatusAgg = safe(
    db
      .collection('crm_projects')
      .aggregate([
        { $match: { userId } },
        { $group: { _id: '$status', n: { $sum: 1 } } },
      ])
      .toArray(),
    [] as Array<{ _id?: string; n: number }>,
  );

  const todayTasksDocs = safe(
    db
      .collection('crm_tasks')
      .find({
        userId,
        status: { $ne: 'Completed' },
        dueDate: { $gte: today, $lt: tomorrow },
      })
      .sort({ dueDate: 1 })
      .limit(5)
      .toArray(),
    [] as any[],
  );
  const todayTasksCount = safe(
    db.collection('crm_tasks').countDocuments({
      userId,
      status: { $ne: 'Completed' },
      dueDate: { $gte: today, $lt: tomorrow },
    }),
    0,
  );

  const openTicketDocs = safe(
    db
      .collection('crm_tickets')
      .find({ userId, status: { $nin: ['Closed', 'Resolved'] } })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray(),
    [] as any[],
  );
  const openTicketCount = safe(
    db
      .collection('crm_tickets')
      .countDocuments({ userId, status: { $nin: ['Closed', 'Resolved'] } }),
    0,
  );

  const activeTimerDoc = safe(
    db.collection('crm_time_logs').findOne({
      userId,
      $or: [{ endedAt: null }, { endedAt: { $exists: false } }],
    }),
    null as any,
  );

  const weekTimelogAgg = safe(
    db
      .collection('crm_time_logs')
      .aggregate([
        { $match: { userId, startedAt: { $gte: weekStart } } },
        {
          $group: {
            _id: null,
            minutes: { $sum: { $ifNull: ['$durationMinutes', 0] } },
            entries: { $sum: 1 },
          },
        },
      ])
      .toArray(),
    [] as Array<{ minutes: number; entries: number }>,
  );

  const pendingLeavesDocs = safe(
    db
      .collection('crm_leave_requests')
      .find({ userId, status: 'Pending' })
      .sort({ startDate: 1 })
      .limit(5)
      .toArray(),
    [] as any[],
  );
  const pendingLeavesCount = safe(
    db.collection('crm_leave_requests').countDocuments({ userId, status: 'Pending' }),
    0,
  );

  const upcomingBirthdayDocs = safe(
    db
      .collection('crm_employees')
      .find({ userId, date_of_birth: { $exists: true, $ne: null } })
      .project({ first_name: 1, last_name: 1, name: 1, date_of_birth: 1 })
      .limit(50)
      .toArray(),
    [] as any[],
  );

  const upcomingEventsDocs = safe(
    db
      .collection('crm_events')
      .find({
        userId,
        startDate: { $gte: today, $lte: next30Days },
      })
      .sort({ startDate: 1 })
      .limit(5)
      .toArray(),
    [] as any[],
  );

  const topProjectsDocs = safe(
    db
      .collection('crm_projects')
      .find({ userId })
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(5)
      .toArray(),
    [] as any[],
  );

  const revenueAgg = safe(
    db
      .collection('crm_invoices')
      .aggregate([
        {
          $match: {
            userId,
            status: 'Paid',
            $or: [
              { paidAt: { $gte: monthStart } },
              { issueDate: { $gte: monthStart } },
              { invoiceDate: { $gte: monthStart } },
            ],
          },
        },
        {
          $group: {
            _id: null,
            amount: { $sum: { $ifNull: ['$total', '$amount'] } },
          },
        },
      ])
      .toArray(),
    [] as Array<{ amount: number }>,
  );

  const expenseAgg = safe(
    db
      .collection('crm_expenses')
      .aggregate([
        {
          $match: {
            userId,
            $or: [
              { date: { $gte: monthStart } },
              { expenseDate: { $gte: monthStart } },
              { createdAt: { $gte: monthStart } },
            ],
          },
        },
        {
          $group: {
            _id: null,
            amount: { $sum: { $ifNull: ['$amount', '$total'] } },
          },
        },
      ])
      .toArray(),
    [] as Array<{ amount: number }>,
  );

  const pendingInvAgg = safe(
    db
      .collection('crm_invoices')
      .aggregate([
        { $match: { userId, status: { $in: ['Sent', 'Overdue', 'Draft'] } } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            amount: { $sum: { $ifNull: ['$total', '$amount'] } },
          },
        },
      ])
      .toArray(),
    [] as Array<{ count: number; amount: number }>,
  );

  const newLeadsDocs = safe(
    db
      .collection('crm_leads')
      .find({ userId, createdAt: { $gte: sevenDaysAgo } })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray(),
    [] as any[],
  );
  const newLeadsCount = safe(
    db
      .collection('crm_leads')
      .countDocuments({ userId, createdAt: { $gte: sevenDaysAgo } }),
    0,
  );

  const wonDealsAgg = safe(
    db
      .collection('crm_deals')
      .aggregate([
        { $match: { userId, stage: 'Won' } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            amount: { $sum: { $ifNull: ['$value', 0] } },
          },
        },
      ])
      .toArray(),
    [] as Array<{ count: number; amount: number }>,
  );

  const upcomingFollowupsDocs = safe(
    db
      .collection('crm_tasks')
      .find({
        userId,
        type: 'Follow-up',
        status: { $ne: 'Completed' },
        dueDate: { $gte: today },
      })
      .sort({ dueDate: 1 })
      .limit(5)
      .toArray(),
    [] as any[],
  );
  const upcomingFollowupsCount = safe(
    db.collection('crm_tasks').countDocuments({
      userId,
      type: 'Follow-up',
      status: { $ne: 'Completed' },
      dueDate: { $gte: today },
    }),
    0,
  );

  const activityFeedDocs = safe(
    db
      .collection('crm_audit_log')
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray(),
    [] as any[],
  );

  const stickyNotesDocs = safe(
    db
      .collection('crm_notes')
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray(),
    [] as any[],
  );

  const noticesDocs = safe(
    db
      .collection('crm_renewal_notices')
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray(),
    [] as any[],
  );

  const [
    psAgg,
    tdTasks,
    tdCount,
    otTickets,
    otCount,
    timerDoc,
    weekAgg,
    leaveDocs,
    leaveCount,
    bdayDocs,
    eventDocs,
    projectDocs,
    revAgg,
    expAgg,
    invAgg,
    leadDocs,
    leadCount,
    wonAgg,
    followDocs,
    followCount,
    activityDocs,
    notesDocs,
    noticeDocs,
  ] = await Promise.all([
    projectStatusAgg,
    todayTasksDocs,
    todayTasksCount,
    openTicketDocs,
    openTicketCount,
    activeTimerDoc,
    weekTimelogAgg,
    pendingLeavesDocs,
    pendingLeavesCount,
    upcomingBirthdayDocs,
    upcomingEventsDocs,
    topProjectsDocs,
    revenueAgg,
    expenseAgg,
    pendingInvAgg,
    newLeadsDocs,
    newLeadsCount,
    wonDealsAgg,
    upcomingFollowupsDocs,
    upcomingFollowupsCount,
    activityFeedDocs,
    stickyNotesDocs,
    noticesDocs,
  ]);

  // Project status buckets.
  const projectStatus = { inProgress: 0, onHold: 0, completed: 0 };
  for (const row of psAgg) {
    const s = String(row._id || '').toLowerCase();
    if (s.includes('progress')) projectStatus.inProgress += row.n;
    else if (s.includes('hold')) projectStatus.onHold += row.n;
    else if (s.includes('complete') || s.includes('done'))
      projectStatus.completed += row.n;
  }

  // Birthday filtering — keep only the next 30 days by month/day.
  const todayMd = today.getMonth() * 100 + today.getDate();
  const horizonMd = next30Days.getMonth() * 100 + next30Days.getDate();
  const wraps = horizonMd < todayMd;
  const upcomingBirthdayItems: DashboardWidgetItem[] = bdayDocs
    .map((e) => {
      const dob = e.date_of_birth ? new Date(e.date_of_birth) : null;
      if (!dob || Number.isNaN(dob.getTime())) return null;
      const md = dob.getMonth() * 100 + dob.getDate();
      const inRange = wraps
        ? md >= todayMd || md <= horizonMd
        : md >= todayMd && md <= horizonMd;
      if (!inRange) return null;
      const name =
        [e.first_name, e.last_name].filter(Boolean).join(' ').trim() ||
        e.name ||
        'Team member';
      return {
        _id: String(e._id),
        title: name,
        subtitle: dob.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        }),
        sortKey: md,
      };
    })
    .filter((x): x is DashboardWidgetItem & { sortKey: number } => x !== null)
    .sort((a, b) => a.sortKey - b.sortKey)
    .slice(0, 5)
    .map(({ sortKey: _s, ...rest }) => rest);

  const minutes = weekAgg[0]?.minutes ?? 0;
  const weekHours = Math.round((minutes / 60) * 10) / 10;

  return {
    projectStatus,
    todayTasks: {
      count: tdCount,
      items: tdTasks.map((t) => ({
        _id: String(t._id),
        title: String(t.title || 'Untitled task'),
        subtitle: t.priority ? String(t.priority) : undefined,
        meta: t.dueDate ? new Date(t.dueDate).toLocaleDateString() : undefined,
      })),
    },
    openTickets: {
      count: otCount,
      items: otTickets.map((t) => ({
        _id: String(t._id),
        title: String(t.subject || t.title || 'Ticket'),
        subtitle: t.status ? String(t.status) : undefined,
        meta: t.priority ? String(t.priority) : undefined,
      })),
    },
    activeTimer: timerDoc
      ? {
          running: true,
          title:
            String(
              timerDoc.title ||
                timerDoc.description ||
                timerDoc.taskTitle ||
                'Active timer',
            ),
          startedAt: timerDoc.startedAt
            ? new Date(timerDoc.startedAt).toISOString()
            : undefined,
        }
      : { running: false },
    weekTimelog: { hours: weekHours, entries: weekAgg[0]?.entries ?? 0 },
    pendingLeaves: {
      count: leaveCount,
      items: leaveDocs.map((l) => ({
        _id: String(l._id),
        title: String(l.leaveType || 'Leave request'),
        subtitle: l.reason ? String(l.reason).slice(0, 60) : undefined,
        meta: l.startDate
          ? new Date(l.startDate).toLocaleDateString()
          : undefined,
      })),
    },
    upcomingBirthdays: { items: upcomingBirthdayItems },
    latestDiscussions: {
      items: activityDocs
        .filter((a) => /comment|discussion|reply|message/i.test(String(a.action || '')))
        .slice(0, 5)
        .map((a) => ({
          _id: String(a._id),
          title: String(a.action || 'Discussion'),
          subtitle: a.entity ? String(a.entity) : undefined,
          meta: a.createdAt
            ? new Date(a.createdAt).toLocaleDateString()
            : undefined,
        })),
    },
    recentNotices: {
      items: noticeDocs.map((n) => ({
        _id: String(n._id),
        title: String(n.title || n.subject || 'Notice'),
        subtitle: n.body ? String(n.body).slice(0, 60) : undefined,
        meta: n.createdAt
          ? new Date(n.createdAt).toLocaleDateString()
          : undefined,
      })),
    },
    upcomingEvents: {
      items: eventDocs.map((e) => ({
        _id: String(e._id),
        title: String(e.title || e.name || 'Event'),
        subtitle: e.location ? String(e.location) : undefined,
        meta: e.startDate
          ? new Date(e.startDate).toLocaleDateString()
          : undefined,
      })),
    },
    topProjects: {
      items: projectDocs.map((p) => ({
        _id: String(p._id),
        title: String(p.name || p.title || 'Project'),
        subtitle: p.status ? String(p.status) : undefined,
        meta: p.deadline
          ? `Due ${new Date(p.deadline).toLocaleDateString()}`
          : undefined,
      })),
    },
    revenueMtd: { amount: revAgg[0]?.amount ?? 0, currency },
    expenseMtd: { amount: expAgg[0]?.amount ?? 0, currency },
    pendingInvoices: {
      count: invAgg[0]?.count ?? 0,
      amount: invAgg[0]?.amount ?? 0,
      currency,
    },
    newLeads: {
      count: leadCount,
      items: leadDocs.map((l) => ({
        _id: String(l._id),
        title: String(l.name || l.fullName || l.email || 'Lead'),
        subtitle: l.source ? String(l.source) : undefined,
        meta: l.createdAt
          ? new Date(l.createdAt).toLocaleDateString()
          : undefined,
      })),
    },
    wonDeals: {
      count: wonAgg[0]?.count ?? 0,
      amount: wonAgg[0]?.amount ?? 0,
      currency,
    },
    upcomingFollowups: {
      count: followCount,
      items: followDocs.map((t) => ({
        _id: String(t._id),
        title: String(t.title || 'Follow-up'),
        subtitle: t.priority ? String(t.priority) : undefined,
        meta: t.dueDate
          ? new Date(t.dueDate).toLocaleDateString()
          : undefined,
      })),
    },
    activityFeed: {
      items: activityDocs.map((a) => ({
        _id: String(a._id),
        title: String(a.action || a.event || 'Activity'),
        subtitle: a.entity ? String(a.entity) : undefined,
        meta: a.createdAt
          ? new Date(a.createdAt).toLocaleDateString()
          : undefined,
      })),
    },
    stickyNotes: {
      items: notesDocs.map((n) => ({
        _id: String(n._id),
        title: String(n.title || n.content || 'Note').slice(0, 60),
        subtitle:
          n.title && n.content
            ? String(n.content).slice(0, 80)
            : undefined,
        meta: n.createdAt
          ? new Date(n.createdAt).toLocaleDateString()
          : undefined,
      })),
    },
  };
}
