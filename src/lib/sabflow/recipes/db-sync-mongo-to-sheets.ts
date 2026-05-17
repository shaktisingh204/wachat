/**
 * Recipe: Mongo collection → Google Sheets sync.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'db-sync-mongo-to-sheets',
  name: 'DB sync: Mongo → Google Sheets',
  category: 'ops',
  description:
    'On a schedule, query a MongoDB collection and append the new rows to a Google Sheet.',
  tags: ['sync', 'mongo', 'google sheets', 'database', 'schedule'],
  trigger: {
    id: 't_hourly',
    type: 'schedule',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'schedule_tick',
    options: { cronExpression: '0 * * * *' },
  },
  variables: [
    { id: 'v_collection', name: 'mongo.collection', defaultValue: 'orders' },
    { id: 'v_sheet', name: 'sheet.id', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_query',
      groupId: 'g_query',
      type: 'webhook',
      options: {
        url: '/api/internal/mongo/{{mongo.collection}}/recent',
        method: 'GET',
      },
    },
    {
      id: 'b_append',
      groupId: 'g_append',
      type: 'webhook',
      options: {
        url: 'https://sheets.googleapis.com/v4/spreadsheets/{{sheet.id}}/values/Sheet1:append?valueInputOption=RAW',
        method: 'POST',
        headers: [
          { id: 'h1', key: 'Authorization', value: 'Bearer {{GOOGLE_TOKEN}}' },
          { id: 'h2', key: 'Content-Type', value: 'application/json' },
        ],
        body: { type: 'json', content: '{"values":{{ $json.rows }}}' },
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
