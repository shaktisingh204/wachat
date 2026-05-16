/**
 * Forge block: Bitbucket Trigger (info shim).
 *
 * Registration-info shim. The actual incoming webhook is handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`.
 *
 * Source: n8n-master/packages/nodes-base/nodes/Bitbucket/BitbucketTrigger.node.ts
 *
 * Bitbucket Cloud lists available event keys via its hook_events API; the
 * canonical set below covers the documented repository + workspace events.
 * See:
 *   https://developer.atlassian.com/cloud/bitbucket/rest/api-group-webhooks/
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
  'repo:push',
  'repo:fork',
  'repo:updated',
  'repo:commit_comment_created',
  'repo:commit_status_created',
  'repo:commit_status_updated',
  'issue:created',
  'issue:updated',
  'issue:comment_created',
  'pullrequest:created',
  'pullrequest:updated',
  'pullrequest:approved',
  'pullrequest:unapproved',
  'pullrequest:fulfilled',
  'pullrequest:rejected',
  'pullrequest:comment_created',
  'pullrequest:comment_updated',
  'pullrequest:comment_deleted',
] as const;

async function register_trigger_info(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webhookId = asString(ctx.options.webhookId);
  const eventTypesRaw = ctx.options.eventTypes;
  const eventTypes = Array.isArray(eventTypesRaw)
    ? eventTypesRaw.map(asString).filter(Boolean)
    : [];
  const sabflowReceiverUrl = webhookId
    ? `${BASE_URL}/api/sabflow/webhook/${webhookId}`
    : '(webhook id not minted yet — see SabFlow Connections)';
  return {
    outputs: {
      service: 'Bitbucket',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selectedEvents: eventTypes,
      registrationDocs: 'https://developer.atlassian.com/cloud/bitbucket/rest/api-group-webhooks/',
      registrationInstructions:
        `POST to https://api.bitbucket.org/2.0/repositories/{workspace}/{repo_slug}/hooks (or .../workspaces/{workspace}/hooks for a workspace hook) with url=${sabflowReceiverUrl} and events=[...one or more of supportedEvents].`,
    },
    logs: [`Bitbucket trigger info → ${KNOWN_EVENTS.length} known events`],
  };
}

const block: ForgeBlock = {
  id: 'forge_bitbucket_trigger',
  name: 'Bitbucket Trigger (info)',
  description:
    'Returns the SabFlow webhook URL pattern + Bitbucket event keys n8n supports. Register via the Bitbucket REST API manually.',
  iconName: 'LuGitBranch',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + the Bitbucket events to subscribe to.',
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
          placeholder: '["repo:push"]',
          helperText: `One or more of: ${KNOWN_EVENTS.join(', ')}.`,
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
