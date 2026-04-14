import type { ObjectId } from 'mongodb';

/**
 * Worksuite File Storage — MongoDB type definitions ported from
 * Laravel's `file_storage` table + polymorphic attachment tables.
 *
 * SabNode port uses a single metadata collection `crm_file_storage`
 * plus an optional `crm_file_folders` tree for organization. Tenant
 * isolation is via `userId`.
 *
 * NOTE: Actual blob upload is NOT handled here — the current
 * implementation expects the caller to provide a pre-hosted `url`
 * (e.g. via an existing Firebase bucket / Mongo-backed asset store).
 * See `uploadFile` in `files.actions.ts` for the stub.
 */

export interface WsFileFolder {
  _id?: ObjectId | string;
  userId: ObjectId | string;
  name: string;
  parent_folder_id?: string; // null/undefined = root
  description?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export type WsFileAttachableType =
  | 'contact'
  | 'account'
  | 'deal'
  | 'lead'
  | 'task'
  | 'project'
  | 'invoice'
  | 'ticket'
  | 'contract'
  | 'kb'
  | 'note'
  | 'proposal'
  | 'estimate'
  | 'client';

export interface WsFileStorage {
  _id?: ObjectId | string;
  userId: ObjectId | string;
  filename: string; // original filename
  display_name?: string;
  storage_location?: 'local' | 's3' | 'firebase' | 'external' | string;
  file_path?: string; // path within the storage backend
  url?: string; // direct URL to the file
  size_bytes?: number;
  mime_type?: string;
  extension?: string;
  uploaded_by_user_id?: string;
  /** Polymorphic attachment — resource type this file belongs to. */
  attached_to_type?: WsFileAttachableType;
  attached_to_id?: string;
  folder_id?: string;
  description?: string;
  is_public?: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

/** Recursive tree node used by `getFolderTree`. */
export interface WsFolderTreeNode extends WsFileFolder {
  children: WsFolderTreeNode[];
}

/** Human-readable byte-size formatter to mirror the PHP accessor. */
export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 bytes';
  if (bytes === 1) return '1 byte';
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return bytes + ' bytes';
}
