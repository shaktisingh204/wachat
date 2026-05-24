export const WORKFLOW_TEMPLATES = [
  {
    name: 'Webhook to Slack',
    description: 'Triggered by a webhook, formats data, and sends a Slack message.',
    nodes: [
      { id: 'webhook-1', type: 'n8n-nodes-base.webhook', name: 'Webhook', position: [250, 300] },
      { id: 'slack-1', type: 'n8n-nodes-base.slack', name: 'Slack', position: [450, 300] }
    ],
    connections: { 'Webhook': { main: [[{ node: 'Slack', type: 'main', index: 0 }]] } }
  },
  {
    name: 'Daily Email Report',
    description: 'Runs daily at 8AM, queries database, and emails a summary report.',
    nodes: [
      { id: 'cron-1', type: 'n8n-nodes-base.cron', name: 'Cron', position: [250, 300] },
      { id: 'postgres-1', type: 'n8n-nodes-base.postgres', name: 'Postgres', position: [450, 300] },
      { id: 'email-1', type: 'n8n-nodes-base.emailSend', name: 'Email Send', position: [650, 300] }
    ],
    connections: { 'Cron': { main: [[{ node: 'Postgres', type: 'main', index: 0 }]] }, 'Postgres': { main: [[{ node: 'Email Send', type: 'main', index: 0 }]] } }
  },
  {
    name: 'Stripe Payment to CRM',
    description: 'Listens for Stripe successful payments and creates a record in HubSpot CRM.',
    nodes: [
      { id: 'stripe-1', type: 'n8n-nodes-base.stripeTrigger', name: 'Stripe Trigger', position: [250, 300] },
      { id: 'hubspot-1', type: 'n8n-nodes-base.hubspot', name: 'HubSpot', position: [450, 300] }
    ],
    connections: { 'Stripe Trigger': { main: [[{ node: 'HubSpot', type: 'main', index: 0 }]] } }
  }
];
