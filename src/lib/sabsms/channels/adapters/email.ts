/**
 * Email adapter — orchestrates to SabMail. SabSMS does NOT implement
 * email; it hands off to SabMail's own-domain send path. Email suppression
 * is SabMail's own ledger, so the email path is intentionally NOT gated by
 * the phone suppression pre-flight.
 *
 * The SabMail module is dynamic-imported so this stays light for tests
 * (the dispatcher tests inject fake adapters and never load it).
 */

import type { ChannelAdapter, DispatchResult, SabsmsDispatchChannel } from '../types';

export const emailAdapter: ChannelAdapter = {
  async dispatch(
    channel: SabsmsDispatchChannel,
    recipient,
    payload,
    ctx,
  ): Promise<DispatchResult> {
    if (!recipient.email) {
      return {
        channelUsed: channel,
        status: 'failed',
        error: 'Email requires recipient.email.',
      };
    }
    if (!ctx.from) {
      return {
        channelUsed: channel,
        status: 'not_configured',
        error: 'No From address configured for the email channel.',
      };
    }

    const { sendSabmailOwnDomain } = await import('../../../sabmail/sending');
    const res = await sendSabmailOwnDomain({
      workspaceId: ctx.workspaceId,
      from: ctx.from,
      to: [recipient.email],
      subject: payload.subject ?? 'Notification',
      html: payload.html,
      text: payload.text ?? payload.body,
    });

    return res.ok
      ? { channelUsed: channel, status: 'sent' }
      : { channelUsed: channel, status: 'failed', error: res.error };
  },
};
