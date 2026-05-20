/**
 * Forge block: Customer Messenger (n8n training)
 *
 * Source: n8n-master/packages/nodes-base/nodes/N8nTrainingCustomerMessenger/N8nTrainingCustomerMessenger.node.ts
 *
 * n8n ships this as a demo/training node — it doesn't actually send
 * messages anywhere, it just echoes the payload. Ported here for migration
 * parity only; for real customer messaging use the SabWa / Twilio /
 * SendGrid blocks.
 *
 * Operations covered:
 *   - send_message(customerId, text) → { sent, customerId, text, at }
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

async function sendMessage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const customerId = asString(ctx.options.customerId);
  const text = asString(ctx.options.text);
  if (!customerId) throw new Error('TrainingMessenger: customerId is required');
  if (!text) throw new Error('TrainingMessenger: text is required');
  const at = new Date().toISOString();
  return {
    outputs: {
      sent: true,
      customerId,
      text,
      at,
      output: `Sent message to customer ${customerId}: ${text}`,
    },
    logs: [`TrainingMessenger send_message → ${customerId}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_training_messenger',
  name: 'Customer Messenger (Training Demo)',
  description: 'Demo no-op messenger — echoes the payload. For migration parity only.',
  iconName: 'LuMessageCircle',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'send_message',
      label: 'Send message',
      description: 'Echo the message as if it had been sent. Does NOT make a network call.',
      fields: [
        { id: 'customerId', label: 'Customer ID', type: 'text', required: true },
        { id: 'text', label: 'Message', type: 'textarea', required: true },
      ],
      run: sendMessage,
    },
  ],
};

registerForgeBlock(block);
export default block;
