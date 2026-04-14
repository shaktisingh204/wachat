import type { ObjectId } from 'mongodb';

/**
 * Worksuite GDPR / Purpose Consent / Removal Request types — ported
 * from the PHP/Laravel models:
 *   GdprSetting, PurposeConsent, PurposeConsentLead, PurposeConsentUser,
 *   RemovalRequest, RemovalRequestLead.
 *
 * Every record carries `userId` for tenant isolation. GDPR settings are
 * a singleton-per-tenant document.
 *
 * Collections:
 *   crm_gdpr_settings, crm_purpose_consents,
 *   crm_purpose_consent_leads, crm_purpose_consent_users,
 *   crm_removal_requests, crm_removal_request_leads.
 */

type Owned = {
  _id: ObjectId;
  userId: ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};

export type WsGdprSetting = Owned & {
  enable_gdpr?: boolean;
  show_cookie_consent?: boolean;
  cookie_message?: string;
  accept_cookie_btn_text?: string;
  decline_cookie_btn_text?: string;
  privacy_policy_url?: string;
  enable_consent_logs?: boolean;
  enable_right_to_be_forgotten?: boolean;
  enable_data_portability?: boolean;
  retention_period_days?: number;
  data_controller_name?: string;
  data_controller_email?: string;
};

export type WsConsentAppliesTo = 'lead' | 'user' | 'both';

export type WsPurposeConsent = Owned & {
  title: string;
  description?: string;
  is_required?: boolean;
  is_active?: boolean;
  applies_to?: WsConsentAppliesTo;
  sort_order?: number;
};

export type WsPurposeConsentLead = Owned & {
  lead_id: string;
  purpose_consent_id: string;
  granted?: boolean;
  granted_at?: Date;
  ip_address?: string;
  user_agent?: string;
};

export type WsPurposeConsentUser = Owned & {
  target_user_id: string;
  purpose_consent_id: string;
  granted?: boolean;
  granted_at?: Date;
  ip_address?: string;
  user_agent?: string;
};

export type WsRemovalRequestType = 'user' | 'lead';
export type WsRemovalRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'completed';

export type WsRemovalRequest = Owned & {
  user_id?: string;
  request_type: WsRemovalRequestType;
  status: WsRemovalRequestStatus;
  reason?: string;
  submitted_at?: Date;
  handled_at?: Date;
  handled_by_user_id?: string;
  notes?: string;
};

export type WsRemovalRequestLead = Owned & {
  lead_id?: string;
  requester_email?: string;
  status: WsRemovalRequestStatus;
  reason?: string;
  submitted_at?: Date;
  handled_at?: Date;
};
