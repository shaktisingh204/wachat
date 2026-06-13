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
  /** V2.12 — AI agent suggested reply (suggest mode), shown above the composer. */
  aiSuggestion?: {
    body: string;
    at?: string;
    inboundMessageId?: string;
  };
  /** V2.12 — AI pipeline flags (guardrail + handoff badges). */
  aiFlags?: {
    possibleOptOut?: boolean;
    handoff?: boolean;
  };
}

/** V2.12 — conversation-insights strip on the inbox page. */
export interface InboxInsightTopic {
  label: string;
  count: number;
  sentiment: "positive" | "neutral" | "negative";
  trend: "up" | "down" | "flat" | "new";
}

export interface InboxInsightsView {
  topics: InboxInsightTopic[];
  totalConversations: number;
  computedAt?: string;
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
  errorCode?: string;
  errorMessage?: string;
  /** V2.11 — channel that actually carried the message ('rcs' / 'sms'). */
  channelUsed?: string;
  /** V2.11 — outbound RCS card + suggestion chips, when present. */
  rcs?: {
    card?: { title: string; description: string; mediaUrl?: string };
    suggestions: Array<
      | { kind: "reply"; text: string; postbackData: string }
      | { kind: "openUrl"; text: string; url: string }
      | { kind: "dial"; text: string; phone: string }
    >;
    fallbackText: string;
  };
  /** V2.11 — true when an rcs_preferred send fell back to SMS. */
  rcsFallback?: boolean;
  /** V2.11 — inbound suggestion-tap postback data. */
  postbackData?: string;
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
