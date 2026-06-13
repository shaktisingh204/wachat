"use server";

import { ObjectId } from "mongodb";

import { getCachedSession } from "@/lib/server-cache";
import {
  sabsmsEngine,
  SabsmsEngineError,
} from "@/lib/sabsms/engine-client";
import {
  getSabsmsCollections,
  SABSMS_COLLECTIONS,
} from "@/lib/sabsms/db/collections";
import { connectToDatabase } from "@/lib/mongodb";
import type {
  SabsmsCampaign,
  SabsmsCampaignAudience,
  SabsmsMessageCategory,
} from "@/lib/sabsms/types";

import {
  createCampaignAction,
  launchCampaignAction,
  type CreateCampaignInput,
} from "../actions";
import { csvRowsToContacts, parseCsv } from "../launch-helpers";

import {
  type AudienceDraft,
  type CampaignDraft,
  validateDraftForLaunch,
} from "./types";

type ActionOk<T> = { ok: true } & T;
type ActionErr = { ok: false; error: string; issues?: string[] };
export type ActionResult<T> = ActionOk<T> | ActionErr;

async function resolveWorkspace(): Promise<
  { ok: true; workspaceId: string } | { ok: false; error: string }
> {
  const session = await getCachedSession();
  const userId = (session?.user as any)?._id;
  if (!userId) return { ok: false, error: "unauthorized" };
  return { ok: true, workspaceId: String(userId) };
}

/**
 * Map the wizard's optional-everywhere draft to a `SabsmsCampaign` doc
 * suitable for Mongo upsert. UX-only knobs that don't have a home on
 * the canonical type are dropped here — they're re-derived from the
 * draft when the per-recipient enqueue lands in Phase 4.
 */
function draftToCampaignDoc(
  draft: CampaignDraft,
  workspaceId: string,
): Omit<SabsmsCampaign, "_id"> {
  const now = new Date();
  const scheduledAt =
    draft.schedule?.kind === "scheduled" && draft.schedule.sendAt
      ? new Date(draft.schedule.sendAt)
      : undefined;

  return {
    workspaceId,
    name: draft.name || "Untitled campaign",
    templateId: draft.templateId ?? "",
    audience:
      draft.audience ??
      ({ kind: "contacts", contactIds: [] } as SabsmsCampaign["audience"]),
    schedule:
      (draft.schedule as SabsmsCampaign["schedule"]) ??
      ({ kind: "immediate" } as SabsmsCampaign["schedule"]),
    throttlePerSecond: draft.throttlePerSecond,
    senderStrategy: draft.senderStrategy,
    senderNumberIds: draft.senderNumberIds,
    category: draft.category,
    status: draft.status,
    stats: {
      total: 0,
      queued: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
      replied: 0,
      clicked: 0,
      unsubscribed: 0,
    },
    scheduledAt,
    createdAt: now,
    updatedAt: now,
  };
}

export async function saveDraft(
  draft: CampaignDraft,
): Promise<ActionResult<{ id: string }>> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;

  try {
    const { cols } = await getSabsmsCollections();
    const doc = draftToCampaignDoc(
      { ...draft, status: "draft" },
      ws.workspaceId,
    );

    if (draft.id && ObjectId.isValid(draft.id)) {
      const _id = new ObjectId(draft.id);
      await cols.campaigns.updateOne(
        { _id, workspaceId: ws.workspaceId },
        {
          $set: { ...doc, updatedAt: new Date() },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true },
      );
      return { ok: true, id: draft.id };
    }

    const res = await cols.campaigns.insertOne(doc as SabsmsCampaign);
    return { ok: true, id: res.insertedId.toHexString() };
  } catch (e) {
    return {
      ok: false,
      error: (e as Error)?.message ?? "saveDraft failed",
    };
  }
}

/**
 * Map the wizard's `AudienceDraft` onto the REAL `createCampaignAction`
 * audience shape. CSV drafts carry only a SabFile id/url, which the engine
 * recipient-render path can't resolve directly — so we fetch + parse the CSV
 * here and hand the launch a concrete `phones` audience.
 */
