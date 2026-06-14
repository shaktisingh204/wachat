/**
 * Live-chat adapter — orchestrates to SabChat (the Chatwoot-class
 * live-chat / support desk with embeddable website widgets). Used for
 * proactive widget messages and journey steps that target an active
 * web-chat session rather than a phone/email.
 *
 * BINDS IN V3.2: wire to SabChat (`src/lib/sabchat`, via
 * `runWithRustTenant` + the sabchat widget/message rust-client). Until
 * then this returns `not_configured`.
 */

import type { ChannelAdapter, DispatchResult, SabsmsDispatchChannel } from '../types';

export const chatAdapter: ChannelAdapter = {
  async dispatch(channel: SabsmsDispatchChannel): Promise<DispatchResult> {
    return {
      channelUsed: channel,
      status: 'not_configured',
      error: 'Live-chat adapter binds to SabChat in V3.2 (not yet wired).',
    };
  },
};
