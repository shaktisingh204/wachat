"use server";

import { randomUUID, createHash } from "node:crypto";

import { getCachedSession } from "@/lib/server-cache";
import { connectToDatabase } from "@/lib/mongodb";
import {
  sabsmsEngine,
  SabsmsEngineError,
} from "@/lib/sabsms/engine-client";
import {
  getSabsmsCollections,
  SABSMS_COLLECTIONS,
} from "@/lib/sabsms/db/collections";
import type {
  SabsmsMessageCategory,
  SabsmsMessageStatus,
} from "@/lib/sabsms/types";

import { interpolateBody, type RecipientRow } from "./parse";

// TODO(collections): Register `sabsms_quick_send_runs` in
// `src/lib/sabsms/db/collections.ts` (and its index spec) once the
// quick-send run lifecycle stabilises. This action falls back to the raw
// driver collection so the page is usable before that lands.
const QUICK_SEND_RUNS = "sabsms_quick_send_runs";

// TODO(audit): The launch hook writes to a top-level `audit_logs`
// collection if it exists; reuse the same approach as
// `src/app/sabsms/campaigns/new/actions.ts`. Replace with the
// SabSMS-shared audit collection once it lands.
const AUDIT_LOGS = "audit_logs";

// ─── Shared types ─────────────────────────────────────────────────────────

export type SenderNumberOption = {
  id: string;
  e164: string;
  country: string;
  capabilities: { sms: boolean; mms: boolean };
};

export type QuickSendRowResult = {
  sourceLine: number;
  phone: string;
  status: "queued" | "skipped_suppressed" | "skipped_sent_today" | "failed" | "dry_run";
  messageId?: string;
  error?: string;
};

export type QuickSendRunStatus = "pending" | "running" | "paused" | "cancelled" | "completed";

export interface QuickSendRunDoc {
  runId: string;
  workspaceId: string;
  status: QuickSendRunStatus;
  category: SabsmsMessageCategory;
  bodyTemplate: string;
  dryRun: boolean;
  skipSuppressed: boolean;
  skipSentToday: boolean;
  throttlePerSecond: number;
  senderNumberId?: string;
  total: number;
  queued: number;
  skipped: number;
  failed: number;
  results: QuickSendRowResult[];
  startedAt: Date;
  finishedAt?: Date;
}

export interface LaunchInput {
  rows: { phone: string; vars: Record<string, string>; sourceLine: number }[];
  body: string;
  category: SabsmsMessageCategory;
  senderNumberId?: string;
  throttlePerSecond: number;
  dryRun: boolean;
  skipSuppressed: boolean;
  skipSentToday: boolean;
  marketingAttested?: boolean;
}

export type LaunchResult =
  | { ok: true; runId: string }
  | { ok: false; error: string };

export type StatusResult =
  | { ok: true; run: QuickSendRunDoc }
  | { ok: false; error: string };

// ─── Helpers ──────────────────────────────────────────────────────────────

async function resolveWorkspace(): Promise<
  { ok: true; workspaceId: string } | { ok: false; error: string }
> {
  const session = await getCachedSession();
  const userId = (session?.user as any)?._id;
  if (!userId) return { ok: false, error: "unauthorized" };
  return { ok: true, workspaceId: String(userId) };
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Sleep helper used to honour the throttle slider. */
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Server actions ───────────────────────────────────────────────────────

/**
 * Reads `sabsms_numbers` for the current workspace. Drives the sender
 * pool selector.
 */
export async function listSenderNumbers(): Promise<SenderNumberOption[]> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return [];
  const { cols } = await getSabsmsCollections();
  const docs = await cols.numbers
    .find({ workspaceId: ws.workspaceId, status: "active" })
    .project({ _id: 1, e164: 1, country: 1, capabilities: 1 })
    .toArray();
  return docs.map((d) => ({
    id: String(d._id),
    e164: (d as any).e164 ?? "",
    country: (d as any).country ?? "",
    capabilities: {
      sms: Boolean((d as any).capabilities?.sms),
      mms: Boolean((d as any).capabilities?.mms),
    },
  }));
}

/**
 * Asks the engine to drop a single test message before kicking off the
 * bulk run. Doesn't touch the run doc.
 */
