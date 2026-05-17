/**
 * Recipe: Postgres rows → Airtable mirror.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'db-sync-postgres-to-airtable',
  name: 'DB sync: Postgres → Airtable',
  category: 'ops',
  description:
    'Periodically read recently-updated Postgres rows via an internal endpoint and mirror them into Airtable.',
  tags: ['sync', 'postgres', 'airtable', 'database'],
  trigger: {
    id: 't_pg_tick',
    type: 'schedule',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'schedule_tick',
    options: { cronExpression: '*/15 * * * *' },
  },
  variables: [
    { id: 'v_base', name: 'at.baseId', defaultValue: '' },
    { id: 'v_table', name: 'at.table', defaultValue: 'Mirror' },
  ],
  blocks: [
    {
      id: 'b_read',
      groupId: 'g_read',
      type: 'webhook',
      options: {
        url: '/api/internal/pg/recent-updates',
        method: 'GET',
      },
    },
    {
      id: 'b_mirror',
      groupId: 'g_mirror',
      type: 'forge_airtable',
      options: {
        action: 'create_record',
        baseId: '{{at.baseId}}',
        tableName: '{{at.table}}',
        fields: '{{ $json.row }}',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
