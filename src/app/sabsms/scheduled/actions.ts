"use server";

/**
 * SabSMS scheduled sends — server actions.
 *
 * Page 15 of `plans/sabsms-pages-catalog.md` §B.2. Covers:
 *  • List + read of scheduled sends (loadScheduledSends)
 *  • Reschedule via drag (rescheduleSend) — drives optimistic UI
 *  • Cancel single (cancelScheduledSend)
 *  • Bulk reschedule by window (bulkRescheduleByWindow)
 *  • Save / clear cron-based recurring schedule (setRecurringCron)
 *  • iCal export (exportIcal returns text/calendar)
 *  • iCal subscribe URL (mintIcalSubscription returns a token)
 *  • Notification rules (saveNotificationRule)
 *  • Audit log per change (recordAudit + loadAuditLog)
 *
 * Pure helpers live in `./scheduling` so the unit tests can load them
 * without the Mongo runtime. We re-export the relevant ones below so
 * callers can keep importing from `./actions`.
 *
 * Stubs noted in report:
 *  • Holiday calendar is a static seed (`HOLIDAYS` in `./scheduling`).
 *  • Audit collection is best-effort (console.warn fallback).
 *  • Engine has no `rescheduleScheduledSend` endpoint yet; we mutate
 *    `sabsms_campaigns.scheduledAt` directly as a forward-compatible shim.
 */

import { randomUUID } from "node:crypto";

import { ObjectId } from "mongodb";

import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";
import { getSabsmsCollections } from "@/lib/sabsms/db/collections";

import { cancelCampaign } from "../campaigns/actions";

import {
  HOLIDAYS,
  buildCountryHourHeatmap,
  buildMonthGrid,
  computeSlotCapacity,
  describeCron,
  detectCrossCampaignConflicts,
  detectQuietHourConflicts,
  type ScheduledKind,
  type ScheduledSend,
} from "./scheduling";

export type { ScheduledKind, ScheduledSend } from "./scheduling";
export type { HolidayEntry, MonthCell } from "./scheduling";

/**
 * Pure helpers — re-exposed as async (server-action-safe) shims so the
 * page can import the whole surface from `./actions` while the tests
 * import the pure module directly.
 */
export async function describeCronAsync(cron: string): Promise<string> {
  return describeCron(cron);
}

export async function detectQuietHourConflictsAsync(
  sends: ScheduledSend[],
): Promise<Array<{ sendId: string; recipientHour: number }>> {
  return detectQuietHourConflicts(sends);
}

export async function detectCrossCampaignConflictsAsync(
  sends: ScheduledSend[],
): Promise<
  Array<{ a: string; b: string; sender: string; hourBucket: string }>
> {
  return detectCrossCampaignConflicts(sends);
}

export async function computeSlotCapacityAsync(
  sends: ScheduledSend[],
): Promise<Array<[string, number]>> {
  // Maps aren't transportable through the server-action boundary —
  // serialise to an entries-array.
  return Array.from(computeSlotCapacity(sends));
}

export async function buildMonthGridAsync(
  year: number,
  monthIndex: number,
  sends: ScheduledSend[],
) {
  // Map → serialisable cells. Date objects survive RSC serialisation
  // but we prefer ISO strings for client transport.
  return buildMonthGrid(year, monthIndex, sends).map((c) => ({
    iso: c.iso,
    inMonth: c.inMonth,
    sends: c.sends,
    holiday: c.holiday,
  }));
}

