import type { ObjectId } from "mongodb";
import type { SabsmsWebhookOut } from "@/lib/sabsms/types";

export interface WebhookDocExt extends SabsmsWebhookOut {
  _id: ObjectId;
  urlAlias?: string;
}

export interface WebhookRow {
  id: string;
  url: string;
  urlAlias: string;
  isActive: boolean;
  events: string[];
  createdAt: string;
  updatedAt: string;
}

export function projectWebhook(doc: WebhookDocExt): WebhookRow {
  return {
    id: doc._id.toString(),
    url: doc.url,
    urlAlias: doc.urlAlias || "",
    isActive: doc.isActive,
    // Empty filter = subscribed to everything (dispatcher semantics).
    events: doc.events || [],
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
