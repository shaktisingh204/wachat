"use server";
import { getSabsmsWorkspaceId } from "@/lib/sabsms/workspace";

/**
 * SabSMS compliance · Custom keywords — REAL engine-backed config.
 *
 * The engine's inbound keyword interceptor (`services/sabsms-engine/src/
 * keywords.rs::load_rules`) reads a SINGLE workspace-level override doc
 * from `sabsms_keyword_rules` via `find_one({ workspaceId })` with fields:
 *   - `stopKeywords: string[]`   (extra STOP synonyms, merged with defaults)
 *   - `helpKeywords: string[]`   (extra HELP synonyms, merged with defaults)
 *   - `helpText: string`         (auto-reply body for HELP)
 *   - `confirmOptOutText: string`(auto-reply body sent on STOP)
 * Writing those fields here GENUINELY changes inbound engine behaviour.
 *
 * The engine built-in defaults (DEFAULT_STOP/START/HELP_KEYWORDS) are
 * always active; the doc only ADDS to them — it cannot remove a default.
 *
 * The page also offers a per-keyword auto-reply RULES section
 * (`SabsmsKeywordRule` docs, also in `sabsms_keyword_rules`, keyed by
 * `keyword`). Those are STORED-ONLY: the engine does not yet consume
 * per-keyword reply rules, so the UI labels them "saved, enforcement
 * coming soon" and this module never claims they fire.
 */

import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";

import { connectToDatabase } from "@/lib/mongodb";
import { SABSMS_COLLECTIONS } from "@/lib/sabsms/db/collections";
import { sabsmsEngine } from "@/lib/sabsms/engine-client";
import type { SabsmsKeywordRule } from "@/lib/sabsms/types";

const COL = SABSMS_COLLECTIONS.keywordRules;
const COL_SUPPRESSIONS = SABSMS_COLLECTIONS.suppressions;
const COL_CONSENT = SABSMS_COLLECTIONS.consentLog;
const PAGE_PATH = "/sabsms/compliance/keywords";

