/**
 * Forge block: SabSMS (V2.9).
 *
 * In-app integration (no external credential): SabSMS is a first-party
 * SabNode module, so this block routes through the SabSMS engine client
 * as the workspace owner (`ctx.userId`) — same pattern as the SabSheet
 * forge block. Compliance, credits, and routing all apply because the
 * send goes through the exact same enqueue path as the composer.
 *
 * Actions:
 *   • send_sms        — enqueue an SMS through the SabSMS engine.
 *   • wait_for_reply  — bounded poll for an inbound reply from a phone
 *                       (multi-output: `replied` / `timeout`). For
 *                       waits longer than a few minutes use a SabSMS
 *                       journey (`/sabsms/drips`) instead — journeys
 *                       park durably and survive restarts.
 */

import { registerForgeBlock } from '../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../types';

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const num = (v: unknown, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const CATEGORY_OPTIONS = [
  { value: 'transactional', label: 'Transactional' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'otp', label: 'OTP' },
  { value: 'alert', label: 'Alert' },
  { value: 'service', label: 'Service' },
];

async function sendSms(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  if (!ctx.userId) {
    throw new Error('SabSMS: ctx.userId missing — cannot resolve the workspace.');
  }
  const to = str(ctx.options.to).trim();
  const body = str(ctx.options.body);
  const category = (str(ctx.options.category) || 'transactional') as
    | 'transactional'
    | 'otp'
    | 'marketing'
    | 'alert'
    | 'service';
  const from = str(ctx.options.from).trim();
  const outputVariable = str(ctx.options.outputVariable);

  if (!to) throw new Error('SabSMS send_sms: "to" is required');
  if (!body.trim()) throw new Error('SabSMS send_sms: "body" is required');

  const { sabsmsEngine } = await import('@/lib/sabsms/engine-client');
  const res = await sabsmsEngine.enqueueSend({
    workspaceId: ctx.userId,
    to,
    body,
    category,
    from: from || undefined,
    eventKey: 'sabsms.sabflow.send',
    tags: ['sabflow'],
  });

  const outputs: Record<string, unknown> = {};
  if (outputVariable) {
    outputs[outputVariable] = { messageId: res.id, status: res.status, segments: res.segments };
  }
  return {
    outputs,
    logs: [`SabSMS: enqueued SMS to ${to} (status ${res.status})`],
  };
}

async function waitForReply(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  if (!ctx.userId) {
    throw new Error('SabSMS: ctx.userId missing — cannot resolve the workspace.');
  }
  const phone = str(ctx.options.phone).trim();
  if (!phone) throw new Error('SabSMS wait_for_reply: "phone" is required');

  // Bounded: flows should not park for hours — that's a journey's job.
  const timeoutSeconds = Math.min(Math.max(num(ctx.options.timeoutSeconds, 60), 5), 600);
  const pollSeconds = Math.min(Math.max(num(ctx.options.pollSeconds, 5), 2), 30);
  const outputVariable = str(ctx.options.outputVariable);

  const { connectToDatabase } = await import('@/lib/mongodb');
  const { db } = await connectToDatabase();
  const messages = db.collection('sabsms_messages');

  const since = new Date();
  const deadline = since.getTime() + timeoutSeconds * 1000;

  for (;;) {
    const reply = await messages.findOne(
      {
        workspaceId: ctx.userId,
        direction: 'inbound',
        from: phone,
        createdAt: { $gte: since },
      },
      { sort: { createdAt: 1 }, projection: { body: 1, createdAt: 1 } },
    );
    if (reply) {
      const outputs: Record<string, unknown> = {};
      if (outputVariable) {
        outputs[outputVariable] = {
          replied: true,
          body: (reply as { body?: string }).body ?? '',
          messageId: String(reply._id),
        };
      }
      return {
        outputs,
        selectedOutput: 'replied',
        logs: [`SabSMS: reply received from ${phone}`],
      };
    }
    if (Date.now() + pollSeconds * 1000 > deadline) break;
    await new Promise((r) => setTimeout(r, pollSeconds * 1000));
  }

  const outputs: Record<string, unknown> = {};
  if (outputVariable) outputs[outputVariable] = { replied: false };
  return {
    outputs,
    selectedOutput: 'timeout',
    logs: [`SabSMS: no reply from ${phone} within ${timeoutSeconds}s`],
  };
}

const block: ForgeBlock = {
  id: 'forge_sabsms',
  name: 'SabSMS',
  description:
    'Send SMS through SabSMS (compliance, credits, and routing included) and wait for inbound replies.',
  iconName: 'LuMessageSquare',
  category: 'Integration',
  actions: [
    {
      id: 'send_sms',
      label: 'Send SMS',
      description:
        'Enqueue an SMS through the SabSMS engine — the same path as the composer (suppressions, quiet hours, credits all apply).',
      fields: [
        {
          id: 'to',
          label: 'To Number',
          type: 'text',
          placeholder: '+15557654321 or {{phone}}',
          required: true,
          helperText: 'E.164 destination number.',
        },
        { id: 'body', label: 'Message', type: 'textarea', required: true },
        {
          id: 'category',
          label: 'Category',
          type: 'select',
          options: CATEGORY_OPTIONS,
          defaultValue: 'transactional',
          helperText: 'Drives compliance rules (quiet hours, consent) and routing.',
        },
        {
          id: 'from',
          label: 'From (optional)',
          type: 'text',
          placeholder: '+15551234567 or sender ID',
          helperText: 'Leave empty to let SabSMS routing pick the sender.',
        },
        { id: 'outputVariable', label: 'Save result to variable', type: 'variable' },
      ],
      run: sendSms,
    },
    {
      id: 'wait_for_reply',
      label: 'Wait for Reply',
      description:
        'Poll for an inbound SMS from a number (max 10 minutes). For longer waits, use a SabSMS journey.',
      fields: [
        {
          id: 'phone',
          label: 'Phone',
          type: 'text',
          placeholder: '+15557654321 or {{phone}}',
          required: true,
        },
        {
          id: 'timeoutSeconds',
          label: 'Timeout (seconds)',
          type: 'number',
          defaultValue: 60,
          helperText: '5–600 seconds. The flow takes the "timeout" output when it elapses.',
        },
        {
          id: 'pollSeconds',
          label: 'Poll interval (seconds)',
          type: 'number',
          defaultValue: 5,
        },
        { id: 'outputVariable', label: 'Save reply to variable', type: 'variable' },
      ],
      outputs: [
        { name: 'replied', displayName: 'Replied' },
        { name: 'timeout', displayName: 'Timeout' },
      ],
      run: waitForReply,
    },
  ],
};

registerForgeBlock(block);

export default block;
