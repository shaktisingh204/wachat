/**
 * Forge block: HTTP Request V2 (legacy n8n shape)
 *
 * Source: n8n-master/packages/nodes-base/nodes/HttpRequest/V2/HttpRequestV2.node.ts
 *
 * Compat-shim — preserves the `forge_http_request_v2` id for flow files
 * pinned to the v2 node. Delegates to the modern `forge_http_request` action.
 */
import { registerForgeBlock, getForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';

async function run(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const modern = getForgeBlock('forge_http_request');
  if (!modern?.actions?.[0]) throw new Error('forge_http_request not registered');
  return modern.actions[0].run(ctx);
}

const block: ForgeBlock = {
  id: 'forge_http_request_v2',
  name: 'HTTP Request (v2)',
  description: 'Legacy HTTP Request v2 shape. Delegates to forge_http_request.',
  iconName: 'LuGlobe',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'request_legacy',
      label: 'Send request (legacy v2)',
      description: 'V2 compatibility entry-point. Same fields, modern executor.',
      fields: [
        {
          id: 'method',
          label: 'Method',
          type: 'select',
          required: true,
          defaultValue: 'GET',
          options: [
            { label: 'GET', value: 'GET' },
            { label: 'POST', value: 'POST' },
            { label: 'PATCH', value: 'PATCH' },
            { label: 'PUT', value: 'PUT' },
            { label: 'DELETE', value: 'DELETE' },
            { label: 'HEAD', value: 'HEAD' },
          ],
        },
        { id: 'url', label: 'URL', type: 'text', required: true, placeholder: 'https://api.example.com/v1/things' },
        {
          id: 'headers',
          label: 'Headers',
          type: 'key-value-list',
          helperText: 'Sent with the request. Use one entry per header.',
        },
        {
          id: 'bodyType',
          label: 'Body type',
          type: 'select',
          defaultValue: 'none',
          options: [
            { label: 'None', value: 'none' },
            { label: 'JSON', value: 'json' },
            { label: 'Raw text', value: 'text' },
          ],
        },
        {
          id: 'jsonBody',
          label: 'JSON body',
          type: 'json',
          placeholder: '{ "name": "value" }',
          showIf: { field: 'bodyType', equals: 'json' },
        },
        {
          id: 'textBody',
          label: 'Body',
          type: 'textarea',
          showIf: { field: 'bodyType', equals: 'text' },
        },
      ],
      run,
    },
  ],
};

registerForgeBlock(block);
export default block;
