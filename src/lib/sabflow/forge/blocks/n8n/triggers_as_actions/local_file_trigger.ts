/**
 * Forge block: Local File Trigger (port of LocalFileTrigger as a one-shot read action)
 *
 * Source: n8n-master/packages/nodes-base/nodes/LocalFileTrigger/LocalFileTrigger.node.ts
 *
 * Note: n8n's runtime trigger semantics don't apply here — this port is for
 * catalog parity. `fs.watch` / fs.watchFile based change detection belongs in
 * the trigger system under src/lib/sabflow/triggers/. This action performs a
 * single read of a file on the server's filesystem.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

async function readFileOnce(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { readFile, stat } = await import('node:fs/promises');
  const path = asString(ctx.options.path);
  if (!path) throw new Error('Local File Trigger: path is required');
  const encoding = (asString(ctx.options.encoding) || 'utf8') as BufferEncoding;
  const asBase64 = encoding === 'base64';

  let info;
  try {
    info = await stat(path);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Local File Trigger: cannot stat "${path}" — ${message}`);
  }
  if (!info.isFile()) {
    throw new Error(`Local File Trigger: "${path}" is not a regular file`);
  }

  const buffer = await readFile(path);
  const content = asBase64 ? buffer.toString('base64') : buffer.toString(encoding);

  return {
    outputs: {
      path,
      size: info.size,
      modifiedAt: info.mtime.toISOString(),
      encoding,
      content,
    },
    logs: [`Local File Trigger read_file_once → ${path} (${info.size} bytes)`],
  };
}

const block: ForgeBlock = {
  id: 'forge_local_file_trigger',
  name: 'Local File Trigger',
  description: 'Read a local file once. Actual fs.watch change detection is part of the trigger system.',
  iconName: 'LuFile',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'read_file_once',
      label: 'Read file once',
      description: 'Read the file at the given server path and return its contents.',
      fields: [
        {
          id: 'path',
          label: 'Path',
          type: 'text',
          required: true,
          placeholder: '/tmp/incoming.json',
        },
        {
          id: 'encoding',
          label: 'Encoding',
          type: 'select',
          defaultValue: 'utf8',
          options: [
            { label: 'utf8', value: 'utf8' },
            { label: 'ascii', value: 'ascii' },
            { label: 'latin1', value: 'latin1' },
            { label: 'base64', value: 'base64' },
            { label: 'hex', value: 'hex' },
          ],
        },
      ],
      run: readFileOnce,
    },
  ],
};

registerForgeBlock(block);
export default block;