export async function buildCountryHourHeatmapAsync(
  sends: ScheduledSend[],
): Promise<Array<{ country: string; entries: Array<[number, number]> }>> {
  const map = buildCountryHourHeatmap(sends);
  return Array.from(map.entries()).map(([country, hours]) => ({
    country,
    entries: Array.from(hours.entries()),
  }));
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type ActionResult<T = {}> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

async function resolveWorkspace(): Promise<
  { ok: true; workspaceId: string } | { ok: false; error: string }
> {
  const session = await getCachedSession();
  const userId = (session?.user as { _id?: unknown } | undefined)?._id;
  if (!userId) return { ok: false, error: "unauthorized" };
  return { ok: true, workspaceId: String(userId) };
}

// Type predicates for the loose `Record<string, unknown>` Mongo shapes —
// keeps the cast surface tiny and named.
function dateField(
  v: unknown,
  fallback: () => Date = () => new Date(),
): Date {
  if (v instanceof Date) return v;
  if (typeof v === "string") {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return fallback();
}

// ─── Reads ────────────────────────────────────────────────────────────────

export async function loadScheduledSends(
  workspaceId: string,
  range: { from: Date; to: Date },
): Promise<ScheduledSend[]> {
  // We read from sabsms_campaigns (where scheduledAt is the canonical
  // "send at" timestamp) and merge in any rows from the ad-hoc
  // sabsms_scheduled_sends collection (used by drips + tests for
  // forward-compatible schedules).
  const { cols } = await getSabsmsCollections();
  const { db } = await connectToDatabase();

  const campaigns = await cols.campaigns
    .find({
      workspaceId,
      scheduledAt: { $gte: range.from, $lte: range.to },
      status: { $in: ["scheduled", "running"] as never },
    })
    .limit(500)
    .toArray();

  const extras = await db
    .collection<Record<string, unknown>>("sabsms_scheduled_sends")
    .find({
      workspaceId,
      sendAt: { $gte: range.from, $lte: range.to },
    })
    .limit(500)
    .toArray();

  const camp = campaigns.map<ScheduledSend>((c) => ({
    id: String(c._id),
    workspaceId,
    kind: "campaign",
    name: c.name ?? "Untitled campaign",
    sendAt: dateField(c.scheduledAt).toISOString(),
    templateId: c.templateId,
    campaignId: String(c._id),
    senderId: c.senderNumberIds?.[0] ?? "default",
    recipientCount: c.stats?.total ?? 0,
    status: c.status === "running" ? "queued" : "scheduled",
    createdAt: dateField(c.createdAt).toISOString(),
    updatedAt: dateField(c.updatedAt).toISOString(),
  }));

  const ex = extras.map<ScheduledSend>((d) => ({
    id: String(d._id ?? d.id ?? randomUUID()),
    workspaceId,
    kind: (d.kind as ScheduledKind) ?? "test",
    name: String(d.name ?? "Scheduled send"),
    sendAt: dateField(d.sendAt).toISOString(),
    templateId: d.templateId ? String(d.templateId) : undefined,
    campaignId: d.campaignId ? String(d.campaignId) : undefined,
    senderId: String(d.senderId ?? "default"),
    recipientCount:
      typeof d.recipientCount === "number" ? d.recipientCount : 0,
    status: (d.status as ScheduledSend["status"]) ?? "scheduled",
    recipientTz: d.recipientTz ? String(d.recipientTz) : undefined,
    country: d.country ? String(d.country) : undefined,
    cron: d.cron ? String(d.cron) : undefined,
    quietHours: (d.quietHours as ScheduledSend["quietHours"]) ?? undefined,
    notes: d.notes ? String(d.notes) : undefined,
    createdAt: dateField(d.createdAt).toISOString(),
    updatedAt: dateField(d.updatedAt).toISOString(),
  }));

  const merged = [...camp, ...ex];
  return merged.sort(
    (a, b) => new Date(a.sendAt).getTime() - new Date(b.sendAt).getTime(),
  );
}

export async function loadUnscheduledTray(
  workspaceId: string,
): Promise<ScheduledSend[]> {
  // The "unscheduled" tray lists drafts the user can drop onto the
  // calendar. We project sabsms_campaigns rows in `draft` state.
  const { cols } = await getSabsmsCollections();
  const drafts = await cols.campaigns
    .find({ workspaceId, status: "draft" as never })
    .sort({ updatedAt: -1 })
    .limit(50)
    .toArray();
  return drafts.map<ScheduledSend>((c) => ({
    id: String(c._id),
    workspaceId,
    kind: "campaign",
    name: c.name ?? "Untitled draft",
    sendAt: new Date(Date.now() + 24 * 3600_000).toISOString(),
    templateId: c.templateId,
    campaignId: String(c._id),
    senderId: c.senderNumberIds?.[0] ?? "default",
    recipientCount: c.stats?.total ?? 0,
    status: "scheduled",
    createdAt: dateField(c.createdAt).toISOString(),
    updatedAt: dateField(c.updatedAt).toISOString(),
  }));
}

// ─── Audit ────────────────────────────────────────────────────────────────

async function recordAudit(
  workspaceId: string,
  sendId: string,
  action: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  try {
    const { db } = await connectToDatabase();
    await db.collection("sabsms_scheduled_audit").insertOne({
      _id: randomUUID() as unknown as never,
      workspaceId,
      sendId,
      action,
      at: new Date(),
      meta,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[sabsms/scheduled] audit write failed for ${sendId}/${action}`,
      err,
    );
  }
}

export async function loadAuditLog(
  workspaceId: string,
  sendId: string,
): Promise<
  Array<{
    id: string;
    action: string;
    at: string;
    meta?: Record<string, unknown>;
  }>
> {
  try {
    const { db } = await connectToDatabase();
    const docs = await db
      .collection<Record<string, unknown>>("sabsms_scheduled_audit")
      .find({ workspaceId, sendId })
      .sort({ at: -1 })
      .limit(100)
      .toArray();
    return docs.map((d) => ({
      id: String(d._id ?? randomUUID()),
      action: String(d.action ?? "unknown"),
      at: d.at instanceof Date ? d.at.toISOString() : String(d.at ?? ""),
      meta: (d.meta as Record<string, unknown>) ?? undefined,
    }));
  } catch {
    return [];
  }
}

// ─── Writes ───────────────────────────────────────────────────────────────

/**
 * Campaign `_id`s are ObjectIds — the previous string-typed filter
 * (`_id: sendId as never`) could never match, so campaign rows silently
 * no-oped. Resolve to a real ObjectId when the id is valid.
 */
function campaignObjectId(sendId: string): ObjectId | null {
  return ObjectId.isValid(sendId) ? new ObjectId(sendId) : null;
}

export async function rescheduleSend(
  sendId: string,
  newSendAt: string,
): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  const when = new Date(newSendAt);
  if (Number.isNaN(when.getTime())) {
    return { ok: false, error: "Invalid timestamp." };
  }
  try {
    const { db } = await connectToDatabase();
    // Campaign rows first — only `scheduled` campaigns may move (a
    // running campaign's timing is owned by the engine ticker).
    const oid = campaignObjectId(sendId);
    let matchedCampaign = false;
    if (oid) {
      const camp = await db.collection("sabsms_campaigns").updateOne(
        {
          _id: oid as never,
          workspaceId: ws.workspaceId,
          status: "scheduled",
        },
        { $set: { scheduledAt: when, updatedAt: new Date() } },
      );
      matchedCampaign = camp.matchedCount > 0;
      if (!matchedCampaign) {
        const existing = await db.collection("sabsms_campaigns").findOne(
          { _id: oid as never, workspaceId: ws.workspaceId },
          { projection: { status: 1 } },
        );
        if (existing) {
          return {
            ok: false,
            error: `Campaign is ${String((existing as { status?: string }).status ?? "unknown")} — only scheduled campaigns can be rescheduled.`,
          };
        }
      }
    }
    if (!matchedCampaign) {
      await db.collection("sabsms_scheduled_sends").updateOne(
        { _id: sendId as unknown as never, workspaceId: ws.workspaceId },
        { $set: { sendAt: when, updatedAt: new Date() } },
        { upsert: false },
      );
    }
    await recordAudit(ws.workspaceId, sendId, "reschedule", {
      newSendAt: when.toISOString(),
    });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: (err as Error)?.message ?? "Failed to reschedule.",
    };
  }
}

export async function cancelScheduledSend(
  sendId: string,
): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  try {
    const { db } = await connectToDatabase();
    const oid = campaignObjectId(sendId);
    if (oid) {
      const campaign = await db.collection("sabsms_campaigns").findOne(
        { _id: oid as never, workspaceId: ws.workspaceId },
        { projection: { _id: 1 } },
      );
      if (campaign) {
        // Route campaign cancellation through the engine so remaining
        // pending/claimed recipients are cancelled too (V2.3).
        const res = await cancelCampaign({ campaignId: sendId });
        if (!res.ok) return res;
        await recordAudit(ws.workspaceId, sendId, "cancel");
        return { ok: true };
      }
    }
    await db.collection("sabsms_scheduled_sends").updateOne(
      { _id: sendId as unknown as never, workspaceId: ws.workspaceId },
      { $set: { status: "cancelled", updatedAt: new Date() } },
      { upsert: false },
    );
    await recordAudit(ws.workspaceId, sendId, "cancel");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: (err as Error)?.message ?? "Failed to cancel.",
    };
  }
}

export async function bulkRescheduleByWindow(
  sendIds: string[],
  shiftMinutes: number,
): Promise<ActionResult<{ updated: number }>> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (sendIds.length === 0) {
    return { ok: false, error: "No sends selected." };
  }
  let updated = 0;
  // We do a per-row reschedule for simplicity — the page passes ≤ 50
  // ids per call, so the round-trip overhead is fine.
  for (const id of sendIds) {
    try {
      const { db } = await connectToDatabase();
      const campOid = campaignObjectId(id);
      const camp = campOid
        ? await db
            .collection<Record<string, unknown>>("sabsms_campaigns")
            .findOne({
              _id: campOid as never,
              workspaceId: ws.workspaceId,
            })
        : null;
      const ex = camp
        ? null
        : await db
            .collection<Record<string, unknown>>("sabsms_scheduled_sends")
            .findOne({
              _id: id as unknown as never,
              workspaceId: ws.workspaceId,
            });
      const current = camp?.scheduledAt ?? ex?.sendAt;
      if (!(current instanceof Date)) continue;
      const next = new Date(current.getTime() + shiftMinutes * 60_000);
      const res = await rescheduleSend(id, next.toISOString());
      if (res.ok) updated += 1;
    } catch {
      // Skip the bad row, keep going.
    }
  }
  return { ok: true, updated };
}

export async function setRecurringCron(
  sendId: string,
  cron: string,
): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  // Cheap shape validation — 5 fields. Don't try to *evaluate* the cron
  // here; the engine does that. We only want to reject obviously-broken
  // input from the UI.
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) {
    return {
      ok: false,
      error: "Cron must be 5 space-separated fields (min hour dom mon dow).",
    };
  }
  try {
    const { db } = await connectToDatabase();
    await db.collection("sabsms_scheduled_sends").updateOne(
      { _id: sendId as unknown as never, workspaceId: ws.workspaceId },
      { $set: { cron, updatedAt: new Date() } },
      { upsert: false },
    );
    await recordAudit(ws.workspaceId, sendId, "setCron", { cron });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: (err as Error)?.message ?? "Failed to save cron.",
    };
  }
}

/**
 * Build an RFC-5545 iCalendar document for the workspace's scheduled
 * sends. The page wires this into `SabsmsExportMenu` so the browser
 * downloads it as `sabsms-schedule.ics`.
 */
export async function exportIcal(
  fromIso: string,
  toIso: string,
): Promise<ActionResult<{ ics: string; filename: string }>> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  const from = new Date(fromIso);
  const to = new Date(toIso);
  const sends = await loadScheduledSends(ws.workspaceId, { from, to });
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SabSMS//Scheduled//EN",
    "CALSCALE:GREGORIAN",
  ];
  for (const s of sends) {
    const dt = new Date(s.sendAt);
    const stamp = toIcsDate(dt);
    const end = toIcsDate(new Date(dt.getTime() + 15 * 60_000));
    lines.push(
      "BEGIN:VEVENT",
      `UID:${s.id}@sabsms`,
      `DTSTAMP:${toIcsDate(new Date())}`,
      `DTSTART:${stamp}`,
      `DTEND:${end}`,
      `SUMMARY:${escapeIcs(s.name)}`,
      `DESCRIPTION:${escapeIcs(
        `${s.recipientCount} recipients · sender ${s.senderId}`,
      )}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return {
    ok: true,
    ics: lines.join("\r\n"),
    filename: `sabsms-schedule-${fromIso.slice(0, 10)}.ics`,
  };
}

function toIcsDate(d: Date): string {
  // YYYYMMDDTHHMMSSZ
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function escapeIcs(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    .replace(/\n/g, "\\n");
}

/**
 * Mint a read-only iCal subscription token. The companion route at
 * `/sabsms/scheduled/ical/[token]/route.ts` resolves the token →
 * workspaceId and serves a live `text/calendar` feed of upcoming
 * scheduled sends, so a calendar app can subscribe to the URL.
 */
export async function mintIcalSubscription(): Promise<
  ActionResult<{ url: string; token: string }>
> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  try {
    const token = randomUUID().replace(/-/g, "");
    const { db } = await connectToDatabase();
    await db.collection("sabsms_scheduled_subscriptions").insertOne({
      _id: token as unknown as never,
      workspaceId: ws.workspaceId,
      createdAt: new Date(),
    });
    return {
      ok: true,
      token,
      url: `/sabsms/scheduled/ical/${token}.ics`,
    };
  } catch (err) {
    return {
      ok: false,
      error: (err as Error)?.message ?? "Failed to mint token.",
    };
  }
}

export interface NotificationRuleInput {
  /** ms before the send to alert. */
  leadTimeMs: number;
  channel: "email" | "in_app";
}

export async function saveNotificationRule(
  sendId: string,
  rule: NotificationRuleInput,
): Promise<ActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!Number.isFinite(rule.leadTimeMs) || rule.leadTimeMs < 0) {
    return { ok: false, error: "Lead time must be a non-negative number." };
  }
  try {
    const { db } = await connectToDatabase();
    await db.collection("sabsms_notification_rules").insertOne({
      _id: randomUUID() as unknown as never,
      workspaceId: ws.workspaceId,
      sendId,
      leadTimeMs: rule.leadTimeMs,
      channel: rule.channel,
      createdAt: new Date(),
    });
    await recordAudit(ws.workspaceId, sendId, "notificationRule", { rule });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: (err as Error)?.message ?? "Failed to save rule.",
    };
  }
}

// Re-export the holiday list as an async getter so the page can pull
// it from the `./actions` surface alongside everything else.
export async function getHolidayCalendar() {
  return HOLIDAYS;
}
