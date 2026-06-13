"use server";

import { ObjectId } from "mongodb";

import { getCachedSession } from "@/lib/server-cache";
import { creditCostFor } from "@/lib/sabsms/credits/rates";
import { getSabsmsCollections } from "@/lib/sabsms/db/collections";
import {
  sabsmsEngine,
  SabsmsEngineError,
} from "@/lib/sabsms/engine-client";
import { attachMessageIdToLinks, shortenUrlsInBody } from "@/lib/sabsms/links";
import { countryFromE164 } from "@/lib/sabsms/phone";
import {
  deriveRcsFallbackText,
  SabsmsRcsPayloadSchema,
} from "@/lib/sabsms/rcs";
import { renderTemplate } from "@/lib/sabsms/render";
import { estimateSegments, segmentInfo, type SegmentInfo } from "@/lib/sabsms/segments";
import type {
  SabsmsMessage,
  SabsmsMessageCategory,
  SabsmsMessageStatus,
  SabsmsRcsCard,
  SabsmsRcsPayload,
  SabsmsRcsSuggestion,
  SabsmsTemplate,
  SabsmsTemplateCategory,
  SabsmsTemplateStatus,
} from "@/lib/sabsms/types";

export interface SubmitInput {
  to: string;
  body: string;
  category: SabsmsMessageCategory;
}

export type SubmitResult =
  | { ok: true; id: string; status: SabsmsMessageStatus }
  | { ok: false; error: string };

export type FetchResult =
  | { ok: true; message: SabsmsMessage }
  | { ok: false; error: string };

async function resolveWorkspace(): Promise<
  { ok: true; workspaceId: string } | { ok: false; error: string }
> {
  const session = await getCachedSession();
  const userId = (session?.user as any)?._id;
  if (!userId) return { ok: false, error: "unauthorized" };
  // Phase 1: workspace == user id. A multi-project picker will swap
  // this for the active project id once SabSMS gets per-project scoping.
  return { ok: true, workspaceId: String(userId) };
}

/** Legacy free-form send — kept as a thin alias over `sendSmsAction`. */
export async function submitSend(input: SubmitInput): Promise<SubmitResult> {
  return sendSmsAction({ to: input.to, body: input.body, category: input.category });
}

// ─── V2.1 — templated send + estimate ────────────────────────────────────

export interface SendSmsInput {
  to: string;
  /** Free-form body. Ignored when `templateId` is set — the stored
   *  template body is the compliance-reviewed source of truth. */
  body?: string;
  templateId?: string;
  /** Values for `{{name}}` placeholders. */
  vars?: Record<string, string | number | null | undefined>;
  /** Values for DLT `{#var#}` slots, in order. */
  positional?: string[];
  category: SabsmsMessageCategory;
  from?: string;
  /** V2.4B — rewrite http(s) URLs in the body to tracked short links. */
  shortenLinks?: boolean;
  /** V2.11 — 'rcs_preferred' sends a rich card with SMS fallback. */
  channel?: "sms" | "rcs_preferred";
  /** V2.11 — rich card + suggestions; `fallbackText` defaults to body. */
  rcs?: {
    card?: SabsmsRcsCard;
    suggestions?: SabsmsRcsSuggestion[];
    fallbackText?: string;
  };
}

export type SendSmsResult =
  | { ok: true; id: string; status: SabsmsMessageStatus; segments: number }
  | { ok: false; error: string };

/**
 * Render (template or free-form) and enqueue a single SMS through the
 * engine. Missing template variables fail fast — we never push a body
 * with literal `{{placeholders}}` to a carrier.
 */
