/**
 * Forge block: GitLab Trigger (info shim).
 *
 * This is a registration-info shim. The actual incoming webhook is handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`. The block doesn't
 * subscribe at the upstream service — the flow author must register the URL
 * manually OR a future automation wave will add auto-subscribe via the
 * service's API.
 *
 * Source: n8n-master/packages/nodes-base/nodes/Gitlab/GitlabTrigger.node.ts
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
  'note',
  'confidential_issues',
  'confidential_note',
  'deployment',
  'issues',
  'job',
  'merge_requests',
  'pipeline',
  'push',
  'releases',
  'tag_push',
  'wiki_page',
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
      service: 'GitLab',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selectedEvents: eventTypes,
      registrationDocs: 'https://docs.gitlab.com/ee/user/project/integrations/webhooks.html',
      registrationInstructions:
        `Add a webhook in GitLab → Project Settings → Webhooks pointing at ${sabflowReceiverUrl} and tick the trigger checkboxes that match supportedEvents.`,
    },
    logs: [`GitLab trigger info → ${KNOWN_EVENTS.length} known event types`],
  };
}

const block: ForgeBlock = {
  id: 'forge_gitlab_trigger',
  name: 'GitLab Trigger (info)',
  description:
    'Returns the SabFlow webhook URL pattern + GitLab webhook event names n8n supports. Register the URL in GitLab manually.',
  iconName: 'LuGitBranch',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + the GitLab event names to subscribe to.',
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
          placeholder: '["push", "merge_requests"]',
          helperText: `One or more of: ${KNOWN_EVENTS.join(', ')}.`,
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
