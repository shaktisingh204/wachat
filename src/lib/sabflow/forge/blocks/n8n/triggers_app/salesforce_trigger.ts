/**
 * Forge block: Salesforce Trigger (info shim).
 *
 * n8n's Salesforce trigger is polling-based — it does NOT register a webhook
 * subscription. It periodically SOQL-queries Salesforce for new/updated
 * records of a given resource. This shim returns the polling metadata + the
 * SabFlow webhook URL so a flow author can either:
 *   - Wire a Salesforce Flow / Apex trigger that callouts to the SabFlow URL
 *     on the matching event, OR
 *   - Drive a SabFlow Cron block that runs the equivalent SOQL query on a
 *     schedule.
 *
 * Source: n8n-master/packages/nodes-base/nodes/Salesforce/SalesforceTrigger.node.ts
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
  'accountCreated',
  'accountUpdated',
  'attachmentCreated',
  'attachmentUpdated',
  'caseCreated',
  'caseUpdated',
  'contactCreated',
  'contactUpdated',
  'customObjectCreated',
  'customObjectUpdated',
  'leadCreated',
  'leadUpdated',
  'opportunityCreated',
  'opportunityUpdated',
  'taskCreated',
  'taskUpdated',
  'userCreated',
  'userUpdated',
] as const;

async function register_trigger_info(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webhookId = asString(ctx.options.webhookId);
  const triggerOn = asString(ctx.options.triggerOn);
  const customObject = asString(ctx.options.customObject);

  const sabflowReceiverUrl = webhookId
    ? `${BASE_URL}/api/sabflow/webhook/${webhookId}`
    : '(webhook id not minted yet — see SabFlow Connections)';

  const isCreate = triggerOn.endsWith('Created');
  const dateField = isCreate ? 'CreatedDate' : 'LastModifiedDate';
  const resource = triggerOn.startsWith('customObject')
    ? customObject || '<CustomObject__c>'
    : triggerOn.slice(0, 1).toUpperCase() + triggerOn.slice(1).replace(/(Created|Updated)$/, '');

  return {
    outputs: {
      service: 'Salesforce',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selected: { triggerOn, customObject },
      registrationDocs:
        'https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/',
      registrationInstructions: [
        'Salesforce\'s n8n trigger is polling-based — there is no upstream subscription URL.',
        `1. Recommended: in Salesforce Setup → Flows, create a Record-Triggered Flow on ${resource} (When: ${isCreate ? 'a record is created' : 'a record is updated'}) with an HTTP Callout action POSTing the record to: ${sabflowReceiverUrl}`,
        `2. Or, drive a SabFlow Cron block that calls /services/data/v59.0/query?q=SELECT+Id,Name+FROM+${resource}+WHERE+${dateField}+>+:lastCheckedAt on a schedule and dedupes by Id.`,
      ].join('\n'),
    },
    logs: [`Salesforce trigger info → triggerOn=${triggerOn || '<unset>'}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_salesforce_trigger',
  name: 'Salesforce Trigger (info)',
  description:
    'Returns the SabFlow webhook URL pattern + the Salesforce polling metadata n8n uses (resource + create/update). Wire a Salesforce Flow callout to the URL or drive a SabFlow Cron block.',
  iconName: 'LuCloud',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description:
        'Return the SabFlow receiver URL + the Salesforce event metadata (resource + create/update + optional custom object).',
      fields: [
        {
          id: 'webhookId',
          label: 'SabFlow webhook id',
          type: 'text',
          placeholder: 'minted by SabFlow Connections',
          helperText: 'Leave blank to preview the URL pattern.',
        },
        {
          id: 'triggerOn',
          label: 'Trigger on',
          type: 'select',
          options: KNOWN_EVENTS.map((v) => ({ label: v, value: v })),
          helperText: `One of: ${KNOWN_EVENTS.join(', ')}.`,
        },
        {
          id: 'customObject',
          label: 'Custom object',
          type: 'text',
          placeholder: 'e.g. Invoice__c',
          helperText:
            'Required when triggerOn=customObjectCreated/customObjectUpdated. Salesforce API name (typically ends in __c).',
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;
