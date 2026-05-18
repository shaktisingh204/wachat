/**
 * Forge block: Read/Write Files from Disk
 *
 * Source: n8n-master/packages/nodes-base/nodes/Files/ReadWriteFile/ReadWriteFile.node.ts
 *
 * STATUS:
 *   • `read`  — disk-IO stub; remains disabled.
 *   • `write` — disk-IO stub; remains disabled.
 *
 *   This block is a thin facade: the real implementations live in the two
 *   dedicated blocks below, which is where SabFiles wiring is being added.
 *   Pointing users at them keeps a single source of truth instead of
 *   duplicating tenant-aware logic across multiple block files.
 *
 *     • Reads .................. `forge_read_binary_file`
 *                                  → `read_sabfile`  (SabFile share token)
 *                                  → `read_from_url` (arbitrary HTTPS URL)
 *     • Writes ................. `forge_write_binary_file`
 *                                  → `write_to_url`  (presigned PUT/POST)
 *                                  → `write_sabfile` (ctx.userId → Rust BFF)
 *     • List ................... `forge_read_binary_files`
 *                                  → `list_sabfiles` (ctx.userId → Rust BFF)
 *
 *   Tenant identity now flows through `ForgeActionContext.userId`, populated
 *   from `flow.userId` by `executeFlow` → `executeBlock` → `executeForgeBlock`.
 *   See `../generic/webhook_trigger_shim.ts` for the trigger contract.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';

const POINT_AT_DEDICATED_BLOCKS =
  'ReadWriteFile: this block is a facade. Use forge_read_binary_file (read_sabfile / read_from_url) ' +
  'or forge_write_binary_file (write_to_url / write_sabfile) instead. See the file header for details.';

async function read(_ctx: ForgeActionContext): Promise<ForgeActionResult> {
  throw new Error(POINT_AT_DEDICATED_BLOCKS);
}

async function write(_ctx: ForgeActionContext): Promise<ForgeActionResult> {
  throw new Error(POINT_AT_DEDICATED_BLOCKS);
}

const block: ForgeBlock = {
  id: 'forge_read_write_file',
  name: 'Read/Write Files from Disk',
  description:
    'Facade block — use forge_read_binary_file / forge_write_binary_file for real file IO.',
  iconName: 'LuHardDrive',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'read',
      label: 'Read from disk (disabled)',
      description: 'Disabled in SabFlow. Use forge_read_binary_file for SabFiles or URL reads.',
      fields: [
        { id: 'filePath', label: 'File path', type: 'text', placeholder: '/tmp/disabled' },
      ],
      run: read,
    },
    {
      id: 'write',
      label: 'Write to disk (disabled)',
      description: 'Disabled in SabFlow. Use forge_write_binary_file for SabFiles or presigned writes.',
      fields: [
        { id: 'filePath', label: 'File path', type: 'text', placeholder: '/tmp/disabled' },
        { id: 'base64Data', label: 'Base64 data', type: 'textarea' },
      ],
      run: write,
    },
  ],
};

registerForgeBlock(block);
export default block;
