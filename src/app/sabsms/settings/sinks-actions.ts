"use server";

/**
 * SabSMS v3.7 — Event Streams / Sinks management.
 *
 * CRUD for `sabsms_event_sinks` (where a workspace streams its SabSMS
 * events). HTTP-delivered kinds get a minted HMAC secret shown ONCE on
 * create and never returned again. RBAC-gated on `sabsms_settings`.
 */

import { randomBytes } from "node:crypto";

import { ObjectId } from "mongodb";

import { getSabsmsWorkspaceId } from "@/lib/sabsms/workspace";
import { requirePermission } from "@/lib/rbac-server";
import { getSabsmsCollections } from "@/lib/sabsms/db/collections";
import { isHttpSink } from "@/lib/sabsms/sinks/sinks-core";
import type { SabsmsEventSink, SabsmsEventSinkKind } from "@/lib/sabsms/types";

const KINDS: SabsmsEventSinkKind[] = ["webhook", "http_batch", "kafka", "kinesis", "segment"];

/** What the client sees — never the secret. */
export interface PublicSink {
  id: string;
  kind: SabsmsEventSinkKind;
  events: string[];
  enabled: boolean;
  endpoint: string;
  hasSecret: boolean;
}

function endpointOf(sink: Pick<SabsmsEventSink, "kind" | "config">): string {
  const c = sink.config ?? {};
  if (isHttpSink(sink.kind)) return typeof c.url === "string" ? c.url : "";
  if (sink.kind === "kafka") return [c.brokers, c.topic].filter(Boolean).join(" / ");
  if (sink.kind === "kinesis") return [c.region, c.stream].filter(Boolean).join(" / ");
  return "";
}

function toPublic(sink: SabsmsEventSink): PublicSink {
  return {
    id: String(sink._id),
    kind: sink.kind,
    events: sink.events,
    enabled: sink.enabled,
    endpoint: endpointOf(sink),
    hasSecret: Boolean(sink.secret),
  };
}

export type ListSinksResult =
  | { success: true; sinks: PublicSink[] }
  | { success: false; error: string };

export async function listSinksAction(): Promise<ListSinksResult> {
  const workspaceId = await getSabsmsWorkspaceId();
  if (!workspaceId) return { success: false, error: "Unauthorized" };
  const perm = await requirePermission("sabsms_settings", "view", workspaceId);
  if (!perm.ok) return { success: false, error: perm.error };

  const { cols } = await getSabsmsCollections();
  const docs = await cols.eventSinks.find({ workspaceId }).sort({ createdAt: -1 }).toArray();
  return { success: true, sinks: docs.map(toPublic) };
}

export interface CreateSinkInput {
  kind: SabsmsEventSinkKind;
  events: string[];
  /** For HTTP kinds. */
  url?: string;
  /** For streaming kinds (kafka/kinesis). */
  config?: Record<string, string>;
}

export type CreateSinkResult =
  | { success: true; sink: PublicSink; secret?: string }
  | { success: false; error: string };

export async function createSinkAction(input: CreateSinkInput): Promise<CreateSinkResult> {
  const workspaceId = await getSabsmsWorkspaceId();
  if (!workspaceId) return { success: false, error: "Unauthorized" };
  const perm = await requirePermission("sabsms_settings", "edit", workspaceId);
  if (!perm.ok) return { success: false, error: perm.error };

  if (!KINDS.includes(input.kind)) return { success: false, error: "Unknown sink kind." };

  const isHttp = isHttpSink(input.kind);
  let config: Record<string, unknown>;
  if (isHttp) {
    const url = (input.url ?? "").trim();
    if (!/^https:\/\//i.test(url)) {
      return { success: false, error: "HTTP sinks require an https:// URL." };
    }
    config = { url };
  } else {
    config = input.config ?? {};
  }

  const events = Array.from(
    new Set((input.events ?? []).map((e) => e.trim()).filter(Boolean)),
  );
  const secret = isHttp ? `whsec_${randomBytes(24).toString("hex")}` : undefined;
  const now = new Date();
  const doc: SabsmsEventSink = {
    workspaceId,
    kind: input.kind,
    events,
    enabled: true,
    secret,
    config,
    createdAt: now,
    updatedAt: now,
  };

  const { cols } = await getSabsmsCollections();
  const res = await cols.eventSinks.insertOne(doc);
  return {
    success: true,
    sink: toPublic({ ...doc, _id: res.insertedId }),
    secret,
  };
}

export type MutateSinkResult = { success: true } | { success: false; error: string };

async function ownedSink(workspaceId: string, id: string) {
  if (!ObjectId.isValid(id)) return null;
  const { cols } = await getSabsmsCollections();
  return cols.eventSinks.findOne({ _id: new ObjectId(id), workspaceId });
}

export async function setSinkEnabledAction(id: string, enabled: boolean): Promise<MutateSinkResult> {
  const workspaceId = await getSabsmsWorkspaceId();
  if (!workspaceId) return { success: false, error: "Unauthorized" };
  const perm = await requirePermission("sabsms_settings", "edit", workspaceId);
  if (!perm.ok) return { success: false, error: perm.error };
  const sink = await ownedSink(workspaceId, id);
  if (!sink) return { success: false, error: "Sink not found." };

  const { cols } = await getSabsmsCollections();
  await cols.eventSinks.updateOne(
    { _id: sink._id, workspaceId },
    { $set: { enabled, updatedAt: new Date() } },
  );
  return { success: true };
}

export async function deleteSinkAction(id: string): Promise<MutateSinkResult> {
  const workspaceId = await getSabsmsWorkspaceId();
  if (!workspaceId) return { success: false, error: "Unauthorized" };
  const perm = await requirePermission("sabsms_settings", "edit", workspaceId);
  if (!perm.ok) return { success: false, error: perm.error };
  const sink = await ownedSink(workspaceId, id);
  if (!sink) return { success: false, error: "Sink not found." };

  const { cols } = await getSabsmsCollections();
  await cols.eventSinks.deleteOne({ _id: sink._id, workspaceId });
  return { success: true };
}
