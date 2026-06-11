import 'server-only';

/**
 * SabBigin in-app notifications. Thin wrappers over the shared CRM
 * notification helper (`src/lib/notifications/crm.ts` → `notify()` →
 * `crm_notifications` + realtime push).
 */
import { fireCrmNotification } from '@/lib/notifications/crm';

export async function notifyDealApprovalRequested(input: {
  approverIds: string[];
  dealName: string;
  toStage: string;
  approvalId: string;
}): Promise<void> {
  await Promise.all(
    input.approverIds.map((recipientUserId) =>
      fireCrmNotification({
        recipientUserId,
        type: 'deal_assigned',
        title: `Approval needed: ${input.dealName}`,
        body: `Approve moving this deal to “${input.toStage}”.`,
        resourceType: 'deal',
        resourceId: input.approvalId,
      }).catch(() => false),
    ),
  );
}

export async function notifyDealApprovalDecided(input: {
  recipientUserId: string;
  dealName: string;
  toStage: string;
  approved: boolean;
  dealId: string;
}): Promise<void> {
  await fireCrmNotification({
    recipientUserId: input.recipientUserId,
    type: 'deal_assigned',
    title: `${input.approved ? 'Approved' : 'Rejected'}: ${input.dealName}`,
    body: input.approved
      ? `Your request to move the deal to “${input.toStage}” was approved.`
      : `Your request to move the deal to “${input.toStage}” was rejected.`,
    resourceType: 'deal',
    resourceId: input.dealId,
  }).catch(() => false);
}
