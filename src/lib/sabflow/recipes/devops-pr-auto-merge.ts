/**
 * Recipe: PR approved + CI green → automatic merge.
 *
 * GitHub fires `pull_request_review.submitted` and (separately)
 * `check_suite.completed`. This recipe accepts the approval webhook,
 * verifies the check-suite via the GitHub REST API, then PUTs the
 * merge.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'devops-pr-auto-merge',
  name: 'DevOps: PR approved → auto-merge on green CI',
  category: 'ops',
  description:
    'On a GitHub pull-request approval webhook, verify the latest check-suite is green via the REST API and auto-merge the PR using squash.',
  tags: ['github', 'pull-request', 'auto-merge', 'ci-cd', 'devops'],
  trigger: {
    id: 't_pr_approved',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'webhook_received',
    options: {
      path: '/webhooks/github/pr-approved',
      method: 'POST',
      authentication: 'header',
      authHeaderName: 'X-Hub-Signature-256',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_repo', name: 'pr.repo', defaultValue: '' },
    { id: 'v_number', name: 'pr.number', defaultValue: '' },
    { id: 'v_sha', name: 'pr.headSha', defaultValue: '' },
    { id: 'v_check_status', name: 'checks.conclusion', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_check_status',
      groupId: 'g_check_status',
      type: 'webhook',
      options: {
        url: 'https://api.github.com/repos/{{pr.repo}}/commits/{{pr.headSha}}/check-suites',
        method: 'GET',
        headers: [
          { id: 'h1', key: 'Authorization', value: 'Bearer {{GITHUB_TOKEN}}' },
          { id: 'h2', key: 'Accept', value: 'application/vnd.github+json' },
        ],
        responseMappings: [
          {
            id: 'rm1',
            jsonPath: 'check_suites.0.conclusion',
            variableId: 'v_check_status',
          },
        ],
      },
    },
    {
      id: 'b_branch',
      groupId: 'g_branch',
      type: 'condition',
      options: {
        logicalOperator: 'AND',
        conditionGroups: [
          {
            id: 'cg1',
            logicalOperator: 'AND',
            comparisons: [
              {
                id: 'c1',
                variableId: 'v_check_status',
                operator: 'Equal to',
                value: 'success',
              },
            ],
          },
        ],
      },
    },
    {
      id: 'b_merge',
      groupId: 'g_merge',
      type: 'webhook',
      options: {
        url: 'https://api.github.com/repos/{{pr.repo}}/pulls/{{pr.number}}/merge',
        method: 'PUT',
        headers: [
          { id: 'h1', key: 'Authorization', value: 'Bearer {{GITHUB_TOKEN}}' },
          { id: 'h2', key: 'Accept', value: 'application/vnd.github+json' },
        ],
        body: {
          type: 'json',
          content: '{"merge_method":"squash"}',
        },
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
