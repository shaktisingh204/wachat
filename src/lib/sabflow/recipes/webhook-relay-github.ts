/**
 * Recipe: GitHub webhook relay → Slack engineering channel.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'webhook-relay-github',
  name: 'Webhook relay: GitHub',
  category: 'ops',
  description:
    'Receive GitHub repo webhooks (PRs, issues) and announce them in an engineering Slack channel.',
  tags: ['webhook', 'github', 'relay', 'slack', 'ops'],
  trigger: {
    id: 't_gh_hook',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'github_event',
    options: {
      path: '/webhooks/github',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_channel', name: 'slack.channel', defaultValue: '#engineering' },
  ],
  blocks: [
    {
      id: 'b_slack',
      groupId: 'g_slack',
      type: 'forge_slack',
      options: {
        action: 'send_message',
        channel: '{{slack.channel}}',
        text:
          ':octocat: *{{ $json.headers["x-github-event"] }}* on {{ $json.body.repository.full_name }} — {{ $json.body.action }}',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
