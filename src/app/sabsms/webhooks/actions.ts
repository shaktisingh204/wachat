"use server";

import { ObjectId, type Filter } from "mongodb";
import { revalidatePath } from "next/cache";

import { getCachedSession } from "@/lib/server-cache";
import { getSabsmsCollections } from "@/lib/sabsms/db/collections";
import type { SabsmsWebhookOut } from "@/lib/sabsms/types";

import { projectWebhook, type WebhookDocExt, type WebhookRow } from "./projection";

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
  return { ok: true, workspaceId: String(userId) };
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
    (filter as any).$or = [{ url: rx }, { urlAlias: rx }];
  }

  const docs = (await cols.webhooksOut
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(500)
    .toArray()) as unknown as WebhookDocExt[];

  return docs.map(projectWebhook);
}

export type WebhookActionResult = { ok: true; id?: string } | { ok: false; error: string };

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

export async function rotateSecret(id: string): Promise<WebhookActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!ObjectId.isValid(id)) return { ok: false, error: "invalid id" };

  const newSecret = "whsec_" + Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString('base64url');

  const { cols } = await getSabsmsCollections();
  await cols.webhooksOut.updateOne(
    { _id: new ObjectId(id), workspaceId: ws.workspaceId },
    { $set: { secret: newSecret, updatedAt: new Date() } }
  );
  revalidatePath("/sabsms/webhooks");
  return { ok: true };
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

export async function testFireEndpoint(id: string): Promise<WebhookActionResult> {
  // Mock action for feature 4
  return { ok: true };
}

export async function replayEvents(id: string, count: number): Promise<WebhookActionResult> {
  // Mock action for feature 10
  return { ok: true };
}

export interface WebhookFormData {
  id?: string;
  url: string;
  urlAlias: string;
  hmacAlgorithm: string;
  events: string[];
  retryConfig: {
    maxRetries: number;
    backoffStrategy: "exponential" | "linear" | "fixed";
    baseDelayMs: number;
  };
  dlqUrl: string;
  skipValidation: boolean;
}

export async function saveWebhook(data: WebhookFormData): Promise<WebhookActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;

  if (!data.url) return { ok: false, error: "URL is required" };

  if (!data.skipValidation) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // Generous timeout for slow servers
      
      const res = await fetch(data.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "ping" }),
        signal: controller.signal,
      }).catch(err => {
        if (err.name === 'AbortError') {
          throw new Error("Validation timed out. The server might be too slow. Try skipping validation.");
        }
        throw err;
      });
      
      clearTimeout(timeoutId);
      if (!res.ok) {
        return { ok: false, error: `Endpoint validation failed with status ${res.status}` };
      }
    } catch (err: any) {
      return { ok: false, error: `Endpoint validation failed: ${err.message || err}` };
    }
  }

  const { cols } = await getSabsmsCollections();
  
  const updateDoc = {
    url: data.url,
    urlAlias: data.urlAlias,
    hmacAlgorithm: data.hmacAlgorithm,
    events: data.events,
    retryConfig: data.retryConfig,
    dlqUrl: data.dlqUrl,
    updatedAt: new Date(),
  };

  if (data.id) {
    if (!ObjectId.isValid(data.id)) return { ok: false, error: "invalid id" };
    await cols.webhooksOut.updateOne(
      { _id: new ObjectId(data.id), workspaceId: ws.workspaceId },
      { $set: updateDoc }
    );
  } else {
    const newSecret = "whsec_" + Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString('base64url');
    await cols.webhooksOut.insertOne({
      workspaceId: ws.workspaceId,
      ...updateDoc,
      secret: newSecret,
      isActive: true,
      createdAt: new Date(),
    } as any);
  }

  revalidatePath("/sabsms/webhooks");
  return { ok: true };
}
