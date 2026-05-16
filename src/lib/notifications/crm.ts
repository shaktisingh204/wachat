import 'server-only';

/**
 * CRM-specific notification helpers (CRM_REBUILD_PLAN §5.3).
 *
 * Thin wrappers over the existing `notify()` action in
 * `src/app/actions/worksuite/chat.actions.ts`. Provides typed builders
 * for the common notification cases so CRM action layers don't have to
 * construct payloads inline.
 *
 * Every helper is **best-effort**: failures are swallowed (logged) so a
 * notification glitch never blocks the underlying mutation.
 */

import { notify } from '@/app/actions/worksuite/chat.actions';

export type CrmNotificationType =
  | 'lead_assigned'
  | 'lead_status_changed'
  | 'deal_assigned'
  | 'deal_stage_changed'
  | 'task_assigned'
  | 'task_due_soon'
  | 'ticket_assigned'
  | 'ticket_sla_breach'
  | 'ticket_status_changed'
  | 'invoice_paid'
  | 'invoice_overdue'
  | 'subscription_failed'
  | 'subscription_renewed'
  | 'mention'
  | 'system';

export type CrmResourceType =
  | 'lead'
  | 'deal'
  | 'task'
  | 'ticket'
  | 'invoice'
  | 'quotation'
  | 'subscription'
  | 'account'
  | 'contact'
  | 'employee';

export interface CrmNotificationInput {
  recipientUserId: string;
  type: CrmNotificationType;
  title: string;
  body?: string;
  resourceType?: CrmResourceType;
  resourceId?: string;
}

/**
 * Low-level: fire one notification. Returns true on success, false on
 * any failure (does NOT throw). Use the typed helpers below where one
 * fits — those produce consistent titles/bodies across the codebase.
 */
export async function fireCrmNotification(
  input: CrmNotificationInput,
): Promise<boolean> {
  if (!input.recipientUserId) return false;
  try {
    const res = await notify(input.recipientUserId, {
      type: input.type,
      title: input.title,
      body: input.body,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
    });
    return !('error' in res && res.error);
  } catch (e) {
    console.error('[fireCrmNotification] failed:', e);
    return false;
  }
}

/* ─── Typed helpers ────────────────────────────────────────────── */

export interface LeadAssignedInput {
  recipientUserId: string;
  leadId: string;
  leadName: string;
  assignedByName?: string;
}

export function notifyLeadAssigned(input: LeadAssignedInput): Promise<boolean> {
  return fireCrmNotification({
    recipientUserId: input.recipientUserId,
    type: 'lead_assigned',
    title: `Lead assigned: ${input.leadName}`,
    body: input.assignedByName
      ? `${input.assignedByName} assigned this lead to you.`
      : undefined,
    resourceType: 'lead',
    resourceId: input.leadId,
  });
}

export interface DealAssignedInput {
  recipientUserId: string;
  dealId: string;
  dealName: string;
  amount?: number;
  currency?: string;
  assignedByName?: string;
}

export function notifyDealAssigned(input: DealAssignedInput): Promise<boolean> {
  const amount =
    typeof input.amount === 'number'
      ? new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: input.currency ?? 'INR',
          maximumFractionDigits: 0,
        }).format(input.amount)
      : undefined;
  return fireCrmNotification({
    recipientUserId: input.recipientUserId,
    type: 'deal_assigned',
    title: `Deal assigned: ${input.dealName}`,
    body: amount ? `Worth ${amount}.` : input.assignedByName ? `Assigned by ${input.assignedByName}.` : undefined,
    resourceType: 'deal',
    resourceId: input.dealId,
  });
}

export interface TaskAssignedInput {
  recipientUserId: string;
  taskId: string;
  taskTitle: string;
  dueAt?: Date | string;
}