export async function sendSmsAction(input: SendSmsInput): Promise<SendSmsResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;

  if (!input.to.trim()) return { ok: false, error: "Recipient is required" };

  let text = input.body ?? "";
  let templateId: string | undefined;

  if (input.templateId) {
    if (!ObjectId.isValid(input.templateId)) {
      return { ok: false, error: "Invalid template id" };
    }
    const { cols } = await getSabsmsCollections();
    const doc = await cols.templates.findOne({
      _id: new ObjectId(input.templateId),
      workspaceId: ws.workspaceId,
    });
    if (!doc) return { ok: false, error: "Template not found" };

    const rawBody =
      doc.bodies?.find((b) => b.locale === "en")?.body ??
      doc.bodies?.[0]?.body ??
      "";
    if (!rawBody.trim()) return { ok: false, error: "Template has no body" };

    // Blank positional values count as missing — never send a body with
    // an empty DLT slot.
    const positional = input.positional?.map((p) => (p === "" ? undefined : p));
    const rendered = renderTemplate(rawBody, input.vars ?? {}, { positional });
    if (rendered.missing.length > 0) {
      return {
        ok: false,
        error: `Missing template variables: ${rendered.missing.join(", ")}`,
      };
    }
    text = rendered.text;
    templateId = input.templateId;
  } else if (input.vars && Object.keys(input.vars).length > 0) {
    // Allow {{vars}} in free-form bodies too (quick personalisation).
    const rendered = renderTemplate(text, input.vars, {
      positional: input.positional,
    });
    if (rendered.missing.length > 0) {
      return {
        ok: false,
        error: `Missing variables: ${rendered.missing.join(", ")}`,
      };
    }
    text = rendered.text;
  }

  if (!text.trim()) return { ok: false, error: "Message body is required" };

  // V2.4B auto-shorten. The engine message id only exists after enqueue,
  // so links are minted here with whatever attribution we have, and the
  // messageId is back-filled fire-and-forget once enqueue returns.
  let shortenedSlugs: string[] = [];
  if (input.shortenLinks) {
    try {
      const shortened = await shortenUrlsInBody(text, {
        workspaceId: ws.workspaceId,
      });
      text = shortened.body;
      shortenedSlugs = shortened.links.map((l) => l.slug);
    } catch (e) {
      // Fail loud rather than silently sending unshortened — the user
      // explicitly asked for tracked links.
      return {
        ok: false,
        error: `Link shortening failed: ${(e as Error)?.message ?? "unknown error"}`,
      };
    }
  }

  // V2.11 — RCS preferred: validate the payload against the engine
  // wire schema (camelCase, kind-tagged suggestions) and derive the
  // SMS fallback from the rendered body when none was typed. The card
  // image arrives as a resolved public SabFiles URL from the picker —
  // the same URL contract MMS attachments use.
  let rcsPayload: SabsmsRcsPayload | undefined;
  if (input.channel === "rcs_preferred") {
    const candidate: SabsmsRcsPayload = {
      card: input.rcs?.card,
      suggestions: (input.rcs?.suggestions ?? []).slice(0, 4),
      fallbackText: deriveRcsFallbackText(
        text,
        input.rcs?.fallbackText,
        input.rcs?.card,
      ),
    };
    const parsed = SabsmsRcsPayloadSchema.safeParse(candidate);
    if (!parsed.success) {
      return {
        ok: false,
        error: `Invalid RCS payload: ${parsed.error.issues[0]?.message ?? "validation failed"}`,
      };
    }
    rcsPayload = parsed.data as SabsmsRcsPayload;
  }

  try {
    const res = await sabsmsEngine.enqueueSend({
      workspaceId: ws.workspaceId,
      to: input.to,
      body: text,
      category: input.category,
      from: input.from || undefined,
      templateId,
      eventKey: "sabsms.send.composer",
      ...(rcsPayload
        ? { rcs: rcsPayload, channelRequested: "rcs_preferred" as const }
        : {}),
    });
    if (shortenedSlugs.length > 0) {
      // Fire-and-forget — attribution back-fill must never fail the send.
      attachMessageIdToLinks(ws.workspaceId, shortenedSlugs, res.id).catch(
        (e) =>
          console.error(
            "[sabsms/send] failed to attach messageId to short links",
            e,
          ),
      );
    }
    return {
      ok: true,
      id: res.id,
      status: res.status,
      // The engine is the billing source of truth; fall back to the
      // parity counter (same math) when it omits the count.
      segments: res.segments ?? estimateSegments(text),
    };
  } catch (e) {
    if (e instanceof SabsmsEngineError) {
      return { ok: false, error: `${e.status} ${e.message}` };
    }
    return { ok: false, error: (e as Error)?.message ?? "send failed" };
  }
}

