/**
 * QuickBooks Online integration — shared types.
 *
 * All persisted credentials live in `crm_quickbooks_settings` (one row per
 * tenant). The sync ledger lives in `crm_quickbooks_sync_log` (capped at
 * 200 rows per tenant).
 */
import type { ObjectId } from 'mongodb';

export type QuickBooksEnvironment = 'sandbox' | 'production';

export interface QuickBooksSettingDoc {
  _id?: ObjectId;
  userId: ObjectId;
  client_id: string;
  /** AES-256-GCM ciphertext from `@/lib/sabflow/credentials/encryption`. */
  client_secret_enc: string;
  environment: QuickBooksEnvironment;
  realmId?: string;
  access_token?: string;
  refresh_token?: string;
  /** Epoch ms when `access_token` stops being valid. */
  expires_at?: number;
  /** Epoch ms when `refresh_token` (issued for 100 days) stops being valid. */
  refresh_token_expires_at?: number;
  connected: boolean;
  autoSync: boolean;
  connectedAt?: Date;
  lastSync?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type SyncLogAction = 'sync' | 'oauth' | 'refresh' | 'disconnect';
export type SyncLogEntity = 'client' | 'invoice' | 'connection' | 'token';
export type SyncLogStatus = 'success' | 'failure';

export interface QuickBooksSyncLogDoc {
  _id?: ObjectId;
  userId: ObjectId;
  timestamp: Date;
  action: SyncLogAction;
  entity: SyncLogEntity;
  status: SyncLogStatus;
  /** Local entity id (Mongo `_id`). */
  refId?: string;
  /** QuickBooks-side id, if any (Customer.Id / Invoice.Id). */
  quickbooksId?: string;
  error?: string;
}

export interface SyncResult {
  ok: number;
  failed: number;
  errors: Array<{ id: string; message: string }>;
}

export interface SingleSyncResult {
  ok: boolean;
  quickbooksId?: string;
  error?: string;
}

export interface QuickBooksStatus {
  connected: boolean;
  realmId?: string;
  lastSync?: string;
  environment?: QuickBooksEnvironment;
  autoSync?: boolean;
  hasCredentials: boolean;
  redirectUri: string;
  /** True when a previous API call returned 401 — UI should prompt re-OAuth. */
  reauthRequired?: boolean;
}
