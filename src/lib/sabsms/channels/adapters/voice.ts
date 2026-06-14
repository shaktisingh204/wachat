/**
 * Voice adapter — orchestrates to SabCall (the sibling voice module being
 * set up). SabSMS does NOT implement voice; it hands off to SabCall, the
 * same way email is SabMail's job.
 *
 * BINDS WHEN SABCALL LANDS (used by V3.1 Verify as the voice-OTP fallback
 * rung): wire to the SabCall client at `src/app/api/v1/calling` /
 * `src/lib/calls`. Until then this returns `not_configured` cleanly so
 * Verify fallback simply skips the voice rung.
 */

import type { ChannelAdapter, DispatchResult, SabsmsDispatchChannel } from '../types';

export const voiceAdapter: ChannelAdapter = {
  async dispatch(channel: SabsmsDispatchChannel): Promise<DispatchResult> {
    return {
      channelUsed: channel,
      status: 'not_configured',
      error: 'Voice adapter binds to SabCall when that module lands (not yet wired).',
    };
  },
};
