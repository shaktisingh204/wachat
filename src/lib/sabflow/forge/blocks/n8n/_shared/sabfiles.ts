import type { ForgeActionContext } from '../../../types';

export async function uploadStreamToSabFiles(
  ctx: ForgeActionContext,
  name: string,
  contentType: string,
  streamOrBuffer: ReadableStream | Buffer | Uint8Array,
  size?: number
): Promise<{ id: string; name: string; size: number; mime: string; createdAt: string }> {
  if (!ctx.userId) {
    throw new Error('uploadStreamToSabFiles: ctx.userId missing — cannot mint Rust JWT.');
  }

  const { issueRustJwt } = await import('@/lib/jwt-for-rust');
  const token = await issueRustJwt({
    userId: ctx.userId,
    tenantId: ctx.userId,
    roles: [],
  });

  const base = process.env.RUST_API_URL || 'http://localhost:8080';
  
  const rustFetch = async (path: string, init: RequestInit) => {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    if (!headers.has('Accept')) headers.set('Accept', 'application/json');
    const res = await fetch(`${base}${path}`, { ...init, headers, cache: 'no-store' });
    if (!res.ok) {
      let detail = '';
      try {
        const body = await res.text();
        detail = body.length > 300 ? `${body.slice(0, 300)}…` : body;
      } catch {}
      throw new Error(`Rust BFF ${res.status} ${res.statusText} — ${detail}`);
    }
    return res.json();
  };

  // 1. Presign
  type PresignResponse = {
    upload_url: string;
    key: string;
    method: string;
    headers: Record<string, string>;
  };
  const presign = await rustFetch('/v1/sabfiles/upload/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      size: size ?? 0, // if unknown, SabFiles might allow 0, or we handle it.
      mime: contentType,
      parent_id: null,
    }),
  }) as PresignResponse;

  // 2. Upload
  const uploadHeaders = new Headers(presign.headers ?? {});
  if (!uploadHeaders.has('Content-Type')) uploadHeaders.set('Content-Type', contentType);
  
  const uploadRes = await fetch(presign.upload_url, {
    method: (presign.method || 'PUT').toUpperCase(),
    headers: uploadHeaders,
    body: streamOrBuffer as any,
    duplex: streamOrBuffer instanceof ReadableStream ? 'half' : undefined,
  });

  if (!uploadRes.ok) {
    const txt = await uploadRes.text().catch(() => '');
    throw new Error(`R2 upload failed (${uploadRes.status}): ${txt}`);
  }

  // 3. Confirm
  type ConfirmResponse = {
    node: { id: string; name: string; size?: number; mime?: string; createdAt: string };
  };
  const confirmed = await rustFetch('/v1/sabfiles/upload/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key: presign.key,
      name,
      size: size ?? 0,
      mime: contentType,
      parent_id: null,
    }),
  }) as ConfirmResponse;

  return {
    id: confirmed.node.id,
    name: confirmed.node.name,
    size: confirmed.node.size ?? size ?? 0,
    mime: confirmed.node.mime ?? contentType,
    createdAt: confirmed.node.createdAt,
  };
}
