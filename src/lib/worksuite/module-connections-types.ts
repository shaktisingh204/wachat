import type { ObjectId } from 'mongodb';

/**
 * CRM ↔ SabNode-module connections.
 *
 * Replaces Worksuite's "enter the same credentials again" approach for
 * a handful of integrations whose functionality is already implemented
 * by another SabNode module (email, sms, sabfiles, ad-manager). The CRM
 * doesn't re-implement SMTP, R2, etc. — it *binds* to the existing
 * module and stores the binding here.
 *
 * Collection: `crm_module_connections` (one doc per tenant + moduleKey).
 */

export type CrmConnectionModuleKey =
  | 'storage'
  | 'smtp'
  | 'email-notifications'
  | 'ticket-email'
  | 'facebook-ads'
  | 'message-settings';

export type CrmConnectionStatus = 'disconnected' | 'connected';

export interface CrmModuleConnection {
  _id: ObjectId;
  userId: ObjectId;
  moduleKey: CrmConnectionModuleKey;
  status: CrmConnectionStatus;
  /**
   * Per-module config blob. Shape depends on `moduleKey`:
   *
   * storage:              { rootFolderId, autoOrganize }
   * smtp:                 { senderIdentityId, fromAddress }
   * email-notifications:  { events: Record<string, { enabled: boolean; templateId?: string }> }
   * ticket-email:         { inboxId, defaultCategoryId?, defaultAssigneeId? }
   * facebook-ads:         { adAccountId, leadFormIds: string[], defaultPipelineId?, defaultStageId? }
   * message-settings:     { smsConfigId, triggers: Record<string, boolean> }
   */
  config: Record<string, any>;
  connectedAt?: Date;
  disconnectedAt?: Date;
  lastTestedAt?: Date;
  lastTestResult?: 'success' | 'failure';
  lastTestError?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrmModuleConnectionDTO {
  _id: string;
  moduleKey: CrmConnectionModuleKey;
  status: CrmConnectionStatus;
  config: Record<string, any>;
  connectedAt?: string;
  disconnectedAt?: string;
  lastTestedAt?: string;
  lastTestResult?: 'success' | 'failure';
  lastTestError?: string;
  createdAt: string;
  updatedAt: string;
}
