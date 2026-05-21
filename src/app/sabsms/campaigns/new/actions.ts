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
import type { SabsmsCampaign } from "@/lib/sabsms/types";

import {
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

  const scheduled =
    draft.schedule?.kind === "scheduled" ||
    draft.schedule?.kind === "recurring" ||
    draft.schedule?.kind === "drip";
  const status = scheduled ? "scheduled" : "running";

  try {
    const { cols } = await getSabsmsCollections();
    const doc = draftToCampaignDoc({ ...draft, status }, ws.workspaceId);

    let id: string;
    if (draft.id && ObjectId.isValid(draft.id)) {
      const _id = new ObjectId(draft.id);
      await cols.campaigns.updateOne(
        { _id, workspaceId: ws.workspaceId },
        { $set: { ...doc, updatedAt: new Date() } },
        { upsert: true },
      );
      id = draft.id;
    } else {
      const res = await cols.campaigns.insertOne(doc as SabsmsCampaign);
      id = res.insertedId.toHexString();
    }

    // Audit log — use the existing `audit_logs` collection if present,
    // otherwise console.log so we don't crash if it hasn't been created
    // yet. TODO: harden this once a shared SabSMS audit collection
    // exists.
    try {
      const { db } = await connectToDatabase();
      const auditCol = db.collection("audit_logs");
      await auditCol.insertOne({
        workspaceId: ws.workspaceId,
        module: "sabsms",
        action: "campaign.launch",
        resource: `${SABSMS_COLLECTIONS.campaigns}/${id}`,
        meta: {
          name: doc.name,
          status,
          scheduled,
          category: doc.category,
        },
        createdAt: new Date(),
      });
    } catch {
      // eslint-disable-next-line no-console
      console.log("[sabsms.audit] campaign.launch", {
        workspaceId: ws.workspaceId,
        id,
        name: doc.name,
        status,
      });
    }

    // TODO(Phase 4): enqueue per-recipient send jobs against the
    // chosen audience. See `plans/sabsms-world-class-plan.md` Phase 4
    // ("Campaign orchestration"). Phase 1 just inserts the doc and
    // returns — the engine will pick the campaign up via a Mongo
    // change-stream watcher.

    return { ok: true, id, scheduled };
  } catch (e) {
    return {
      ok: false,
      error: (e as Error)?.message ?? "launchCampaign failed",
    };
  }
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
