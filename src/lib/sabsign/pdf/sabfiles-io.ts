import 'server-only';

import { rustClient } from '@/lib/rust-client';

/**
 * Server-side SabFiles read/write for the SabSign PDF pipeline.
 *
 * IMPORTANT: SabFiles nodes are scoped per USER (the default Rust `tid`), NOT
 * per SabSign project. So these helpers MUST be called OUTSIDE any
 * `runWithRustTenant(<projectId>)` wrapper — otherwise the Rust BFF would look
 * the file up under the project tenant and miss it. `finalizeEnvelope`
 * deliberately runs the envelope ops inside the tenant wrapper and the file
 * ops outside it.
 */

/** Download a SabFiles node's raw bytes via its presigned R2 URL. */
export async function downloadSabfileBytes(docId: string): Promise<Uint8Array> {
  const { url } = await rustClient.sabfiles.download(docId);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`SabFiles download failed (${res.status}) for ${docId}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * Store bytes in SabFiles (presign → proxy PUT → confirm) and return the new
 * node id. The file lands in the user's library root (`parentId = null`).
 */
export async function uploadSabfileBytes(opts: {
  name: string;
  mime: string;
  bytes: Uint8Array;
  parentId?: string | null;
}): Promise<{ id: string }> {
  const { name, mime, bytes, parentId = null } = opts;
  const size = bytes.byteLength;
  const presign = await rustClient.sabfiles.presignUpload({
    name,
    size,
    mime,
    parent_id: parentId,
  });
  await rustClient.sabfiles.proxyUpload(presign.key, bytes as unknown as BodyInit, mime);
  const { node } = await rustClient.sabfiles.confirmUpload({
    key: presign.key,
    name,
    size,
    mime,
    parent_id: parentId,
  });
  const id = (node as { id?: string } | undefined)?.id;
  if (!id) throw new Error('SabFiles confirmUpload returned no node id');
  return { id };
}
