/**
 * Forge block: MCP Trigger (info shim).
 *
 * SabFlow acts as the MCP server here: this block declares which flow tools
 * should be exposed to MCP clients (Claude Desktop, Cursor, etc.). The actual
 * MCP transport is served by `src/app/api/sabflow/mcp/[serverId]/route.ts`.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

const SUPPORTED_EVENTS = ['tool.call', 'prompt.get', 'resource.read'] as const;

function parseToolList(raw: unknown): string[] {
  const s = asString(raw).trim();
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) return parsed.map(asString).filter(Boolean);
  } catch {
    /* fall through */
  }
  return s.split(',').map((p) => p.trim()).filter(Boolean);
}

async function register_trigger_info(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const serverId = asString(ctx.options.serverId);
  const exposeTools = parseToolList(ctx.options.exposeTools);
  const sabflowReceiverUrl = serverId
    ? `${BASE_URL}/api/sabflow/mcp/${serverId}`
    : '(server id not minted yet — see SabFlow Connections)';
  return {
    outputs: {
      service: 'MCP Trigger',
      sabflowReceiverUrl,
      supportedEvents: SUPPORTED_EVENTS,
      exposeTools,
      registrationInstructions:
        `Point your MCP client (Claude Desktop / Cursor) at ${sabflowReceiverUrl}. Tools listed in exposeTools will be advertised to MCP clients.`,
    },
    logs: [`MCP Trigger info → ${exposeTools.length} tool(s)`],
  };
}

const block: ForgeBlock = {
  id: 'forge_lc_mcp_trigger',
  name: 'MCP Trigger (info)',
  description: 'Declares which SabFlow tools to expose to MCP clients (SabFlow as MCP server).',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the MCP server URL + the list of tools to advertise.',
      fields: [
        {
          id: 'serverId',
          label: 'SabFlow MCP server id',
          type: 'text',
          placeholder: 'minted by SabFlow Connections',
        },
        {
          id: 'exposeTools',
          label: 'Tools to expose (JSON array or CSV)',
          type: 'json',
          placeholder: '["search_docs", "create_ticket"]',
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
