"use server";
import { getSabsmsWorkspaceId } from "@/lib/sabsms/workspace";

import { ObjectId, type Filter } from "mongodb";
import { revalidatePath } from "next/cache";

import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";
import { getSabsmsCollections } from "@/lib/sabsms/db/collections";
import {
  mintWebhookSecret,
  SUBSCRIBABLE_EVENTS,
  validateWebhookUrl,
} from "@/lib/sabsms/webhooks-out/core";
import {
  tickWebhookDeliveries,
  WEBHOOK_DELIVERIES_COLLECTION,
  type WebhookDeliveryDoc,
} from "@/lib/sabsms/webhooks-out/dispatch";
import type { SabsmsWebhookOut } from "@/lib/sabsms/types";

import { projectWebhook, type WebhookDocExt, type WebhookRow } from "./projection";

/**
 * /sabsms/webhooks server actions (V2.13) — endpoint CRUD over
 * `sabsms_webhooks_out` + real delivery rows from
 * `sabsms_webhook_deliveries` (written by the events-worker dispatcher
 * in `src/lib/sabsms/webhooks-out/dispatch.ts`).
 *
 * Secrets are shown ONCE: `saveWebhook` (create) and `rotateSecret`
 * return the fresh secret in their result and it is never readable
 * again through any action.
 */

export interface WebhookListFilters {
  q?: string;
  status?: string[];
  event?: string[];
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function resolveWorkspace(): Promise<
  { ok: true; workspaceId: string } | { ok: false; error: string }
> {
  const session = await getCachedSession();
  const userId = (session?.user as { _id?: unknown } | undefined)?._id;
  if (!userId) return { ok: false, error: "unauthorized" };
  return { ok: true, workspaceId: (await getSabsmsWorkspaceId()) ?? "" };
}

export async function getSubscribableEvents(): Promise<string[]> {
  return SUBSCRIBABLE_EVENTS;
}

export async function loadWebhooks(
  workspaceId: string,
  filters: WebhookListFilters,
): Promise<WebhookRow[]> {
  const { cols } = await getSabsmsCollections();
  const filter: Filter<SabsmsWebhookOut> = { workspaceId };

  if (filters.status && filters.status.length > 0) {
    if (filters.status.includes("active") && !filters.status.includes("disabled")) {
      filter.isActive = true;
    } else if (filters.status.includes("disabled") && !filters.status.includes("active")) {
      filter.isActive = false;
    }
  }

  if (filters.event && filters.event.length > 0) {
    filter.events = { $in: filters.event };
  }

  if (filters.q) {
    const rx = new RegExp(escapeRegex(filters.q), "i");
    (filter as Record<string, unknown>).$or = [{ url: rx }, { urlAlias: rx }];
  }

  const docs = (await cols.webhooksOut
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(500)
    .toArray()) as unknown as WebhookDocExt[];

  return docs.map(projectWebhook);
}

export type WebhookActionResult =
  | { ok: true; id?: string; secret?: string }
  | { ok: false; error: string };

export async function toggleWebhook(id: string, isActive: boolean): Promise<WebhookActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(id)) return { ok: false, error: "invalid id" };

  const { cols } = await getSabsmsCollections();
  await cols.webhooksOut.updateOne(
    { _id: new ObjectId(id), workspaceId: ws.workspaceId },
    { $set: { isActive, updatedAt: new Date() } }
  );
  revalidatePath("/sabsms/webhooks");
  return { ok: true };
}

/** Rotate the signing secret — the new value is returned ONCE. */
export async function rotateSecret(id: string): Promise<WebhookActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(id)) return { ok: false, error: "invalid id" };

  const newSecret = mintWebhookSecret();

  const { cols } = await getSabsmsCollections();
  const res = await cols.webhooksOut.updateOne(
    { _id: new ObjectId(id), workspaceId: ws.workspaceId },
    { $set: { secret: newSecret, updatedAt: new Date() } }
  );
  if (res.matchedCount === 0) return { ok: false, error: "endpoint not found" };
  revalidatePath("/sabsms/webhooks");
  return { ok: true, secret: newSecret };
}

export async function deleteWebhook(id: string): Promise<WebhookActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(id)) return { ok: false, error: "invalid id" };

  const { cols } = await getSabsmsCollections();
  await cols.webhooksOut.deleteOne({ _id: new ObjectId(id), workspaceId: ws.workspaceId });
  revalidatePath("/sabsms/webhooks");
  return { ok: true };
}

export interface WebhookFormData {
  id?: string;
  url: string;
  urlAlias: string;
  events: string[];
}

export async function saveWebhook(data: WebhookFormData): Promise<WebhookActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;

  const url = (data.url ?? "").trim();
  const urlCheck = validateWebhookUrl(url);
  if (!urlCheck.ok) return { ok: false, error: urlCheck.error };

  const events = (data.events ?? []).filter((e) => SUBSCRIBABLE_EVENTS.includes(e));

  const { cols } = await getSabsmsCollections();

  const updateDoc = {
    url,
    urlAlias: (data.urlAlias ?? "").trim(),
    events,
    updatedAt: new Date(),
  };

  if (data.id) {
    if (!ObjectId.isValid(data.id)) return { ok: false, error: "invalid id" };
    await cols.webhooksOut.updateOne(
      { _id: new ObjectId(data.id), workspaceId: ws.workspaceId },
      { $set: updateDoc }
    );
    revalidatePath("/sabsms/webhooks");
    return { ok: true, id: data.id };
  }

  const secret = mintWebhookSecret();
  const _id = new ObjectId();
  await cols.webhooksOut.insertOne({
    _id,
    workspaceId: ws.workspaceId,
    ...updateDoc,
    secret,
    isActive: true,
    createdAt: new Date(),
  } as never);

  revalidatePath("/sabsms/webhooks");
  // Secret is returned ONCE — the dashboard shows it in a copy-once panel.
  return { ok: true, id: _id.toHexString(), secret };
}

