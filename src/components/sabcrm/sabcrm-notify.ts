"use client";

/**
 * SabCRM — assignment / mention toast helper (client-only).
 *
 * A thin, stateless adapter that turns the *results* of SabCRM assignment and
 * mention actions into ZoruUI toasts. It owns **no** global state of its own:
 * it is a pure mapping from "what just happened" → a ZoruUI toast payload,
 * delegating every side effect to the shared ZoruUI toast queue
 * ({@link toast}, mounted once via `<ZoruToaster />` at the app root).
 *
 * Why a dedicated module (vs. calling `toast` inline at each call site):
 *  - One place decides the copy, the variant (success / info / destructive),
 *    and the title vs. description split for assignment + mention events, so
 *    every surface (record table, board, detail, command menu, related rail)
 *    reads identically.
 *  - The shapes below ({@link AssignmentNotice}, {@link MentionNotice}) are the
 *    seam a future notification-center can also consume — see
 *    "NOTIFICATION-CENTER INTEGRATION" at the bottom of this file.
 *
 * Usage (after a server action resolves on the client):
 *
 *   import { notifyAssignment, notifyMention, notifyActionResult }
 *     from "@/components/sabcrm/sabcrm-notify";
 *
 *   const res = await assignRecordAction(...);   // ActionResult<...>
 *   if (res.ok) {
 *     notifyAssignment({
 *       recordLabel: res.data.label,
 *       objectLabel: "Opportunity",
 *       assigneeName: res.data.assigneeName,
 *       assignedToMe: res.data.assigneeId === currentUserId,
 *     });
 *   } else {
 *     notifyActionResult(res);
 *   }
 *
 * This module is deliberately import-light: it depends only on the ZoruUI
 * barrel, so it can be dropped into any SabCRM client component without
 * pulling in server-only code.
 */

import { toast, type ZoruToastInput } from '@/components/sabcrm/20ui/compat';

// ── Public input shapes ─────────────────────────────────────────────────────
// These are intentionally UI-facing (already-resolved labels/names), not raw
// ids — the caller resolves ids → display labels (the records runtime already
// does this via `withLabel`), keeping this helper free of any data access.

/** One person became the owner/assignee of one record. */
export interface AssignmentNotice {
  /** Display label of the record that was (re)assigned. */
  recordLabel: string;
  /** Singular object label, e.g. "Opportunity" (used to phrase the title). */
  objectLabel?: string;
  /** Display name of the new assignee. Omit for an unassignment. */
  assigneeName?: string;
  /**
   * True when the new assignee is the current viewer — drives the more
   * personal "Assigned to you" copy and an `info` (vs. `success`) variant.
   */
  assignedToMe?: boolean;
}

/** Someone @-mentioned one or more people on a record (note / comment / task). */
export interface MentionNotice {
  /** Display label of the record the mention lives on. */
  recordLabel: string;
  /** Display names of everyone mentioned (deduped by the caller). */
  mentionedNames: string[];
  /** True when the current viewer is among the mentioned. */
  mentionedMe?: boolean;
}

/**
 * The minimal slice of the SabCRM `ActionResult<T>` contract this helper reads.
 * Kept structural (not imported from the server-only actions module) so this
 * client file never reaches across the server boundary. Any `ActionResult<T>`
 * from `sabcrm.actions.ts` is assignable to this.
 */
export interface NotifiableActionResult {
  ok: boolean;
  error?: string;
}

// ── Internal: single dispatch seam ──────────────────────────────────────────
// Every notification in this module funnels through `emit()`. Today it only
// pushes a ZoruUI toast; this is the one function a notification-center would
// extend (see the bottom of the file) so persistence + bell-inbox fan-out stay
// in lock-step with what the user sees as a toast.

// Variant union mirrors ZoruUI's toast `cva` (zoruui/toast.tsx). Defined
// locally rather than via `ZoruToastInput["variant"]` so the helper does not
// depend on the exact key path of the toast-input type.
type NotifyVariant = "default" | "destructive" | "success" | "warning" | "info";

function emit(
  title: string,
  description: string | undefined,
  variant: NotifyVariant,
): void {
  // Typed as ZoruToastInput so any mismatch with the real toast contract
  // surfaces here at build time rather than being silently dropped.
  const payload: ZoruToastInput = { title, variant };
  if (description) payload.description = description;
  toast(payload);
}

