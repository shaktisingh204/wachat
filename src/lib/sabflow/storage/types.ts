/**
 * SabFlow — File storage types
 *
 * Shared shapes for the storage subsystem.
 *
 * A {@link StoredFile} represents a single file uploaded by either an
 * editor (authoring a flow) or an end-user (interacting with a chat).
 */

export type StorageProvider = 'local' | 's3' | 'blob';

export type StoredFile = {
  /** Stable identifier — hex string of a Mongo ObjectId. */
  id: string;
  /** Associated flow id when the file belongs to a flow's design. */
  flowId?: string;
  /** Chat session id when the file was uploaded by an end user. */
  sessionId?: string;
  /** Owning workspace — maps to `userId` in the current auth model. */
  workspaceId: string;
  /** Original filename as submitted by the uploader. */
  filename: string;
  /** MIME type, e.g. `image/png`. */
  contentType: string;
  /** Size in bytes. */
  sizeBytes: number;
  /** Publicly accessible URL (or signed URL for private providers). */
  url: string;
  /** Backend provider used to persist the file. */
  provider: StorageProvider;
  /** When the metadata row was created. */
  uploadedAt: Date;
  /** Uploader user id (for editor uploads). */
  uploadedBy?: string;
  /** Provider-specific key needed to delete the object later. */
  storageKey?: string;
};
