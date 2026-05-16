/**
 * Forge block: ReadBinaryFiles
 *
 * Source: n8n-master/packages/nodes-base/nodes/ReadBinaryFiles/ReadBinaryFiles.node.ts
 *
 * STATUS:
 *   • `read`           — disk-IO stub; remains disabled.
 *   • `list_sabfiles`  — STATUS REPORT, not yet wired.
 *
 *   Listing a user's SabFiles requires tenant identity (`userId`) inside
 *   the forge action context. Today `ForgeActionContext` exposes only
 *   `options`, `variables`, and `credential` — there is NO tenant plumbing.
 *   The BullMQ worker payload (`projectId: webhook.userId`, see
 *   `src/app/api/sabflow/webhook/[webhookId]/route.ts`) carries it, but the
 *   engine's `executeForgeBlock` in `src/lib/sabflow/engine/executeBlock.ts`
 *   does not propagate it.
 *
 *   To make `list_sabfiles` real, the following needs to happen FIRST:
 *
 *     1. Extend `ForgeActionContext` with `tenant: { userId: string }`.
 *     2. Plumb `projectId` from the BullMQ job → `startSession()` →
 *        `executeForgeBlock` → `action.run(ctx)`.
 *     3. Re-implement the action below with `rustFetch` using an
 *        impersonated `issueRustJwt({ userId: ctx.tenant.userId })` —
 *        which works in the worker because it only needs `RUST_JWT_SECRET`
 *        from `process.env`, not `cookies()`.
 *
 *   Until then this action stays disabled with a clear message.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';

const NEEDS_TENANT_PLUMBING =
  'ReadBinaryFiles list_sabfiles: requires tenant identity in ForgeActionContext. ' +
  'See file header for the wiring checklist; for now use the SabFiles UI ' +
  '(@/components/sabfiles) to enumerate files and pass a share token to forge_read_binary_file.';

async function read(_ctx: ForgeActionContext): Promise<ForgeActionResult> {
  throw new Error(
    'ReadBinaryFiles: server-side file IO is disabled in SabFlow. Use SabFiles via the @/components/sabfiles components for tenant-isolated storage.',
  );
}

async function listSabfiles(_ctx: ForgeActionContext): Promise<ForgeActionResult> {
  throw new Error(NEEDS_TENANT_PLUMBING);
}

const block: ForgeBlock = {
  id: 'forge_read_binary_files',
  name: 'Read Binary Files',
  description:
    'List or glob-read files. Disk IO is disabled; list_sabfiles is pending tenant plumbing.',
  iconName: 'LuFiles',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'read',
      label: 'Read from disk (disabled)',
      description: 'Disabled in SabFlow. Use SabFiles for tenant-isolated storage.',
      fields: [
        { id: 'glob', label: 'Glob pattern', type: 'text', placeholder: '/data/*.png' },
      ],
      run: read,
    },
    {
      id: 'list_sabfiles',
      label: 'List SabFiles (pending)',
      description:
        'Enumerate the current user\'s SabFiles. Pending: tenant identity must be plumbed into ForgeActionContext first.',
      fields: [
        {
          id: 'folderId',
          label: 'Folder ID (optional)',
          type: 'text',
          placeholder: 'Leave blank for root',
        },
      ],
      run: listSabfiles,
    },
  ],
};

registerForgeBlock(block);
export default block;