function joinNames(names: string[]): string {
  const clean = names.map((n) => n.trim()).filter(Boolean);
  if (clean.length === 0) return "someone";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean[0]}, ${clean[1]} and ${clean.length - 2} other${
    clean.length - 2 === 1 ? "" : "s"
  }`;
}

// ── Public surface ──────────────────────────────────────────────────────────

/**
 * Toast the outcome of an assignment action.
 *
 * - Assigned to the current viewer → personal `info` toast.
 * - Assigned to someone else       → `success` toast naming the assignee.
 * - No `assigneeName`              → treated as an *unassignment*.
 */
export function notifyAssignment(notice: AssignmentNotice): void {
  const subject = notice.objectLabel
    ? `${notice.objectLabel} · ${notice.recordLabel}`
    : notice.recordLabel;

  if (!notice.assigneeName) {
    emit("Unassigned", `${subject} no longer has an owner.`, "default");
    return;
  }

  if (notice.assignedToMe) {
    emit("Assigned to you", `${subject} is now yours.`, "info");
    return;
  }

  emit(
    "Assignment updated",
    `${subject} assigned to ${notice.assigneeName}.`,
    "success",
  );
}

/**
 * Toast the outcome of a mention action.
 *
 * - The current viewer was mentioned → personal `info` toast.
 * - Others were mentioned            → quiet `default` confirmation toast.
 */
export function notifyMention(notice: MentionNotice): void {
  if (notice.mentionedMe) {
    emit(
      "You were mentioned",
      `On ${notice.recordLabel}.`,
      "info",
    );
    return;
  }

  const who = joinNames(notice.mentionedNames);
  emit(
    "People notified",
    `${who} mentioned on ${notice.recordLabel}.`,
    "default",
  );
}

/**
 * Convenience for the failure path: surface an `ActionResult` error (or a
 * generic message) as a `destructive` toast. No-op on success so callers can
 * write `notifyActionResult(res)` unconditionally if they prefer.
 */
export function notifyActionResult(
  result: NotifiableActionResult,
  fallback = "Something went wrong.",
): void {
  if (result.ok) return;
  emit("Action failed", result.error ?? fallback, "destructive");
}

/* ───────────────────────────────────────────────────────────────────────────
 * NOTIFICATION-CENTER INTEGRATION (future hook point)
 * ───────────────────────────────────────────────────────────────────────────
 * This helper is intentionally toast-only and carries no persistence. When a
 * SabCRM notification center (the bell / inbox surfaced by ZoruUI's
 * `ZoruNotificationPopover`) is added, wire it in at the SINGLE `emit()` seam
 * above — do not scatter writes across `notifyAssignment` / `notifyMention`.
 *
 * Recommended shape:
 *   1. Persist server-side, not here. Add a `sabcrm_notifications` collection
 *      (via `src/lib/sabcrm/db.ts` + `ensureSabcrmIndexes`, tenant-scoped by
 *      `projectId` and owner-scoped by `userId`/workspace, same convention as
 *      `sabcrm_records`). Write the row inside the SAME server action that
 *      performs the assignment/mention (e.g. `assignment.server.ts`), so the
 *      toast (client) and the inbox row (server) describe one event.
 *   2. Gate that server action exactly like the rest of SabCRM via the shared
 *      `gate()` helper in `src/app/actions/sabcrm.actions.ts`:
 *        getCachedSession → resolve projectId → RBAC (sabcrm:view to read the
 *        inbox, sabcrm:manage to mark-read/dismiss) → plan (sabcrmPlanFeature)
 *        → Mongo → ActionResult<T>.
 *   3. On the client, keep this `emit()` as the live toast, and let the inbox
 *      hydrate from the persisted rows (e.g. a `useSabcrmNotifications()` hook
 *      feeding `ZoruNotificationPopover` in the SabCRM shell header,
 *      `src/components/sabcrm/sabcrm-shell.tsx`). If real-time is wanted,
 *      `emit()` is also the right place to optimistically prepend to that
 *      client store before the server confirms.
 *
 * The point: `emit()` is the one function to extend. Everything above it stays
 * pure copy/variant mapping; everything below the toast (persistence, bell
 * badge counts, mark-as-read) hangs off this seam plus the gated server action.
 * ────────────────────────────────────────────────────────────────────────── */
