/**
 * SabFlow — Storage adapter interface
 *
 * Pluggable contract that lets the rest of the system upload/delete files
 * without caring about the underlying provider (local FS, S3, Blob, …).
 */

export interface StorageUploadResult {
  /** Public (or signed) URL consumable by browsers. */
  url: string;
  /** Provider-specific key required to delete the object later. */
  key: string;
}

export interface StorageAdapter {
  upload(
    file: Buffer,
    filename: string,
    contentType: string,
  ): Promise<StorageUploadResult>;
  delete(key: string): Promise<void>;
  /**
   * Optional: return a time-limited signed URL for a private object.
   * Local adapter does not implement this since files live under /public.
   */
  getSignedUrl?(key: string, expiresInSeconds?: number): Promise<string>;
}