export async function quickSendTestRow(input: {
  to: string;
  body: string;
  category: SabsmsMessageCategory;
}): Promise<{ ok: true; id: string; status: SabsmsMessageStatus } | { ok: false; error: string }> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!input.to || !input.body) {
    return { ok: false, error: "Recipient and body are required" };
  }
  try {
    const res = await sabsmsEngine.enqueueSend({
      workspaceId: ws.workspaceId,
      to: input.to,
      body: input.body,
      category: input.category,
      eventKey: "sabsms.quick_send.test",
    });
    return { ok: true, id: res.id, status: res.status };
  } catch (e) {
    if (e instanceof SabsmsEngineError) {
      return { ok: false, error: `${e.status} ${e.message}` };
    }
    return { ok: false, error: (e as Error)?.message ?? "test send failed" };
  }
}

/**
 * Creates the run document immediately, then enqueues recipients in the
 * background loop. The client polls `getQuickSendStatus(runId)` every
 * couple of seconds to render progress.
 *
 * Pause/cancel are honoured between rows by re-reading the run doc
 * before each send.
 */
export async function launchQuickSend(input: LaunchInput): Promise<LaunchResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;

  if (!input.rows.length) {
    return { ok: false, error: "No recipients to send to." };
  }
  if (!input.body.trim()) {
    return { ok: false, error: "Message body is required." };
  }
  if (input.category === "marketing" && !input.marketingAttested) {
    return {
      ok: false,
      error: "Marketing sends require TCPA attestation.",
    };
  }

  const runId = randomUUID();
  const { db, cols } = await getSabsmsCollections();
  const runs = db.collection<QuickSendRunDoc>(QUICK_SEND_RUNS);

  const doc: QuickSendRunDoc = {
    runId,
    workspaceId: ws.workspaceId,
    status: "pending",
    category: input.category,
    bodyTemplate: input.body,
    dryRun: input.dryRun,
    skipSuppressed: input.skipSuppressed,
    skipSentToday: input.skipSentToday,
    throttlePerSecond: Math.max(1, Math.min(50, input.throttlePerSecond)),
    senderNumberId: input.senderNumberId,
    total: input.rows.length,
    queued: 0,
    skipped: 0,
    failed: 0,
    results: [],
    startedAt: new Date(),
  };
  await runs.insertOne(doc);

  // Audit log entry on launch. Uses the existing `audit_logs` if present,
  // otherwise falls back to console.log (matches campaigns/new/actions.ts).
  try {
    const { db: rawDb } = await connectToDatabase();
    await rawDb.collection(AUDIT_LOGS).insertOne({
      workspaceId: ws.workspaceId,
      module: "sabsms",
      action: input.dryRun ? "quick_send.dry_run" : "quick_send.launch",
      resource: `${QUICK_SEND_RUNS}/${runId}`,
      meta: {
        total: input.rows.length,
        category: input.category,
        throttlePerSecond: doc.throttlePerSecond,
        skipSuppressed: input.skipSuppressed,
        skipSentToday: input.skipSentToday,
      },
      createdAt: new Date(),
    });
  } catch {
    // eslint-disable-next-line no-console
    console.log("[sabsms.audit] quick_send.launch", {
      workspaceId: ws.workspaceId,
      runId,
      total: input.rows.length,
      dryRun: input.dryRun,
    });
  }

  // Kick off the background loop — intentionally not awaited so the
  // server action returns the runId immediately and the client can
  // start polling. We catch all errors so the loop's lifetime survives
  // any single-row failure.
  void runQuickSendLoop(runId, ws.workspaceId, input).catch((e) => {
    // eslint-disable-next-line no-console
    console.error("[sabsms.quick_send] loop crashed", runId, e);
  });

  return { ok: true, runId };
}

