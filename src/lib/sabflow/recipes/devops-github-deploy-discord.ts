/**
 * Recipe: GitHub deployment_status webhook → Discord channel.
 *
 * Pipes GitHub `deployment_status` events into a Discord channel via
 * an incoming webhook so the team can watch production deploys in
 * real time.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'devops-github-deploy-discord',
  name: 'DevOps: GitHub deploy status → Discord',
  category: 'ops',
  description:
    'Forward GitHub `deployment_status` webhook events into a Discord channel with environment, state, and commit URL in a single embed.',
  tags: ['github', 'discord', 'deployments', 'ci-cd', 'devops'],
  trigger: {
    id: 't_gh_deploy',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'webhook_received',
    options: {
      path: '/webhooks/github/deployment',
      method: 'POST',
      authentication: 'header',
      authHeaderName: 'X-Hub-Signature-256',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_env', name: 'deploy.environment', defaultValue: 'production' },
    { id: 'v_state', name: 'deploy.state', defaultValue: 'success' },
    { id: 'v_sha', name: 'deploy.sha', defaultValue: '' },
    { id: 'v_log_url', name: 'deploy.logUrl', defaultValue: '' },
    { id: 'v_repo', name: 'deploy.repo', defaultValue: '' },
    {
      id: 'v_discord_url',
      name: 'discord.webhookUrl',
      defaultValue: 'https://discord.com/api/webhooks/xxx/yyy',
    },
  ],
  blocks: [
    {
      id: 'b_post',
      groupId: 'g_post',
      type: 'webhook',
      options: {
        url: '{{discord.webhookUrl}}',
        method: 'POST',
        headers: [{ id: 'h1', key: 'Content-Type', value: 'application/json' }],
        body: {
          type: 'json',
          content:
            '{"username":"GitHub Deploys","embeds":[{"title":"{{deploy.repo}} → {{deploy.environment}}","description":"State: **{{deploy.state}}**\\nCommit: `{{deploy.sha}}`","url":"{{deploy.logUrl}}","color":3066993}]}',
        },
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
