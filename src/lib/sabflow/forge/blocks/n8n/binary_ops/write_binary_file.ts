/**
 * Forge block: WriteBinaryFile
 *
 * Source: n8n-master/packages/nodes-base/nodes/WriteBinaryFile/WriteBinaryFile.node.ts
 *
 * STATUS:
 *   • `write`          — disk-IO stub; remains disabled.
 *   • `write_to_url`   — generic presigned-URL uploader, works for S3 / R2 /
 *                        GCS as long as the caller already has a presigned
 *                        PUT/POST URL.
 *   • `write_sabfile`  — STATUS REPORT, not yet wired.
 *
 *   A real `write_sabfile(name, base64Data, contentType?)` action requires
 *   tenant identity (`userId`) so the new file lands inside the correct
 *   user's R2 namespace and is recorded in their Mongo `sabfiles_nodes`
 *   collection. The two pieces this needs:
 *
 *     1. `ForgeActionContext.tenant.userId` — see the matching note in
 *        `./read_binary_files.ts`. Currently absent.
 *     2. A worker-safe Rust BFF call. Two options once tenant is plumbed:
 *        a. `rustFetch` with a hand-minted JWT
 *           (`issueRustJwt({ userId: ctx.tenant.userId })`) — sidesteps
 *           the `cookies()` requirement of the standard fetcher.
 *        b. Write directly to R2 with `uploadToR2(...)` from
 *           `@/lib/r2.ts` (worker-safe), then call the Rust BFF's
 *           `confirmUpload` to record the Mongo node.
 *
 *   Until tenant plumbing lands this action throws a clear "pending" error
 *   pointing at this header.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

const NEEDS_TENANT_PLUMBING =
  'WriteBinaryFile write_sabfile: requires tenant identity in ForgeActionContext. ' +
  'See file header for the wiring checklist; for now use write_to_url with a presigned R2 PUT URL.';

async function write(_ctx: ForgeActionContext): Promise<ForgeActionResult> {
  throw new Error(
    'WriteBinaryFile: server-side file IO is disabled in SabFlow. Use SabFiles via the @/components/sabfiles components for tenant-isolated storage.',
  );
}

async function writeSabfile(_ctx: ForgeActionContext): Promise<ForgeActionResult> {
  throw new Error(NEEDS_TENANT_PLUMBING);
}

async function writeToUrl(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const url = asString(ctx.options.url);
  const base64 = asString(ctx.options.base64Data);
  const contentType = asString(ctx.options.contentType) || 'application/octet-stream';
  const method = (asString(ctx.options.method) || 'PUT').toUpperCase();
  if (!url) throw new Error('WriteBinaryFile: url is required');
  if (!base64) throw new Error('WriteBinaryFile: base64Data is required');

  const buf = Buffer.from(base64, 'base64');
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': contentType },
    body: buf,
  });
  if (!res.ok) {
    const txt = await res.text();
    const clip = txt.length > 300 ? `${txt.slice(0, 300)}…` : txt;
    throw new Error(`WriteBinaryFile: ${method} ${url} failed (${res.status}): ${clip}`);
  }
  return {
    outputs: { status: res.status, bytes: buf.length },
    logs: [`WriteBinaryFile write_to_url → ${buf.length}B (${res.status})`],
  };
}

const block: ForgeBlock = {
  id: 'forge_write_binary_file',
  name: 'Write Binary File',
  description: 'Write a binary file. Server-side disk IO is stubbed; use the URL variant or SabFiles.',
  iconName: 'LuFileUp',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'write',
      label: 'Write to disk (disabled)',
      description: 'Disabled in SabFlow. Use SabFiles for tenant-isolated storage.',
      fields: [
        { id: 'filePath', label: 'File path', type: 'text', placeholder: '/tmp/disabled' },
        { id: 'base64Data', label: 'Base64 data', type: 'textarea' },
      ],
      run: write,
    },
    {
      id: 'write_to_url',
      label: 'Write to presigned URL',
      description: 'PUT/POST base64 bytes to a presigned URL (S3 / R2 / GCS).',
      fields: [
        { id: 'url', label: 'Presigned URL', type: 'text', required: true },
        { id: 'base64Data', label: 'Base64 data', type: 'textarea', required: true },
        { id: 'contentType', label: 'Content-Type', type: 'text', placeholder: 'application/octet-stream' },
        {
          id: 'method',
          label: 'HTTP method',
          type: 'select',
          defaultValue: 'PUT',
          options: [
            { label: 'PUT', value: 'PUT' },
            { label: 'POST', value: 'POST' },
          ],
        },
      ],
      run: writeToUrl,
    },
    {
      id: 'write_sabfile',
      label: 'Write SabFile (pending)',
      description:
        'Upload base64 bytes into the current user\'s SabFiles. Pending: tenant identity must be plumbed into ForgeActionContext first.',
      fields: [
        { id: 'name', label: 'File name', type: 'text', required: true, placeholder: 'report.pdf' },
        { id: 'base64Data', label: 'Base64 data', type: 'textarea', required: true },
        { id: 'contentType', label: 'Content-Type', type: 'text', placeholder: 'application/octet-stream' },
        { id: 'folderId', label: 'Folder ID (optional)', type: 'text', placeholder: 'Leave blank for root' },
      ],
      run: writeSabfile,
    },
  ],
};

registerForgeBlock(block);
export default block;
