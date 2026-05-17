/**
 * Recipe: Job-applicant form → notify hiring channel + ack candidate.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'form-processing-applicant',
  name: 'Form: Job applicant intake',
  category: 'ops',
  description:
    'A candidate submits a job-application form; we email an ack and ping the hiring Slack channel.',
  tags: ['form', 'hiring', 'ats', 'slack', 'ops'],
  trigger: {
    id: 't_applied',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'webhook_received',
    options: {
      path: '/webhooks/hiring/applied',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_email', name: 'candidate.email', defaultValue: '' },
    { id: 'v_role', name: 'role', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_ack',
      groupId: 'g_ack',
      type: 'send_email',
      options: {
        to: '{{candidate.email}}',
        subject: 'We got your application',
        body: 'Thanks for applying for {{role}} — we\'ll get back within a week.',
      },
    },
    {
      id: 'b_slack',
      groupId: 'g_slack',
      type: 'forge_slack',
      options: {
        action: 'send_message',
        channel: '#hiring',
        text: ':briefcase: New applicant for *{{role}}* — {{candidate.email}}',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
