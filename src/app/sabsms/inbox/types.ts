/**
 * SabSMS inbox — local view-model shapes.
 *
 * The canonical document types live in `@/lib/sabsms/types`. These are
 * the wire-friendly DTOs the inbox page passes between server actions
 * and the client panes. Mongo ObjectIds become strings here; Dates
 * become ISO strings.
 */

import type {
  SabsmsConversationStatus,
  SabsmsDirection,
  SabsmsMessageStatus,
} from "@/lib/sabsms/types";

export interface InboxConversationView {
  id: string;
  contactId: string;
  contactPhone?: string;
  status: SabsmsConversationStatus;
  unreadCount: number;
  assignedAgentId?: string | null;
  labels: string[];
  lastMessagePreview?: string;
  lastMessageAt?: string;
  snoozedUntil?: string;
  firstResponseAt?: string;
  createdAt?: string;
}

export interface InboxMessageView {
  id: string;
  direction: SabsmsDirection;
  from: string;
  to: string;
  body: string;
  status: SabsmsMessageStatus;
  mediaIds: string[];
  reactions: string[];
  isNote: boolean;
  createdAt?: string;
  sentAt?: string;
  deliveredAt?: string;
  errorMessage?: string;
}

export interface InboxThreadView {
  conversation: InboxConversationView;
  messages: InboxMessageView[];
}

export interface InboxAgent {
  id: string;
  name: string;
}

export interface InboxTemplateView {
  id: string;
  name: string;
  body: string;
}

export interface InboxFilters {
  q?: string;
  scope?: "all" | "mine" | "unassigned" | "closed" | "snoozed";
  status?: string[];
  assignee?: string[];
  labels?: string[];
  sort?: "newest" | "oldest" | "unread";
  from?: string;
  to?: string;
}

export interface SlaState {
  /** Milliseconds until breach. Negative if already breached. */
  firstResponseRemainingMs: number | null;
  resolutionRemainingMs: number | null;
  firstResponseBreached: boolean;
  resolutionBreached: boolean;
}
