import 'server-only';

/**
 * Default event subscriber: bridges relevant CRM events to the
 * notification fan-out helpers in `@/lib/notifications/crm`.
 *
 * Wire this once on module init (currently called lazily — see
 * `installNotificationBridgeOnce()`). New subscribers can be added in
 * separate modules without disturbing this one.
 */

import {
  notifyLeadAssigned,
  notifyDealAssigned,
  notifyTaskAssigned,
  notifyTicketAssigned,
  notifySlaBreach,
  notifyInvoicePaid,
  notifyInvoiceOverdue,
  notifySubscriptionFailed,
} from '@/lib/notifications/crm';
import { subscribeCrmEvent, type CrmEvent } from './bus';

interface AssignedPayload {
  recipientUserId?: string;
  resourceTitle?: string;
  assignedByName?: string;
  amount?: number;
  currency?: string;
  dueAt?: string;
  priority?: string;
}

let installed = false;

export function installNotificationBridgeOnce(): void {
  if (installed) return;
  installed = true;

  subscribeCrmEvent('lead.assigned', (e: CrmEvent) => {
    const p = e.payload as AssignedPayload;
    if (!p.recipientUserId || !e.resourceId) return;
    void notifyLeadAssigned({
      recipientUserId: p.recipientUserId,
      leadId: e.resourceId,
      leadName: p.resourceTitle ?? 'New lead',
      assignedByName: p.assignedByName,
    });
  });

  subscribeCrmEvent('deal.created', () => {
    /* hook reserved for owner ack — needs owner lookup off payload */
  });

  subscribeCrmEvent('task.assigned', (e: CrmEvent) => {
    const p = e.payload as AssignedPayload;
    if (!p.recipientUserId || !e.resourceId) return;
    void notifyTaskAssigned({
      recipientUserId: p.recipientUserId,
      taskId: e.resourceId,
      taskTitle: p.resourceTitle ?? 'New task',
      dueAt: p.dueAt,
    });
  });

  subscribeCrmEvent('ticket.assigned', (e: CrmEvent) => {
    const p = e.payload as AssignedPayload;
    if (!p.recipientUserId || !e.resourceId) return;
    void notifyTicketAssigned({
      recipientUserId: p.recipientUserId,
      ticketId: e.resourceId,
      ticketSubject: p.resourceTitle ?? 'New ticket',
      priority: p.priority,
    });
  });

  interface SlaPayload {
    recipientUserId?: string;
    resourceTitle?: string;
    breachType?: string;
    overdueMinutes?: number;
  }
  subscribeCrmEvent('ticket.sla_breach', (e: CrmEvent) => {
    const p = e.payload as SlaPayload;
    if (!p.recipientUserId || !e.resourceId) return;
    void notifySlaBreach({
      recipientUserId: p.recipientUserId,
      ticketId: e.resourceId,
      ticketSubject: p.resourceTitle ?? 'Ticket',
      breachType: p.breachType ?? 'sla',
      overdueMinutes: p.overdueMinutes ?? 0,
    });
  });

  interface InvoicePaidPayload {
    recipientUserId?: string;
    invoiceNumber?: string;
    amount?: number;
    currency?: string;
  }
  subscribeCrmEvent('invoice.paid', (e: CrmEvent) => {
    const p = e.payload as InvoicePaidPayload;
    if (!p.recipientUserId || !e.resourceId || typeof p.amount !== 'number') return;
    void notifyInvoicePaid({
      recipientUserId: p.recipientUserId,
      invoiceId: e.resourceId,
      invoiceNumber: p.invoiceNumber ?? 'INV',
      amount: p.amount,
      currency: p.currency,
    });
  });

  interface InvoiceOverduePayload {
    recipientUserId?: string;
    invoiceNumber?: string;
    daysOverdue?: number;
    amount?: number;
    currency?: string;
  }
  subscribeCrmEvent('invoice.overdue', (e: CrmEvent) => {
    const p = e.payload as InvoiceOverduePayload;
    if (!p.recipientUserId || !e.resourceId) return;
    void notifyInvoiceOverdue({
      recipientUserId: p.recipientUserId,
      invoiceId: e.resourceId,
      invoiceNumber: p.invoiceNumber ?? 'INV',
      daysOverdue: p.daysOverdue ?? 0,
      amount: p.amount,
      currency: p.currency,
    });
  });

  interface SubscriptionFailedPayload {
    recipientUserId?: string;
    planName?: string;
    reason?: string;
  }
  subscribeCrmEvent('subscription.failed', (e: CrmEvent) => {
    const p = e.payload as SubscriptionFailedPayload;
    if (!p.recipientUserId || !e.resourceId) return;
    void notifySubscriptionFailed({
      recipientUserId: p.recipientUserId,
      subscriptionId: e.resourceId,
      planName: p.planName ?? 'Subscription',
      reason: p.reason,
    });
  });

  // Mention deal_assigned wiring once payload schema includes amount.
  void notifyDealAssigned;
}

/**
 * Test-only — flip the install latch so the bridge can be re-installed
 * inside a fresh subscription list during unit tests.
 */
export function _resetNotificationBridgeInstall(): void {
  installed = false;
}
