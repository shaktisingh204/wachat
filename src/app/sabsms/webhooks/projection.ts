import type { ObjectId } from "mongodb";
import type { SabsmsWebhookOut } from "@/lib/sabsms/types";

export interface WebhookDocExt extends SabsmsWebhookOut {
  _id: ObjectId;
  lastDeliveryStatus?: "delivered" | "failed" | "pending";
  hmacAlgorithm?: string;
  urlAlias?: string;
}

export interface WebhookRow {
  id: string;
  url: string;
  urlAlias: string;
  isActive: boolean;
  events: string[];
  lastDeliveryStatus: "delivered" | "failed" | "pending" | "unknown";
  hmacAlgorithm: string;
  createdAt: string;
  updatedAt: string;
}

export function projectWebhook(doc: WebhookDocExt): WebhookRow {
  return {
    id: doc._id.toString(),
    url: doc.url,
    urlAlias: doc.urlAlias || "",
    isActive: doc.isActive,
    events: doc.events || [],
    lastDeliveryStatus: doc.lastDeliveryStatus ?? "unknown",
    hmacAlgorithm: doc.hmacAlgorithm ?? "sha256",
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
