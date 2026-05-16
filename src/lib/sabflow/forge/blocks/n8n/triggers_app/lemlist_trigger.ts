/**
 * Forge block: Lemlist Trigger (info shim).
 *
 * Registration-info shim. The actual incoming webhook is handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`. The flow author must
 * register the URL via the Lemlist hooks API.
 *
 * Source: n8n-master/packages/nodes-base/nodes/Lemlist/LemlistTrigger.node.ts
 * Event list source: n8n-master/packages/nodes-base/nodes/Lemlist/GenericFunctions.ts (getEvents)
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

const KNOWN_EVENTS = [
  '*',
  'contacted',
  'hooked',
  'attracted',
  'warmed',
  'interested',
  'skipped',
  'notInterested',
  'emailsSent',
  'emailsOpened',
  'emailsClicked',
  'emailsReplied',
  'emailsBounced',
  'emailsSendFailed',
  'emailsFailed',
  'emailsUnsubscribed',
  'emailsInterested',
  'emailsNotInterested',
  'opportunitiesDone',
  'aircallCreated',
  'aircallEnded',
  'aircallDone',
  'aircallInterested',
  'aircallNotInterested',
  'apiDone',
  'apiInterested',
  'apiNotInterested',
  'apiFailed',
  'linkedinVisitDone',
  'linkedinVisitFailed',
  'linkedinInviteDone',
  'linkedinInviteFailed',
  'linkedinInviteAccepted',
  'linkedinReplied',
  'linkedinSent',
  'linkedinVoiceNoteDone',
  'linkedinVoiceNoteFailed',
  'linkedinInterested',
  'linkedinNotInterested',
  'linkedinSendFailed',
  'manualInterested',
  'manualNotInterested',
  'paused',
  'resumed',
  'customDomainErrors',
  'connectionIssue',
  'sendLimitReached',
  'lemwarmPaused',
] as const;

async function register_trigger_info(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webhookId = asString(ctx.options.webhookId);
  const eventTypesRaw = ctx.options.eventTypes;
  const eventTypes = Array.isArray(eventTypesRaw)
    ? eventTypesRaw.map(asString).filter(Boolean)
    : [];
  const campaignId = asString(ctx.options.campaignId);
  const sabflowReceiverUrl = webhookId
    ? `${BASE_URL}/api/sabflow/webhook/${webhookId}`
    : '(webhook id not minted yet — see SabFlow Connections)';
  return {
    outputs: {
      service: 'Lemlist',
      sabflowReceiverUrl,
      knownEvents: KNOWN_EVENTS,
      selectedEvents: eventTypes,
      campaignId,
      registrationDocs: 'https://developer.lemlist.com/',
      registrationInstructions:
        `POST https://api.lemlist.com/api/hooks with { targetUrl: "${sabflowReceiverUrl}", type, campaignId? } using HTTP basic auth (apiKey as password). Use "*" for all events.`,
    },
    logs: [`Lemlist trigger info → ${KNOWN_EVENTS.length} known event types`],
  };
}

const block: ForgeBlock = {
  id: 'forge_lemlist_trigger',
  name: 'Lemlist Trigger (info)',
  description:
    'Returns the SabFlow webhook URL + Lemlist event types. Register it via the Lemlist hooks API (POST /api/hooks).',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + Lemlist event types.',
      fields: [
        {
          id: 'webhookId',
          label: 'SabFlow webhook id',
          type: 'text',
          placeholder: 'minted by SabFlow Connections',
          helperText: 'Leave blank to preview the URL pattern.',
        },
        {
          id: 'eventTypes',
          label: 'Event types (JSON array)',
          type: 'json',
          placeholder: '["emailsOpened", "emailsReplied"]',
          helperText: `One or more of: ${KNOWN_EVENTS.join(', ')}.`,
        },
        {
          id: 'campaignId',
          label: 'Campaign id (optional)',
          type: 'text',
          placeholder: '_abc123',
          helperText: 'Restrict the hook to a single Lemlist campaign.',
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