// Mirror of the engine's compiled-in defaults (keywords.rs). These are
// ALWAYS active and cannot be edited away — shown as read-only context.
export const ENGINE_DEFAULTS = {
  stop: ["STOP", "STOPALL", "UNSUB", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"],
  start: ["START", "UNSTOP"],
  help: ["HELP", "INFO"],
  confirmOptOutText: "You have been unsubscribed. Reply START to resubscribe.",
  helpText: "Reply STOP to unsubscribe.",
} as const;

type ActionErr = { success: false; error: string };
const unauthorized: ActionErr = { success: false, error: "Unauthorized" };

async function requireWorkspaceId(): Promise<string | null> {
  return getSabsmsWorkspaceId();
}

/** Normalize like the engine: trim, strip trailing punctuation, uppercase. */
function normalizeKeyword(raw: string): string {
  return raw
    .trim()
    .replace(/[!-/:-@[-`{-~]+$/u, "")
    .trim()
    .toUpperCase();
}

function uniqClean(list: string[]): string[] {
  const out: string[] = [];
  for (const raw of list) {
    const n = normalizeKeyword(raw);
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}

// ─── View types ─────────────────────────────────────────────────────────

export interface KeywordOverrideView {
  /** Extra STOP synonyms beyond the engine defaults. */
  stopKeywords: string[];
  /** Extra HELP synonyms beyond the engine defaults. */
  helpKeywords: string[];
  /** Auto-reply body sent on STOP (blank = engine default). */
  confirmOptOutText: string;
  /** Auto-reply body for HELP (blank = engine default). */
  helpText: string;
}

export interface KeywordRuleView {
  id: string;
  keyword: string;
  normalizedKeyword: string;
  match: "exact" | "starts_with" | "contains";
  action: "reply" | "opt_out" | "opt_in" | "tag";
  replyText?: string;
  tag?: string;
  enabled: boolean;
}

export interface KeywordStats {
  /** Suppressions sourced from a STOP keyword. */
  stopSuppressions: number;
  /** Consent-log opt-out events captured via inbound keyword. */
  inboundKeywordOptOuts: number;
  /** Per-keyword reply rules stored (enforcement pending). */
  storedRules: number;
}

export interface KeywordsPageData {
  override: KeywordOverrideView;
  rules: KeywordRuleView[];
  stats: KeywordStats;
}

// ─── Read ───────────────────────────────────────────────────────────────

export async function loadKeywordsPage(): Promise<
  { success: true; data: KeywordsPageData } | ActionErr
> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return unauthorized;
  const { db } = await connectToDatabase();

  const [overrideDoc, ruleDocs, stopSuppressions, inboundKeywordOptOuts] =
    await Promise.all([
      // The single workspace-level override doc — identified by the
      // ABSENCE of a `keyword` field (per-keyword rule docs carry one).
      db
        .collection(COL)
        .findOne({ workspaceId, keyword: { $exists: false } }),
      db
        .collection<SabsmsKeywordRule>(COL)
        .find({ workspaceId, keyword: { $exists: true } })
        .sort({ keyword: 1 })
        .limit(500)
        .toArray(),
      db
        .collection(COL_SUPPRESSIONS)
        .countDocuments({ workspaceId, source: "stop" }),
      db
        .collection(COL_CONSENT)
        .countDocuments({ workspaceId, captureMethod: "inbound_keyword" }),
    ]);

  const override: KeywordOverrideView = {
    stopKeywords: Array.isArray(overrideDoc?.stopKeywords)
      ? overrideDoc!.stopKeywords.map(String)
      : [],
    helpKeywords: Array.isArray(overrideDoc?.helpKeywords)
      ? overrideDoc!.helpKeywords.map(String)
      : [],
    confirmOptOutText: String(overrideDoc?.confirmOptOutText ?? ""),
    helpText: String(overrideDoc?.helpText ?? ""),
  };

  const rules: KeywordRuleView[] = ruleDocs.map((d) => ({
    id: String(d._id),
    keyword: d.keyword,
    normalizedKeyword: d.normalizedKeyword,
    match: d.match ?? "exact",
    action: d.action,
    replyText: d.replyText,
    tag: d.tag,
    enabled: d.enabled !== false,
  }));

  return {
    success: true,
    data: {
      override,
      rules,
      stats: {
        stopSuppressions,
        inboundKeywordOptOuts,
        storedRules: rules.length,
      },
    },
  };
}

// ─── Write: workspace-level override (REAL engine behaviour) ─────────────

export async function saveKeywordOverride(input: {
  stopKeywords: string[];
  helpKeywords: string[];
  confirmOptOutText: string;
  helpText: string;
}): Promise<{ success: true; override: KeywordOverrideView } | ActionErr> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return unauthorized;
  const { db } = await connectToDatabase();

  const stopKeywords = uniqClean(input.stopKeywords ?? []);
  const helpKeywords = uniqClean(input.helpKeywords ?? []);
  const confirmOptOutText = (input.confirmOptOutText ?? "").trim();
  const helpText = (input.helpText ?? "").trim();

  await db.collection(COL).updateOne(
    { workspaceId, keyword: { $exists: false } },
    {
      $set: {
        workspaceId,
        stopKeywords,
        helpKeywords,
        confirmOptOutText,
        helpText,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true },
  );

  // The engine caches keyword rules per workspace; nudge it the same way
  // the DLT registry write path does (best-effort — never fail the save).
  try {
    await sabsmsEngine.invalidateDlt(workspaceId);
  } catch {
    /* cache-bust is best-effort */
  }
  revalidatePath(PAGE_PATH);

  return {
    success: true,
    override: { stopKeywords, helpKeywords, confirmOptOutText, helpText },
  };
}

// ─── Write: per-keyword reply rules (STORED-ONLY — enforcement pending) ──

export async function saveKeywordRule(input: {
  id?: string;
  keyword: string;
  match: "exact" | "starts_with" | "contains";
  action: "reply" | "opt_out" | "opt_in" | "tag";
  replyText?: string;
  tag?: string;
  enabled: boolean;
}): Promise<{ success: true; id: string } | ActionErr> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return unauthorized;

  const keyword = (input.keyword ?? "").trim();
  if (!keyword) return { success: false, error: "Keyword is required" };
  const normalizedKeyword = normalizeKeyword(keyword);
  if (!normalizedKeyword)
    return { success: false, error: "Keyword is required" };

  const { db } = await connectToDatabase();
  const now = new Date();
  const set = {
    workspaceId,
    keyword,
    normalizedKeyword,
    match: input.match,
    action: input.action,
    replyText: input.action === "reply" ? input.replyText ?? "" : undefined,
    tag: input.action === "tag" ? input.tag ?? "" : undefined,
    enabled: input.enabled,
    updatedAt: now,
  };

  if (input.id) {
    await db
      .collection(COL)
      .updateOne(
        { _id: new ObjectId(input.id), workspaceId },
        { $set: set },
      );
    revalidatePath(PAGE_PATH);
    return { success: true, id: input.id };
  }

  const res = await db
    .collection(COL)
    .insertOne({ ...set, createdAt: now });
  revalidatePath(PAGE_PATH);
  return { success: true, id: String(res.insertedId) };
}

export async function deleteKeywordRule(
  id: string,
): Promise<{ success: true } | ActionErr> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return unauthorized;
  if (!id) return { success: false, error: "Missing id" };
  const { db } = await connectToDatabase();
  await db
    .collection(COL)
    .deleteOne({ _id: new ObjectId(id), workspaceId, keyword: { $exists: true } });
  revalidatePath(PAGE_PATH);
  return { success: true };
}