export interface EstimateResult {
  ok: true;
  info: SegmentInfo;
  /** ISO country parsed from the number prefix ('' = unknown → default rate). */
  country: string;
  credits: number;
}

/** Live counter backing data: segments + encoding + credit cost. */
export async function estimateAction(input: {
  body: string;
  to?: string;
}): Promise<EstimateResult> {
  const info = segmentInfo(input.body ?? "");
  const country = countryFromE164(input.to ?? "");
  const credits = creditCostFor({
    segments: info.segments,
    destinationCountry: country,
    channel: "sms",
  });
  return { ok: true, info, country, credits };
}

export interface SendableTemplate {
  id: string;
  name: string;
  body: string;
  category: SabsmsTemplateCategory;
  status: SabsmsTemplateStatus;
  variables: string[];
}

/** Templates the composer can pick from (workspace-scoped, not deprecated). */
export async function listSendableTemplates(): Promise<SendableTemplate[]> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return [];

  const { cols } = await getSabsmsCollections();
  const docs = (await cols.templates
    .find({
      workspaceId: ws.workspaceId,
      status: { $in: ["approved", "draft", "submitted"] as SabsmsTemplateStatus[] },
      deprecated: { $ne: true },
    } as Record<string, unknown>)
    .sort({ status: 1, updatedAt: -1 }) // 'approved' < 'draft' < 'submitted'
    .limit(100)
    .toArray()) as SabsmsTemplate[];

  return docs.map((d) => ({
    id: String(d._id),
    name: d.name,
    body: d.bodies?.find((b) => b.locale === "en")?.body ?? d.bodies?.[0]?.body ?? "",
    category: d.category,
    status: d.status,
    variables: d.variables ?? [],
  }));
}

/**
 * V2.11 — RCS composer gate. Plan flag `sabsms.rcs_enabled` has no
 * helper in `src/lib/plans.ts` yet (only module-level toggles), so the
 * gate is the workspace settings boolean `rcsEnabled` (see
 * `SabsmsSettings`); flip it via the settings collection. Ships dark
 * (false) until an RBM agent is live, per the plan.
 */
export async function getRcsComposerContext(): Promise<{ rcsEnabled: boolean }> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return { rcsEnabled: false };
  try {
    const { cols } = await getSabsmsCollections();
    const settings = await cols.settings.findOne({ workspaceId: ws.workspaceId });
    return { rcsEnabled: Boolean(settings?.rcsEnabled) };
  } catch {
    return { rcsEnabled: false };
  }
}

/**
 * V2.11 — single-recipient capability probe for the composer's
 * "recipient is RCS-capable" hint. Engine-cached (identity graph, 7d).
 */
export async function checkRcsCapabilityAction(
  to: string,
): Promise<{ ok: true; capable: boolean; source: string } | { ok: false; error: string }> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!to.trim()) return { ok: false, error: "Recipient is required" };
  try {
    const res = await sabsmsEngine.rcsCapability(ws.workspaceId, [to.trim()]);
    const entry = Object.values(res.capabilities)[0];
    if (!entry) return { ok: false, error: "No capability result" };
    return { ok: true, capable: entry.capable, source: entry.source };
  } catch (e) {
    if (e instanceof SabsmsEngineError) {
      return { ok: false, error: `${e.status} ${e.message}` };
    }
    return { ok: false, error: (e as Error)?.message ?? "capability check failed" };
  }
}

export async function fetchSendStatus(id: string): Promise<FetchResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!id) return { ok: false, error: "no id" };

  try {
    const m = await sabsmsEngine.getMessage(id);
    if (!m) return { ok: false, error: "message not found" };
    return { ok: true, message: m };
  } catch (e) {
    if (e instanceof SabsmsEngineError) {
      return { ok: false, error: `${e.status} ${e.message}` };
    }
    return { ok: false, error: (e as Error)?.message ?? "fetch failed" };
  }
}
