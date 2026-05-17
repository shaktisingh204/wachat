/**
 * Recipe: New LinkedIn job posting → ATS pipeline.
 *
 * Watches a Lever ATS webhook for new openings. When one is published, we
 * post the job to LinkedIn via the Job Postings API, drop a record into the
 * recruiting CRM Pipeline, and notify #hiring in Slack so the recruiter can
 * start sourcing immediately.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'social-linkedin-job-to-ats',
  name: 'Social: LinkedIn job posting → ATS pipeline',
  category: 'marketing',
  description:
    'When a Lever opening is published, syndicate it to LinkedIn, open a recruiting CRM pipeline, and brief the team in Slack.',
  tags: ['social', 'linkedin', 'lever', 'recruiting', 'jobs'],
  trigger: {
    id: 't_lever_published',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'webhook_received',
    options: {
      path: '/webhooks/lever/posting-published',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_title', name: 'job.title', defaultValue: '' },
    { id: 'v_location', name: 'job.location', defaultValue: 'Remote' },
    { id: 'v_team', name: 'job.team', defaultValue: 'Engineering' },
    { id: 'v_lever_id', name: 'job.leverId', defaultValue: '' },
    { id: 'v_description', name: 'job.description', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_extract',
      groupId: 'g_extract',
      type: 'set_variable',
      options: { variableName: 'job.title', value: '{{ $json.body.data.text }}' },
    },
    {
      id: 'b_linkedin_post',
      groupId: 'g_linkedin',
      type: 'webhook',
      options: {
        url: 'https://api.linkedin.com/v2/simpleJobPostings',
        method: 'POST',
        headers: [
          { id: 'h1', key: 'Authorization', value: 'Bearer {{LINKEDIN_TOKEN}}' },
          { id: 'h2', key: 'Content-Type', value: 'application/json' },
          { id: 'h3', key: 'X-Restli-Protocol-Version', value: '2.0.0' },
        ],
        body: {
          type: 'json',
          content:
            '{"companyApplyUrl":"https://jobs.lever.co/sabnode/{{job.leverId}}","description":"{{job.description}}","employmentStatus":"FULL_TIME","externalJobPostingId":"{{job.leverId}}","listedAt":{{ $now }},"jobPostingOperationType":"CREATE","title":"{{job.title}}","location":"{{job.location}}","workplaceTypes":["REMOTE"]}',
        },
      },
    },
    {
      id: 'b_ats_pipeline',
      groupId: 'g_pipeline',
      type: 'webhook',
      options: {
        url: '/api/recruiting/pipelines',
        method: 'POST',
        headers: [{ id: 'h1', key: 'Content-Type', value: 'application/json' }],
        body: {
          type: 'json',
          content:
            '{"role":"{{job.title}}","team":"{{job.team}}","leverPostingId":"{{job.leverId}}","stages":["sourced","screen","onsite","offer","hired"],"openedAt":"{{ $now }}"}',
        },
      },
    },
    {
      id: 'b_slack',
      groupId: 'g_slack',
      type: 'forge_slack',
      options: {
        action: 'send_message',
        channel: '#hiring',
        text:
          ':newspaper: *New role open*: {{job.title}} ({{job.team}}, {{job.location}})\n' +
          'LinkedIn post is live. Lever: https://jobs.lever.co/sabnode/{{job.leverId}}',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
