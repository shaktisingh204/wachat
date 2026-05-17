/**
 * Recipe: Quarterly expense categorization — Brex/Ramp → QuickBooks.
 *
 * Cron fires on the 1st of every quarter. We pull last quarter's
 * uncategorised Brex transactions, ask GPT-4 to suggest an expense category
 * + GL code for each, then push the categorised lines into QuickBooks
 * Online's JournalEntry endpoint.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'finance-quarterly-expense-categorize',
  name: 'Finance: Quarterly expense categorization',
  category: 'finance',
  description:
    'Each quarter, pull uncategorised Brex transactions, AI-classify them into QuickBooks GL codes, and post the journal entries.',
  tags: ['finance', 'brex', 'quickbooks', 'expenses', 'ai'],
  trigger: {
    id: 't_quarter_start',
    type: 'schedule',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'schedule_tick',
    options: { cronExpression: '0 6 1 1,4,7,10 *' },
  },
  variables: [
    { id: 'v_brex_token', name: 'brex.token', defaultValue: '' },
    { id: 'v_qbo_realm', name: 'qbo.realmId', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_pull',
      groupId: 'g_pull',
      type: 'webhook',
      options: {
        url: 'https://platform.brexapis.com/v2/transactions/card/primary?status=uncategorized&limit=500',
        method: 'GET',
        headers: [{ id: 'h1', key: 'Authorization', value: 'Bearer {{brex.token}}' }],
      },
    },
    {
      id: 'b_loop',
      groupId: 'g_loop',
      type: 'loop',
      options: { items: '{{ $json.items }}', itemVariable: 'txn' },
    },
    {
      id: 'b_classify',
      groupId: 'g_ai',
      type: 'open_ai',
      options: {
        model: 'gpt-4o-mini',
        task: 'ask_assistant',
        systemPrompt:
          'You categorize SaaS company expenses. Return JSON: { "gl_code": "6XXX", "category": "...", "confidence": 0..1 }. Common codes: 6010 Software, 6020 Travel, 6030 Meals, 6040 Marketing, 6050 Office, 6060 Professional Services.',
        userMessage:
          'Merchant: {{txn.merchant.raw_descriptor}} | Amount: {{txn.amount.amount}} {{txn.amount.currency}} | Card user: {{txn.card_holder.first_name}}',
        temperature: 0,
        maxTokens: 80,
        responseVariable: 'classification',
        messagesFormat: 'last',
      },
    },
    {
      id: 'b_post_qbo',
      groupId: 'g_post',
      type: 'webhook',
      options: {
        url: 'https://quickbooks.api.intuit.com/v3/company/{{qbo.realmId}}/journalentry',
        method: 'POST',
        headers: [
          { id: 'h1', key: 'Authorization', value: 'Bearer {{QBO_TOKEN}}' },
          { id: 'h2', key: 'Accept', value: 'application/json' },
          { id: 'h3', key: 'Content-Type', value: 'application/json' },
        ],
        body: {
          type: 'json',
          content:
            '{"TxnDate":"{{txn.posted_at_date}}","Line":[{"DetailType":"JournalEntryLineDetail","Amount":{{txn.amount.amount}},"JournalEntryLineDetail":{"PostingType":"Debit","AccountRef":{"value":"{{ $json.classification.gl_code }}"}}}],"PrivateNote":"Brex txn {{txn.id}} — {{ $json.classification.category }}"}',
        },
      },
    },
    {
      id: 'b_slack_done',
      groupId: 'g_done',
      type: 'forge_slack',
      options: {
        action: 'send_message',
        channel: '#finance-ops',
        text: ':white_check_mark: Quarterly Brex → QuickBooks categorization complete. Review the journal entries in QBO.',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