async function resolveDraftAudience(
  audience: AudienceDraft,
): Promise<
  { ok: true; audience: SabsmsCampaignAudience } | { ok: false; error: string }
> {
  switch (audience.kind) {
    case "segment":
      return { ok: true, audience: { kind: "segment", segmentId: audience.segmentId } };
    case "contacts":
      return {
        ok: true,
        audience: { kind: "contacts", contactIds: audience.contactIds },
      };
    case "csv": {
      if (!audience.sabFileUrl) {
        return {
          ok: false,
          error:
            "Re-pick the CSV file — its source URL was not captured. SabFiles uploads carry a public URL the launch needs.",
        };
      }
      try {
        const res = await fetch(audience.sabFileUrl);
        if (!res.ok) {
          return { ok: false, error: `Failed to fetch CSV (${res.status}).` };
        }
        const text = await res.text();
        // No explicit column mapping in the wizard — assume a `phone`
        // column (case-insensitive), falling back to the first column.
        const rows = parseCsv(text);
        let contacts = csvRowsToContacts(rows, { phone: "phone" });
        if (contacts.length === 0 && rows.length > 0) {
          // First-column fallback when there's no `phone` header.
          const header = rows[0]?.[0]?.trim();
          if (header) contacts = csvRowsToContacts(rows, { phone: header });
        }
        const phones = contacts.map((c) => c.to).filter(Boolean);
        if (phones.length === 0) {
          return {
            ok: false,
            error: "CSV resolved to zero phone numbers (need a `phone` column).",
          };
        }
        return { ok: true, audience: { kind: "phones", phones } };
      } catch (e) {
        return { ok: false, error: (e as Error)?.message ?? "CSV parse failed" };
      }
    }
  }
}

/**
 * Launch (or schedule) the campaign by delegating to the REAL path that the
 * engine ticker consumes: `createCampaignAction` (writes the draft doc) →
 * `launchCampaignAction` (resolves the audience, renders + stages per-recipient
 * docs into `sabsms_campaign_recipients`, then launches via the engine, or
 * leaves it `scheduled` for the engine's scheduled-campaign ticker).
 *
 * The previous implementation only flipped a campaign doc's `status` and never
 * staged recipients — so a launched campaign sent NOTHING. This now goes
 * through the same plumbing as the quick-create wizard.
 */
export async function launchCampaign(
  draft: CampaignDraft,
): Promise<ActionResult<{ id: string; scheduled: boolean }>> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;

  const issues = validateDraftForLaunch(draft);
  if (issues.length > 0) {
    return {
      ok: false,
      error: "Draft is incomplete.",
      issues: issues.map((i) => `${i.step}: ${i.message}`),
    };
  }

  if (!draft.audience) {
    return { ok: false, error: "Pick an audience before launching." };
  }
  if (
    draft.schedule?.kind === "recurring" ||
    draft.schedule?.kind === "drip"
  ) {
    return {
      ok: false,
      error:
        draft.schedule.kind === "recurring"
          ? "Recurring schedules aren't supported by the launch path yet — pick immediate or a single scheduled time."
          : "Drip schedules run as journeys — build one under Drips instead of launching here.",
    };
  }

  const resolved = await resolveDraftAudience(draft.audience);
  if (!resolved.ok) return resolved;

  const scheduledAt =
    draft.schedule?.kind === "scheduled" && draft.schedule.sendAt
      ? new Date(draft.schedule.sendAt)
      : undefined;
  if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
    return { ok: false, error: "Invalid scheduled send time." };
  }

  // Pull the chosen template's first body so the real path has a body to
  // render even when no inline override exists (createCampaignAction
  // requires templateId OR body).
  const createInput: CreateCampaignInput = {
    name: draft.name || "Untitled campaign",
    templateId: draft.templateId,
    category: draft.category as SabsmsMessageCategory,
    audience: resolved.audience,
    schedule: scheduledAt
      ? { kind: "scheduledAt", at: scheduledAt.toISOString() }
      : { kind: "now" },
    throttlePerSec: draft.throttlePerSecond,
    senderNumberIds: draft.senderNumberIds,
    smartSend: draft.sendTimeOptimization || undefined,
    // Persist the per-campaign link-tracking flag (V2.4). The real
    // launch path shortens + attributes links when this is on.
    shortenLinks: draft.linkTracking ?? true,
  };

  const created = await createCampaignAction(createInput);
  if (!created.ok) return created;

  // Best-effort audit (non-blocking).
  try {
    const { db } = await connectToDatabase();
    await db.collection("audit_logs").insertOne({
      workspaceId: ws.workspaceId,
      module: "sabsms",
      action: "campaign.launch",
      resource: `${SABSMS_COLLECTIONS.campaigns}/${created.id}`,
      meta: { name: createInput.name, scheduled: Boolean(scheduledAt), category: createInput.category },
      createdAt: new Date(),
    });
  } catch {
    // eslint-disable-next-line no-console
    console.log("[sabsms.audit] campaign.launch", { workspaceId: ws.workspaceId, id: created.id });
  }

  // Discard the local draft doc, if the wizard had persisted one — the real
  // campaign is the canonical record now.
  if (draft.id && ObjectId.isValid(draft.id)) {
    try {
      const { cols } = await getSabsmsCollections();
      await cols.campaigns.deleteOne({
        _id: new ObjectId(draft.id),
        workspaceId: ws.workspaceId,
        status: "draft",
      });
    } catch {
      /* ignore — orphan draft cleanup is non-critical */
    }
  }

  const launched = await launchCampaignAction({ campaignId: created.id });
  if (!launched.ok) return { ok: false, error: launched.error };

  return { ok: true, id: created.id, scheduled: launched.scheduled };
}