export function notifyTaskAssigned(input: TaskAssignedInput): Promise<boolean> {
  const due = input.dueAt
    ? new Date(input.dueAt).toLocaleDateString()
    : undefined;
  return fireCrmNotification({
    recipientUserId: input.recipientUserId,
    type: 'task_assigned',
    title: `Task assigned: ${input.taskTitle}`,
    body: due ? `Due ${due}.` : undefined,
    resourceType: 'task',
    resourceId: input.taskId,
  });
}

export interface TicketAssignedInput {
  recipientUserId: string;
  ticketId: string;
  ticketSubject: string;
  priority?: string;
}

export function notifyTicketAssigned(
  input: TicketAssignedInput,
): Promise<boolean> {
  return fireCrmNotification({
    recipientUserId: input.recipientUserId,
    type: 'ticket_assigned',
    title: `Ticket assigned: ${input.ticketSubject}`,
    body: input.priority ? `Priority ${input.priority}.` : undefined,
    resourceType: 'ticket',
    resourceId: input.ticketId,
  });
}

export interface SlaBreachInput {
  recipientUserId: string;
  ticketId: string;
  ticketSubject: string;
  /** "first_response" | "resolution" */
  breachType: string;
  overdueMinutes: number;
}

export function notifySlaBreach(input: SlaBreachInput): Promise<boolean> {
  return fireCrmNotification({
    recipientUserId: input.recipientUserId,
    type: 'ticket_sla_breach',
    title: `SLA breach: ${input.ticketSubject}`,
    body: `${input.breachType} SLA overdue by ${input.overdueMinutes} min.`,
    resourceType: 'ticket',
    resourceId: input.ticketId,
  });
}

export interface InvoicePaidInput {
  recipientUserId: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  currency?: string;
}

export function notifyInvoicePaid(input: InvoicePaidInput): Promise<boolean> {
  const amount = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: input.currency ?? 'INR',
    maximumFractionDigits: 2,
  }).format(input.amount);
  return fireCrmNotification({
    recipientUserId: input.recipientUserId,
    type: 'invoice_paid',
    title: `Invoice paid: ${input.invoiceNumber}`,
    body: `Received ${amount}.`,
    resourceType: 'invoice',
    resourceId: input.invoiceId,
  });
}

export interface InvoiceOverdueInput {
  recipientUserId: string;
  invoiceId: string;
  invoiceNumber: string;
  daysOverdue: number;
  amount?: number;
  currency?: string;
}

export function notifyInvoiceOverdue(
  input: InvoiceOverdueInput,
): Promise<boolean> {
  const amount =
    typeof input.amount === 'number'
      ? new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: input.currency ?? 'INR',
          maximumFractionDigits: 0,
        }).format(input.amount)
      : undefined;
  return fireCrmNotification({
    recipientUserId: input.recipientUserId,
    type: 'invoice_overdue',
    title: `Invoice overdue: ${input.invoiceNumber}`,
    body: amount
      ? `${input.daysOverdue}d overdue · ${amount} outstanding.`
      : `${input.daysOverdue}d overdue.`,
    resourceType: 'invoice',
    resourceId: input.invoiceId,
  });
}

export interface SubscriptionFailedInput {
  recipientUserId: string;
  subscriptionId: string;
  planName: string;
  reason?: string;
}

export function notifySubscriptionFailed(
  input: SubscriptionFailedInput,
): Promise<boolean> {
  return fireCrmNotification({
    recipientUserId: input.recipientUserId,
    type: 'subscription_failed',
    title: `Subscription payment failed: ${input.planName}`,
    body: input.reason,
    resourceType: 'subscription',
    resourceId: input.subscriptionId,
  });
}

/**
 * Bulk variant — same payload, many recipients (e.g. team-wide SLA alert).
 * Returns the count of successful sends.
 */
export async function fireCrmNotificationToMany(
  recipientUserIds: string[],
  payload: Omit<CrmNotificationInput, 'recipientUserId'>,
): Promise<number> {
  let n = 0;
  for (const rid of recipientUserIds) {
    const ok = await fireCrmNotification({ ...payload, recipientUserId: rid });
    if (ok) n += 1;
  }
  return n;
}
