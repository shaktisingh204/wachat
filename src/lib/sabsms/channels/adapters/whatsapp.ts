/**
 * WhatsApp adapter — orchestrates to WaChat (the fully-working official
 * WhatsApp Business module). SabSMS does NOT implement WhatsApp; it hands
 * the send to WaChat's broadcast API with a single contact.
 *
 * Requires a per-workspace linkage (`SabsmsSettings.whatsapp`) mapping the
 * SabSMS workspace to a WaChat project + WABA phone number. Without it,
 * this degrades to `not_configured` and Verify falls back to the next
 * channel. WhatsApp business-initiated sends must use an approved template,
 * so `payload.templateId` is required.
 *
 * The WaChat call is tenant-scoped via `runWithRustTenant` (the documented
 * `tid = projectId` pattern); the config may override the tenant. WaChat
 * broadcasts are asynchronous, so there is no synchronous per-message id —
 * acceptance is reported as `queued`.
 */

import type { ChannelAdapter, DispatchResult, SabsmsDispatchChannel } from '../types';

export const whatsappAdapter: ChannelAdapter = {
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
        error: 'WhatsApp requires recipient.e164.',
      };
    }
    const templateId = payload.templateId;
    if (!templateId) {
      return {
        channelUsed: channel,
        status: 'failed',
        error: 'WhatsApp business-initiated sends require an approved templateId.',
      };
    }

    const { getSabsmsCollections } = await import('../../db/collections');
    const { cols } = await getSabsmsCollections();
    const settings = await cols.settings.findOne({ workspaceId: ctx.workspaceId });
    const cfg = settings?.whatsapp;
    if (!cfg?.wachatProjectId || !cfg?.phoneNumberId) {
      return {
        channelUsed: channel,
        status: 'not_configured',
        error: 'WhatsApp channel is not linked to a WaChat project for this workspace.',
      };
    }

    const [{ wachatBroadcastApi }, { runWithRustTenant }] = await Promise.all([
      import('../../../rust-client/wachat-broadcast'),
      import('../../../rust-client/fetcher'),
    ]);

    await runWithRustTenant(cfg.tenantId ?? cfg.wachatProjectId, () =>
      wachatBroadcastApi.apiStart({
        projectId: cfg.wachatProjectId,
        phoneNumberId: cfg.phoneNumberId,
        templateId,
        contacts: [
          {
            phone: recipient.e164!,
            name: recipient.contactId,
            variables: payload.templateParams ?? null,
          },
        ],
        variableMappings: payload.templateParams ?? undefined,
      }),
    );

    return { channelUsed: channel, status: 'queued' };
  },
};
