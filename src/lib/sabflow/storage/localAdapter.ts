/**
 * SabFlow — Local filesystem storage adapter
 *
 * Persists uploaded files under `public/uploads/sabflow/` so that Next.js
 * serves them directly. Filenames are prefixed with a UUID to avoid
 * collisions; the original filename is preserved (sanitised) for a friendly
 * download experience.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import type { StorageAdapter, StorageUploadResult } from './adapter';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'sabflow');
const PUBLIC_PREFIX = '/uploads/sabflow';

/** Strip directory separators and other unsafe chars from a filename. */
function sanitizeFilename(name: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]+/g, '_');
  // Guard against pathological inputs like ".." or "".
  if (!base || base === '.' || base === '..') return 'file';
  // Cap length so we never blow the 255-byte filename limit.
  return base.length > 180 ? base.slice(-180) : base;
}

export class LocalStorageAdapter implements StorageAdapter {
  async upload(
    file: Buffer,
    filename: string,
    _contentType: string,
  ): Promise<StorageUploadResult> {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    const safeName = sanitizeFilename(filename);
    const key = `${uuidv4()}-${safeName}`;
    const dest = path.join(UPLOAD_DIR, key);

    await fs.writeFile(dest, file);

    return {
      url: `${PUBLIC_PREFIX}/${key}`,
      key,
    };
  }

  async delete(key: string): Promise<void> {
    // Refuse anything that tries to escape the upload directory.
    const safeKey = path.basename(key);
    if (!safeKey || safeKey !== key) return;

    const target = path.join(UPLOAD_DIR, safeKey);
    try {
      await fs.unlink(target);
    } catch (err) {
      // Swallow ENOENT — idempotent delete.
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }
}
