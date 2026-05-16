/**
 * Forge block: IP Lookup
 *
 * Geolocate an IP address via the public ipapi.co endpoint (no auth needed
 * for low request volumes). Returns the full JSON payload so downstream
 * blocks can dot-path into city / country / org / etc.
 */
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const block: ForgeBlock = {
  id: 'forge_ip_lookup',
  name: 'IP: Lookup',
  description: 'Geolocate an IP address via ipapi.co (no auth).',
  iconName: 'LuGlobe',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'lookup',
      label: 'Lookup IP',
      fields: [
        { id: 'ip', label: 'IP address', type: 'text', required: true, placeholder: '8.8.8.8' },
      ],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const ip = asString(ctx.options.ip).trim();
        if (!ip) throw new Error('IP lookup: IP address is required');
        const url = `https://ipapi.co/${encodeURIComponent(ip)}/json/`;
        const res = await apiRequest({ service: 'ipapi.co', method: 'GET', url });
        const data = res.data as Record<string, unknown>;
        if (data && typeof data === 'object' && data.error) {
          throw new Error(`IP lookup: ${asString(data.reason) || 'unknown error'}`);
        }
        return { outputs: { info: data }, logs: [`Lookup ${ip}`] };
      },
    },
  ],
};

registerForgeBlock(block);
export default block;
