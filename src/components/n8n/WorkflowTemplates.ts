import { N8NCanvasNode, N8NCanvasConnection } from './types';
import { createId } from '@paralleldrive/cuid2';

export type WorkflowTemplate = {
  id: string;
  name: string;
  description: string;
  nodes: N8NCanvasNode[];
  connections: N8NCanvasConnection[];
};

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'webhook-to-slack',
    name: 'Webhook to Slack',
    description: 'Trigger a Slack message when a webhook is received.',
    nodes: [
      {
        id: createId(),
        name: 'Webhook',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 1,
        position: [250, 300],
        parameters: { path: 'webhook-path', httpMethod: 'POST' },
      },
      {
        id: createId(),
        name: 'Slack',
        type: 'n8n-nodes-base.slack',
        typeVersion: 1,
        position: [600, 300],
        parameters: { channel: '#general', text: 'New webhook received!' },
      },
    ],
    connections: [
      {
        id: createId(),
        sourceNodeName: 'Webhook',
        sourceOutputIndex: 0,
        targetNodeName: 'Slack',
        targetInputIndex: 0,
      },
    ],
  },
  {
    id: 'daily-report-email',
    name: 'Daily Report Email',
    description: 'Fetch data from Google Sheets daily and send via Email.',
    nodes: [
      {
        id: createId(),
        name: 'Schedule',
        type: 'n8n-nodes-base.scheduleTrigger',
        typeVersion: 1,
        position: [150, 300],
        parameters: { rule: { type: 'cron', value: '0 8 * * *' } },
      },
      {
        id: createId(),
        name: 'Google Sheets',
        type: 'n8n-nodes-base.googleSheets',
        typeVersion: 1,
        position: [400, 300],
        parameters: { operation: 'read', sheetId: 'your-sheet-id' },
      },
      {
        id: createId(),
        name: 'Send Email',
        type: 'n8n-nodes-base.emailSend',
        typeVersion: 1,
        position: [700, 300],
        parameters: { to: 'admin@example.com', subject: 'Daily Report' },
      },
    ],
    connections: [
      {
        id: createId(),
        sourceNodeName: 'Schedule',
        sourceOutputIndex: 0,
        targetNodeName: 'Google Sheets',
        targetInputIndex: 0,
      },
      {
        id: createId(),
        sourceNodeName: 'Google Sheets',
        sourceOutputIndex: 0,
        targetNodeName: 'Send Email',
        targetInputIndex: 0,
      },
    ],
  },
];
