/**
 * Forge block: QR Code
 *
 * Build a QR-code image URL via goqr.me (api.qrserver.com). Since the service
 * returns the PNG directly we don't need to fetch it server-side — the URL
 * itself is the deliverable (drop into an <img> or SabFiles importer).
 */
import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asNumber, asString } from '../_shared/http';

const block: ForgeBlock = {
  id: 'forge_qr_code',
  name: 'QR Code',
  description: 'Generate a QR-code image URL (api.qrserver.com).',
  iconName: 'LuQrCode',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'generate',
      label: 'Generate URL',
      fields: [
        { id: 'data', label: 'Data', type: 'textarea', required: true },
        { id: 'size', label: 'Size (px)', type: 'number', defaultValue: 200 },
      ],
      run: async (ctx: ForgeActionContext): Promise<ForgeActionResult> => {
        const data = asString(ctx.options.data);
        if (!data) throw new Error('QR Code: data is required');
        const size = Math.max(50, Math.min(1000, asNumber(ctx.options.size) ?? 200));
        const dim = `${size}x${size}`;
        const url = `https://api.qrserver.com/v1/create-qr-code/?size=${dim}&data=${encodeURIComponent(data)}`;
        return { outputs: { url, size: dim }, logs: [`QR generated (${dim})`] };
      },
    },
  ],
};

registerForgeBlock(block);
export default block;
