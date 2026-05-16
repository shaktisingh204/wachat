/**
 * Forge block: MSG91
 *
 * Source: n8n-master/packages/nodes-base/nodes/Msg91/Msg91.node.ts
 *
 * Auth key is passed as `authkey` (query param for the legacy SMS endpoint,
 * header for the v5 OTP endpoints).
 *
 * Operations covered:
 *   - sms.send     GET   https://api.msg91.com/api/sendhttp.php
 *   - otp.send     POST  https://control.msg91.com/api/v5/otp
 *   - otp.verify   GET   https://control.msg91.com/api/v5/otp/verify
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const LEGACY_API = 'https://api.msg91.com/api';
const V5_API = 'https://control.msg91.com/api/v5';

async function smsSend(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const authkey = asString(ctx.options.authkey);
  const from = asString(ctx.options.from);
  const to = asString(ctx.options.to);
  const message = asString(ctx.options.message);
  if (!authkey) throw new Error('MSG91: authkey is required');
  if (!from) throw new Error('MSG91: from (sender ID) is required');
  if (!to) throw new Error('MSG91: to is required');
  if (!message) throw new Error('MSG91: message is required');
  const qs = new URLSearchParams({
    authkey,
    route: '4',
    country: '0',
    sender: from,
    mobiles: to,
    message,
  });
  const res = await apiRequest({
    service: 'MSG91',
    method: 'GET',
    url: `${LEGACY_API}/sendhttp.php?${qs.toString()}`,
  });
  return { outputs: { requestId: res.data }, logs: [`MSG91 sms → ${to}`] };
}

async function otpSend(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const authkey = asString(ctx.options.authkey);
  const mobile = asString(ctx.options.mobile);
  const templateId = asString(ctx.options.templateId);
  if (!authkey) throw new Error('MSG91: authkey is required');
  if (!mobile) throw new Error('MSG91: mobile is required');
  if (!templateId) throw new Error('MSG91: templateId is required');
  const qs = new URLSearchParams({
    template_id: templateId,
    mobile,
  });
  const otp = asString(ctx.options.otp);
  if (otp) qs.set('otp', otp);
  const senderId = asString(ctx.options.senderId);
  if (senderId) qs.set('sender', senderId);
  const res = await apiRequest({
    service: 'MSG91',
    method: 'POST',
    url: `${V5_API}/otp?${qs.toString()}`,
    headers: { authkey },
    json: {},
  });
  return { outputs: { result: res.data }, logs: [`MSG91 otp send → ${mobile}`] };
}

async function otpVerify(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const authkey = asString(ctx.options.authkey);
  const mobile = asString(ctx.options.mobile);
  const otp = asString(ctx.options.otp);
  if (!authkey) throw new Error('MSG91: authkey is required');
  if (!mobile) throw new Error('MSG91: mobile is required');
  if (!otp) throw new Error('MSG91: otp is required');
  const qs = new URLSearchParams({ mobile, otp });
  const res = await apiRequest({
    service: 'MSG91',
    method: 'GET',
    url: `${V5_API}/otp/verify?${qs.toString()}`,
    headers: { authkey },
  });
  return { outputs: { result: res.data }, logs: [`MSG91 otp verify → ${mobile}`] };
}

const block: ForgeBlock = {
  id: 'forge_msg91',
  name: 'MSG91',
  description: 'Send transactional SMS and OTPs via MSG91.',
  iconName: 'LuMessageSquare',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'sms_send',
      label: 'Send SMS',
      fields: [
        { id: 'authkey', label: 'Auth key', type: 'password', required: true },
        { id: 'from', label: 'Sender ID', type: 'text', required: true },
        { id: 'to', label: 'To (with country code)', type: 'text', required: true },
        { id: 'message', label: 'Message', type: 'textarea', required: true },
      ],
      run: smsSend,
    },
    {
      id: 'otp_send',
      label: 'Send OTP',
      fields: [
        { id: 'authkey', label: 'Auth key', type: 'password', required: true },
        { id: 'mobile', label: 'Mobile (with country code)', type: 'text', required: true },
        { id: 'templateId', label: 'Template ID', type: 'text', required: true },
        { id: 'otp', label: 'Custom OTP', type: 'text' },
        { id: 'senderId', label: 'Sender ID', type: 'text' },
      ],
      run: otpSend,
    },
    {
      id: 'otp_verify',
      label: 'Verify OTP',
      fields: [
        { id: 'authkey', label: 'Auth key', type: 'password', required: true },
        { id: 'mobile', label: 'Mobile (with country code)', type: 'text', required: true },
        { id: 'otp', label: 'OTP', type: 'text', required: true },
      ],
      run: otpVerify,
    },
  ],
};

registerForgeBlock(block);
export default block;
