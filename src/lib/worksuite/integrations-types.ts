import type { ObjectId } from 'mongodb';

/**
 * Worksuite 3rd-party integration settings — ported from PHP/Laravel
 * models under `app/Models/*Setting.php`. Each setting is a singleton
 * document per tenant (keyed by `userId`).
 *
 * Collections:
 *   crm_slack_settings
 *   crm_pusher_settings
 *   crm_quickbooks_settings
 *   crm_smtp_settings
 *   crm_google_calendar_settings
 *   crm_email_notification_settings
 *   crm_push_notification_settings
 *   crm_storage_settings
 *   crm_social_auth_settings
 *   crm_message_settings
 *   crm_ticket_email_settings
 */

type Owned = {
  _id: ObjectId;
  userId: ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};

/* ── Slack ───────────────────────────────────────────────────────── */
export interface WsSlackSetting extends Owned {
  webhook_url?: string;
  channel?: string;
  username?: string;
  is_active?: boolean;
}

/* ── Pusher ──────────────────────────────────────────────────────── */
export interface WsPusherSetting extends Owned {
  app_id?: string;
  app_key?: string;
  app_secret?: string;
  cluster?: string;
  is_active?: boolean;
}

/* ── QuickBooks ─────────────────────────────────────────────────── */
export type WsQuickBooksEnv = 'sandbox' | 'production';

export interface WsQuickBooksSetting extends Owned {
  client_id?: string;
  client_secret?: string;
  redirect_uri?: string;
  access_token?: string;
  refresh_token?: string;
  realm_id?: string;
  environment?: WsQuickBooksEnv;
  last_synced_at?: Date | string | null;
}

/* ── SMTP ────────────────────────────────────────────────────────── */
export interface WsSmtpSetting extends Owned {
  mail_driver?: string;
  host?: string;
  port?: string;
  username?: string;
  password?: string;
  encryption?: string;
  from_email?: string;
  from_name?: string;
  verified?: boolean;
}

/* ── Google Calendar ─────────────────────────────────────────────── */
export interface WsGoogleCalendarSetting extends Owned {
  client_id?: string;
  client_secret?: string;
  redirect_uri?: string;
  enabled?: boolean;
}

/* ── Email Notification (20 toggles) ─────────────────────────────── */
export interface WsEmailNotificationSetting extends Owned {
  send_on_project_create?: boolean;
  send_on_project_update?: boolean;
  send_on_task_assign?: boolean;
  send_on_task_complete?: boolean;
  send_on_task_status_change?: boolean;
  send_on_invoice_issue?: boolean;
  send_on_invoice_update?: boolean;
  send_on_payment_received?: boolean;
  send_on_estimate_create?: boolean;
  send_on_ticket_reply?: boolean;
  send_on_ticket_create?: boolean;
  send_on_leave_apply?: boolean;
  send_on_leave_status?: boolean;
  send_on_expense_create?: boolean;
  send_on_expense_status?: boolean;
  send_on_lead_create?: boolean;
  send_on_birthday?: boolean;
  send_on_holiday?: boolean;
  send_on_event?: boolean;
  send_on_message?: boolean;
}

/* ── Push Notification ───────────────────────────────────────────── */
export interface WsPushNotificationSetting extends Owned {
  firebase_config?: unknown;
  is_enabled?: boolean;
}

/* ── Storage ─────────────────────────────────────────────────────── */
export type WsStorageDriver = 'local' | 's3' | 'google-drive' | 'azure';

export interface WsStorageSetting extends Owned {
  storage_driver?: WsStorageDriver;
  aws_access_key?: string;
  aws_secret?: string;
  aws_region?: string;
  aws_bucket?: string;
  gd_client_id?: string;
  gd_client_secret?: string;
  azure_account?: string;
}

/* ── Social Auth ─────────────────────────────────────────────────── */
export interface WsSocialAuthSetting extends Owned {
  google_client_id?: string;
  google_client_secret?: string;
  facebook_app_id?: string;
  facebook_app_secret?: string;
  linkedin_client_id?: string;
  linkedin_client_secret?: string;
  twitter_api_key?: string;
  twitter_api_secret?: string;
  microsoft_client_id?: string;
  microsoft_client_secret?: string;
}

/* ── Message Settings ────────────────────────────────────────────── */
export interface WsMessageSetting extends Owned {
  messages_enabled?: boolean;
  allow_attachments?: boolean;
  max_file_size_mb?: number;
}

/* ── Ticket Email ────────────────────────────────────────────────── */
export interface WsTicketEmailSetting extends Owned {
  email_address?: string;
  imap_host?: string;
  imap_port?: string;
  password?: string;
  encryption?: string;
  auto_reply?: boolean;
  auto_reply_body?: string;
}

/* Convenience union for the email notification keys (used by the
   page to iterate toggle rows). */
export const WS_EMAIL_NOTIFICATION_KEYS: Array<{
  key: keyof Omit<
    WsEmailNotificationSetting,
    '_id' | 'userId' | 'createdAt' | 'updatedAt'
  >;
  label: string;
  description: string;
}> = [
  { key: 'send_on_project_create', label: 'Project created', description: 'New project is created.' },
  { key: 'send_on_project_update', label: 'Project updated', description: 'Project details change.' },
  { key: 'send_on_task_assign', label: 'Task assigned', description: 'A task is assigned to a member.' },
  { key: 'send_on_task_complete', label: 'Task completed', description: 'A task is marked complete.' },
  { key: 'send_on_task_status_change', label: 'Task status changed', description: 'Task status moves column.' },
  { key: 'send_on_invoice_issue', label: 'Invoice issued', description: 'An invoice is issued to a client.' },
  { key: 'send_on_invoice_update', label: 'Invoice updated', description: 'An invoice is updated.' },
  { key: 'send_on_payment_received', label: 'Payment received', description: 'A payment is recorded.' },
  { key: 'send_on_estimate_create', label: 'Estimate created', description: 'A new estimate/quote.' },
  { key: 'send_on_ticket_reply', label: 'Ticket reply', description: 'A reply is posted on a ticket.' },
  { key: 'send_on_ticket_create', label: 'Ticket created', description: 'A new support ticket.' },
  { key: 'send_on_leave_apply', label: 'Leave applied', description: 'A member applies for leave.' },
  { key: 'send_on_leave_status', label: 'Leave status changed', description: 'Leave approved or rejected.' },
  { key: 'send_on_expense_create', label: 'Expense created', description: 'A new expense is filed.' },
  { key: 'send_on_expense_status', label: 'Expense status changed', description: 'Expense approved or rejected.' },
  { key: 'send_on_lead_create', label: 'Lead created', description: 'A new CRM lead.' },
  { key: 'send_on_birthday', label: 'Birthday', description: 'Member birthday notifications.' },
  { key: 'send_on_holiday', label: 'Holiday', description: 'Upcoming holiday notifications.' },
  { key: 'send_on_event', label: 'Event', description: 'New calendar event.' },
  { key: 'send_on_message', label: 'Message', description: 'New internal message.' },
];
