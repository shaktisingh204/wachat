/**
 * SMS / MMS / RCS adapter — fans out to the SabSMS Rust engine via
 * `sabsmsEngine.enqueueSend`. This is the native, fully-wired channel;
 * the engine still runs its own compliance kernel, so this path is
 * defense-in-depth behind the dispatcher's pre-flight.
 *
 * The engine client is dynamic-imported so this module stays light for
 * unit tests (the dispatcher tests inject fake adapters and never load it).
 */

import type { SabsmsChannel, SabsmsMessageStatus } from '../../types';
import type {
  ChannelAdapter,
  DispatchResult,
  DispatchStatus,
  SabsmsDispatchChannel,
} from '../types';

const ENGINE_CHANNEL: Record<string, SabsmsChannel> = {
  sms: 'sms',
  mms: 'mms',
  rcs: 'rcs',
};

function mapEngineStatus(s: SabsmsMessageStatus): DispatchStatus {
  switch (s) {
    case 'suppressed':
      return 'suppressed';
    case 'failed':
    case 'rejected':
    case 'undelivered':
      return 'failed';
    // queued / sending / sent / delivered are all "accepted, in-flight"
    // from the dispatcher's synchronous vantage point.
    default:
      return 'queued';
  }
}

export const smsAdapter: ChannelAdapter = {
  async dispatch(
    channel: SabsmsDispatchChannel,
    recipient,
    payload,
    ctx,
  ): Promise<DispatchResult> {
    if (!recipient.e164) {
      return {
        channelUsed: channel,
        status: 'failed',
        error: 'SMS/MMS/RCS requires an E.164 recipient (recipient.e164).',
      };
    }

    const { sabsmsEngine } = await import('../../engine-client');
    const res = await sabsmsEngine.enqueueSend({
      workspaceId: ctx.workspaceId,
      to: recipient.e164,
      body: payload.body ?? '',
      category: ctx.category,
      channel: ENGINE_CHANNEL[channel] ?? 'sms',
      from: ctx.from,
      templateId: payload.templateId,
      campaignId: ctx.campaignId,
      contactId: ctx.contactId ?? recipient.contactId,
      idempotencyKey: ctx.idempotencyKey,
      mediaUrls: payload.mediaUrls,
      rcs: payload.rcs,
      tags: ctx.tags,
    });

    return {
      channelUsed: channel,
      status: mapEngineStatus(res.status),
      providerMessageId: res.id || undefined,
      cost: res.estimatedCost,
    };
  },
};
