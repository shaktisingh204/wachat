"use server";

import { randomUUID } from "node:crypto";

import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";

/**
 * Server actions for `/sabsms/analytics`.
 *
 * Each action is workspace-scoped — the session's `_id` is the only
 * workspace key the action will read or write under. None of these
 * actions touch the Rust engine directly; they only persist UX state
 * (scheduled reports, share tokens) into Mongo.
 *
 * TODO stubs are clearly labelled and return a discriminated `{ ok }`
 * result so the caller can render a sensible toast.
 */

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function requireWorkspaceId(): Promise<string | null> {
  const session = await getCachedSession();
  const id = (session?.user as any)?._id;
  return id ? String(id) : null;
}

export interface ScheduleEmailReportInput {
  frequency: "daily" | "weekly" | "monthly";
  recipients: string[];
  /** Captured `searchParams` so the recipient sees the same view. */
  queryString?: string;
}

/** Persist a scheduled report. Inserts into `sabsms_scheduled_reports`. */
export async function scheduleEmailReport(
  input: ScheduleEmailReportInput,
): Promise<ActionResult<{ id: string }>> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { ok: false, error: "Not authenticated." };
  if (!input.recipients?.length)
    return { ok: false, error: "At least one recipient is required." };

  try {
    const { db } = await connectToDatabase();
    const col = db.collection("sabsms_scheduled_reports");
    const id = randomUUID();
    await col.insertOne({
      _id: id as unknown as never,
      workspaceId,
      frequency: input.frequency,
      recipients: input.recipients,
      queryString: input.queryString ?? "",
      // TODO(phase-11): wire this into SabFlow so the scheduler actually
      // delivers the email. For now we just persist the intent.
      status: "pending",
      createdAt: new Date(),
    });
    return { ok: true, data: { id } };
  } catch (err) {
    return {
      ok: false,
      error: (err as Error)?.message ?? "Failed to schedule report.",
    };
  }
}

/** Mint a read-only public share token for the current dashboard view. */
export async function createShareLink(
  queryString: string,
): Promise<ActionResult<{ url: string; token: string }>> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { ok: false, error: "Not authenticated." };

  try {
    const { db } = await connectToDatabase();
    const col = db.collection("sabsms_analytics_shares");
    const token = randomUUID().replace(/-/g, "");
    await col.insertOne({
      _id: token as unknown as never,
      workspaceId,
      queryString: queryString ?? "",
      createdAt: new Date(),
      // TODO(phase-11): add `expiresAt`, `viewCount`, `revokedAt`.
    });
    // TODO: the actual public route `/sabsms/analytics/share/[token]`
    // ships in a later page — for now we still return a valid URL so the
    // user can copy it.
    return {
      ok: true,
      data: { token, url: `/sabsms/analytics/share/${token}` },
    };
  } catch (err) {
    return {
      ok: false,
      error: (err as Error)?.message ?? "Failed to create share link.",
    };
  }
}

/** PDF export of a single tile. */
export async function exportTilePdf(
  _tileId: string,
  _queryString: string,
): Promise<ActionResult<{ url: string }>> {
  // TODO(phase-11): wire to a headless-Chrome renderer or `pdfkit`. For now
  // we surface a clear "not yet" message so the UI can render a toast.
  // eslint-disable-next-line no-console
  console.warn(
    "[sabsms/analytics] exportTilePdf is a stub — PDF export ships in Phase 11.",
  );
  return { ok: false, error: "PDF export ships in Phase 11" };
}

export interface AiExplainInput {
  metric: string;
  from: string;
  to: string;
  /** Raw numbers for context — keeps the prompt grounded. */
  context?: Record<string, unknown>;
}

/**
 * AI insight for a single metric. Looks for an existing project LLM
 * gateway under `src/lib/ai`; if none is found (currently only an
 * embeddings helper lives there), we return a static placeholder.
 */
export async function aiExplain(
  input: AiExplainInput,
): Promise<ActionResult<{ explanation: string }>> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { ok: false, error: "Not authenticated." };

  // TODO(phase-11): swap this stub for the project's LLM gateway once one
  // exists. Today only `src/lib/ai/embeddings.ts` is available, which
  // doesn't expose a chat / completions API. Returning a deterministic
  // placeholder is intentional so the UI can already wire the button.
  const placeholder =
    `AI explanation for "${input.metric}" between ${input.from} and ${input.to} ` +
    `is not available yet. (No LLM gateway found in src/lib/ai; ` +
    `wire this up when the gateway lands.)`;

  return { ok: true, data: { explanation: placeholder } };
}
