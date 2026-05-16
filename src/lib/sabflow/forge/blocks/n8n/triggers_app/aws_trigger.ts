/**
 * Forge block: AWS SNS Trigger (info shim).
 *
 * Registration-info shim. The actual incoming webhook is handled by
 * `src/app/api/sabflow/webhook/[webhookId]/route.ts`.
 *
 * Source: n8n-master/packages/nodes-base/nodes/Aws/AwsSnsTrigger.node.ts
 *
 * AWS SNS push subscriptions deliver one of two message types to the
 * receiver — `Notification` (a fan-out delivery) or a control message
 * (`SubscriptionConfirmation` / `UnsubscribeConfirmation`). The
 * subscription itself is created with `aws sns subscribe`.
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
  'Notification',
  'SubscriptionConfirmation',
  'UnsubscribeConfirmation',
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
      service: 'AWS SNS',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selectedEvents: eventTypes,
      registrationDocs: 'https://docs.aws.amazon.com/sns/latest/dg/sns-http-https-endpoint-as-subscriber.html',
      registrationInstructions:
        `Run "aws sns subscribe --topic-arn <topicArn> --protocol https --notification-endpoint ${sabflowReceiverUrl}" and confirm the subscription when SNS POSTs the SubscribeURL.`,
    },
    logs: [`AWS SNS trigger info → ${KNOWN_EVENTS.length} known SNS message types`],
  };
}

const block: ForgeBlock = {
  id: 'forge_aws_trigger',
  name: 'AWS SNS Trigger (info)',
  description:
    'Returns the SabFlow webhook URL pattern for an AWS SNS HTTPS subscription. Subscribe to the topic via the AWS CLI / SDK manually.',
  iconName: 'LuCloud',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + the SNS message types to expect.',
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
          placeholder: '["Notification"]',
          helperText: `One or more of: ${KNOWN_EVENTS.join(', ')}.`,
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
