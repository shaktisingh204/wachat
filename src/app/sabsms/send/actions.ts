"use server";

import { getCachedSession } from "@/lib/server-cache";
import {
  sabsmsEngine,
  SabsmsEngineError,
} from "@/lib/sabsms/engine-client";
import type {
  SabsmsMessage,
  SabsmsMessageCategory,
  SabsmsMessageStatus,
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

export async function submitSend(input: SubmitInput): Promise<SubmitResult> {
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
      eventKey: "sabsms.send.composer",
    });
    return { ok: true, id: res.id, status: res.status };
  } catch (e) {
    if (e instanceof SabsmsEngineError) {
      return { ok: false, error: `${e.status} ${e.message}` };
    }
    return { ok: false, error: (e as Error)?.message ?? "send failed" };
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
