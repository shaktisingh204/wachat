/**
 * SabSMS v3 — the omnichannel dispatcher.
 *
 * One entry point for every outbound message. It resolves the channel
 * adapter, runs the compliance pre-flight (the single cross-channel
 * suppression/governance gate), then hands off. Adapters and the
 * pre-flight are injectable so the routing + governance logic is
 * unit-testable without Mongo, network, or the sibling modules.
 *
 *   const r = await dispatch('whatsapp', { e164: '+1555…' }, { body }, ctx);
 *   //         ^ blocked here if the contact STOP'd on SMS — one ledger.
 */

import { compliancePreflight, type PreflightDeps } from './compliance-preflight';
import { smsAdapter } from './adapters/sms';
import { whatsappAdapter } from './adapters/whatsapp';
import { emailAdapter } from './adapters/email';
import { voiceAdapter } from './adapters/voice';
import { chatAdapter } from './adapters/chat';
import type {
  ChannelAdapter,
  DispatchContext,
  DispatchPayload,
  DispatchRecipient,
  DispatchResult,
  SabsmsDispatchChannel,
} from './types';

/** The default channel → adapter registry. The SMS adapter serves the
 *  three native channels; the rest hand off to sibling modules. */
const DEFAULT_ADAPTERS: Record<SabsmsDispatchChannel, ChannelAdapter> = {
  sms: smsAdapter,
  mms: smsAdapter,
  rcs: smsAdapter,
  whatsapp: whatsappAdapter,
  email: emailAdapter,
  voice: voiceAdapter,
  chat: chatAdapter,
};

export interface DispatchDeps {
  /** Override individual adapters (tests / future routing experiments). */
  adapters?: Partial<Record<SabsmsDispatchChannel, ChannelAdapter>>;
  /** Override the pre-flight gate itself (tests). */
  preflight?: typeof compliancePreflight;
  /** Dependencies passed to the default pre-flight (e.g. `isSuppressed`). */
  preflightDeps?: PreflightDeps;
}

export async function dispatch(
  channel: SabsmsDispatchChannel,
  recipient: DispatchRecipient,
  payload: DispatchPayload,
  ctx: DispatchContext,
  deps: DispatchDeps = {},
): Promise<DispatchResult> {
  const adapter = deps.adapters?.[channel] ?? DEFAULT_ADAPTERS[channel];
  if (!adapter) {
    return {
      channelUsed: channel,
      status: 'not_configured',
      error: `No adapter registered for channel "${channel}".`,
    };
  }

  // Governance runs FIRST — before any adapter — so every channel shares
  // one suppression/consent ledger.
  const preflight = deps.preflight ?? compliancePreflight;
  const verdict = await preflight(
    { workspaceId: ctx.workspaceId, channel, recipient, ctx },
    deps.preflightDeps,
  );
  if (!verdict.allow) {
    return {
      channelUsed: channel,
      status: 'blocked',
      blockedReason: verdict.reason,
    };
  }

  try {
    return await adapter.dispatch(channel, recipient, payload, ctx);
  } catch (err) {
    return {
      channelUsed: channel,
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