async function runQuickSendLoop(
  runId: string,
  workspaceId: string,
  input: LaunchInput,
): Promise<void> {
  const { db, cols } = await getSabsmsCollections();
  const runs = db.collection<QuickSendRunDoc>(QUICK_SEND_RUNS);

  await runs.updateOne({ runId }, { $set: { status: "running" } });

  const throttleMs = Math.max(
    20,
    Math.floor(1000 / Math.max(1, Math.min(50, input.throttlePerSecond))),
  );

  // 24h cut-off for the "skip already sent today" check.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  for (const row of input.rows) {
    // Re-read the doc so pause/cancel kick in.
    const current = await runs.findOne({ runId });
    if (!current) return;
    if (current.status === "cancelled") return;
    while (current && current.status === "paused") {
      await sleep(1000);
      const next = await runs.findOne({ runId });
      if (!next || next.status === "cancelled") return;
      if (next.status === "running") break;
    }

    const result: QuickSendRowResult = {
      sourceLine: row.sourceLine,
      phone: row.phone,
      status: "queued",
    };

    try {
      // Skip suppressed (hash-based, matches sabsms_suppressions index).
      if (input.skipSuppressed) {
        const phoneHash = sha256(row.phone);
        const hit = await cols.suppressions.findOne({
          workspaceId,
          phoneHash,
        });
        if (hit) {
          result.status = "skipped_suppressed";
          await pushResult(runs, runId, result, { skipped: 1 });
          continue;
        }
      }

      // Skip already-sent-today.
      if (input.skipSentToday) {
        const hit = await cols.messages.findOne({
          workspaceId,
          to: row.phone,
          createdAt: { $gte: since },
        });
        if (hit) {
          result.status = "skipped_sent_today";
          await pushResult(runs, runId, result, { skipped: 1 });
          continue;
        }
      }

      const body = interpolateBody(input.body, row.vars);

      if (input.dryRun) {
        result.status = "dry_run";
        await pushResult(runs, runId, result, { queued: 1 });
        await sleep(throttleMs);
        continue;
      }

      const send = await sabsmsEngine.enqueueSend({
        workspaceId,
        to: row.phone,
        body,
        category: input.category,
        eventKey: "sabsms.quick_send",
        tags: [`quick_send:${runId}`],
      });
      result.messageId = send.id;
      result.status = "queued";
      await pushResult(runs, runId, result, { queued: 1 });
    } catch (e) {
      result.status = "failed";
      result.error =
        e instanceof SabsmsEngineError
          ? `${e.status} ${e.message}`
          : (e as Error)?.message ?? "send failed";
      await pushResult(runs, runId, result, { failed: 1 });
    }

    await sleep(throttleMs);
  }

  await runs.updateOne(
    { runId },
    { $set: { status: "completed", finishedAt: new Date() } },
  );
}

async function pushResult(
  runs: import("mongodb").Collection<QuickSendRunDoc>,
  runId: string,
  result: QuickSendRowResult,
  counters: { queued?: number; skipped?: number; failed?: number },
): Promise<void> {
  await runs.updateOne(
    { runId },
    {
      $push: { results: result } as any,
      $inc: {
        queued: counters.queued ?? 0,
        skipped: counters.skipped ?? 0,
        failed: counters.failed ?? 0,
      } as any,
    },
  );
}

export async function getQuickSendStatus(runId: string): Promise<StatusResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!runId) return { ok: false, error: "no runId" };

  const { db } = await getSabsmsCollections();
  const runs = db.collection<QuickSendRunDoc>(QUICK_SEND_RUNS);
  const doc = await runs.findOne({ runId, workspaceId: ws.workspaceId });
  if (!doc) return { ok: false, error: "run not found" };
  return { ok: true, run: doc };
}

export async function setQuickSendStatus(
  runId: string,
  status: "paused" | "running" | "cancelled",
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  const { db } = await getSabsmsCollections();
  const runs = db.collection<QuickSendRunDoc>(QUICK_SEND_RUNS);
  const res = await runs.updateOne(
    { runId, workspaceId: ws.workspaceId },
    { $set: { status } },
  );
  if (res.matchedCount === 0) return { ok: false, error: "run not found" };
  return { ok: true };
}

/**
 * Re-runs every failed row from a previous quick-send run. Creates a
 * fresh runId.
 */
export async function reattemptFailures(input: {
  runId: string;
  body: string;
  category: SabsmsMessageCategory;
  senderNumberId?: string;
  throttlePerSecond: number;
}): Promise<LaunchResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  const { db } = await getSabsmsCollections();
  const runs = db.collection<QuickSendRunDoc>(QUICK_SEND_RUNS);
  const prev = await runs.findOne({
    runId: input.runId,
    workspaceId: ws.workspaceId,
  });
  if (!prev) return { ok: false, error: "previous run not found" };

  const failedRows = prev.results
    .filter((r) => r.status === "failed")
    .map((r) => ({ phone: r.phone, vars: {}, sourceLine: r.sourceLine }));
  if (!failedRows.length) {
    return { ok: false, error: "no failed rows to re-attempt" };
  }

  return launchQuickSend({
    rows: failedRows,
    body: input.body,
    category: input.category,
    senderNumberId: input.senderNumberId,
    throttlePerSecond: input.throttlePerSecond,
    dryRun: false,
    skipSuppressed: true,
    skipSentToday: false,
  });
}