export async function scheduleCampaign(
  draft: CampaignDraft,
): Promise<ActionResult<{ id: string; scheduled: boolean }>> {
  // `scheduleCampaign` is a thin wrapper around launchCampaign — the
  // scheduling kind on the draft drives the resulting status. Kept as
  // a separate export so the wizard can be explicit about intent.
  return launchCampaign(draft);
}

export async function testSend(args: {
  draft: CampaignDraft;
  to: string;
  bodyOverride?: string;
}): Promise<ActionResult<{ id: string; status: string }>> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!args.to) return { ok: false, error: "Recipient is required." };

  let body = args.bodyOverride;
  if (!body && args.draft.templateId) {
    try {
      const { cols } = await getSabsmsCollections();
      const tpl = await cols.templates.findOne({
        _id: new ObjectId(args.draft.templateId),
        workspaceId: ws.workspaceId,
      });
      const locale = args.draft.templateLocale ?? tpl?.bodies?.[0]?.locale ?? "en";
      body = tpl?.bodies?.find((b) => b.locale === locale)?.body ?? tpl?.bodies?.[0]?.body;
    } catch {
      // ignore — fallback below
    }
  }
  if (!body) {
    return {
      ok: false,
      error: "Pick a template (or pass a body override) before test-send.",
    };
  }

  try {
    const res = await sabsmsEngine.enqueueSend({
      workspaceId: ws.workspaceId,
      to: args.to,
      body,
      category: args.draft.category,
      templateId: args.draft.templateId,
      eventKey: "sabsms.campaign.test_send",
    });
    return { ok: true, id: res.id, status: res.status };
  } catch (e) {
    if (e instanceof SabsmsEngineError) {
      return { ok: false, error: `${e.status} ${e.message}` };
    }
    return { ok: false, error: (e as Error)?.message ?? "testSend failed" };
  }
}

export async function abortDraft(
  draftId: string,
): Promise<ActionResult<{ id: string }>> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!draftId || !ObjectId.isValid(draftId)) {
    return { ok: false, error: "Invalid draft id." };
  }

  try {
    const { cols } = await getSabsmsCollections();
    await cols.campaigns.deleteOne({
      _id: new ObjectId(draftId),
      workspaceId: ws.workspaceId,
      status: "draft",
    });
    return { ok: true, id: draftId };
  } catch (e) {
    return {
      ok: false,
      error: (e as Error)?.message ?? "abortDraft failed",
    };
  }
}