// ─── Deliveries (real rows from the dispatcher) ────────────────────────────

export interface WebhookDeliveryRow {
  id: string;
  webhookId: string;
  url: string;
  event: string;
  status: "pending" | "delivered" | "failed";
  attempts: number;
  lastStatusCode: number | null;
  lastError: string | null;
  createdAt: string;
  deliveredAt: string | null;
  nextAttemptAt: string | null;
  payloadPreview: string;
}

export async function loadDeliveries(input: {
  webhookId?: string;
  status?: string;
  limit?: number;
}): Promise<{ ok: true; rows: WebhookDeliveryRow[] } | { ok: false; error: string }> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;

  const { db } = await connectToDatabase();
  const filter: Record<string, unknown> = { workspaceId: ws.workspaceId };
  if (input.webhookId && ObjectId.isValid(input.webhookId)) filter.webhookId = input.webhookId;
  if (input.status && ["pending", "delivered", "failed"].includes(input.status)) {
    filter.status = input.status;
  }

  const docs = await db
    .collection<WebhookDeliveryDoc>(WEBHOOK_DELIVERIES_COLLECTION)
    .find(filter as never)
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(input.limit ?? 100, 1), 500))
    .toArray();

  // Join endpoint URLs for display (small set, single query).
  const { cols } = await getSabsmsCollections();
  const hookIds = [...new Set(docs.map((d) => d.webhookId))].filter((id) => ObjectId.isValid(id));
  const hooks = await cols.webhooksOut
    .find({ _id: { $in: hookIds.map((id) => new ObjectId(id)) }, workspaceId: ws.workspaceId })
    .project<{ _id: ObjectId; url: string }>({ url: 1 })
    .toArray();
  const urlById = new Map(hooks.map((h) => [h._id.toHexString(), h.url]));

  const rows: WebhookDeliveryRow[] = docs.map((d) => {
    const last = d.attempts && d.attempts.length > 0 ? d.attempts[d.attempts.length - 1] : null;
    let payloadPreview = "";
    try {
      payloadPreview = JSON.stringify(d.payload ?? {}, null, 2).slice(0, 2000);
    } catch {
      payloadPreview = "(unserialisable payload)";
    }
    return {
      id: d._id ? d._id.toHexString() : "",
      webhookId: d.webhookId,
      url: urlById.get(d.webhookId) ?? "(deleted endpoint)",
      event: d.event,
      status: d.status,
      attempts: d.attempts?.length ?? 0,
      lastStatusCode: last ? last.status || null : null,
      lastError: last?.error ?? null,
      createdAt: d.createdAt.toISOString(),
      deliveredAt: d.deliveredAt ? d.deliveredAt.toISOString() : null,
      nextAttemptAt: d.status === "pending" && d.wakeAt ? d.wakeAt.toISOString() : null,
      payloadPreview,
    };
  });

  return { ok: true, rows };
}

/**
 * Test-fire: enqueue a synthetic `ping` delivery for the endpoint and
 * run one delivery tick inline so the result is visible immediately
 * (the exact production code path — signature, retries and all).
 */
export async function testFireEndpoint(id: string): Promise<WebhookActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(id)) return { ok: false, error: "invalid id" };

  const { cols } = await getSabsmsCollections();
  const hook = await cols.webhooksOut.findOne({
    _id: new ObjectId(id),
    workspaceId: ws.workspaceId,
  });
  if (!hook) return { ok: false, error: "endpoint not found" };

  const { db } = await connectToDatabase();
  const now = new Date();
  const deliveryId = new ObjectId();
  await db.collection<WebhookDeliveryDoc>(WEBHOOK_DELIVERIES_COLLECTION).insertOne({
    _id: deliveryId,
    workspaceId: ws.workspaceId,
    webhookId: id,
    event: "ping",
    payload: {
      workspaceId: ws.workspaceId,
      message: "SabSMS webhook test fire",
      firedAt: now.toISOString(),
    },
    attempts: [],
    status: "pending",
    createdAt: now,
    wakeAt: now,
    eventAt: now.getTime(),
    sourceEventId: `ping:${deliveryId.toHexString()}`,
  });

  const tick = await tickWebhookDeliveries({ db });
  revalidatePath("/sabsms/webhooks");
  if (tick.delivered > 0) return { ok: true, id: deliveryId.toHexString() };
  return {
    ok: false,
    error: "Ping enqueued but the first attempt did not return 2xx — check the deliveries log.",
  };
}

/** Replay: re-enqueue a delivery (history kept) and tick once inline. */
export async function replayDelivery(deliveryId: string): Promise<WebhookActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(deliveryId)) return { ok: false, error: "invalid id" };

  const { db } = await connectToDatabase();
  const res = await db.collection<WebhookDeliveryDoc>(WEBHOOK_DELIVERIES_COLLECTION).updateOne(
    { _id: new ObjectId(deliveryId), workspaceId: ws.workspaceId },
    { $set: { status: "pending", wakeAt: new Date() } }
  );
  if (res.matchedCount === 0) return { ok: false, error: "delivery not found" };

  await tickWebhookDeliveries({ db });
  revalidatePath("/sabsms/webhooks");
  return { ok: true, id: deliveryId };
}
