/**
 * Recipe: Appointment scheduler.
 *
 * Collects name + preferred date/time + reason for visit, then forwards
 * the booking request to Cal.com (or your scheduling backend) and
 * confirms the slot to the user.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'appointment-scheduler',
  name: 'Appointment scheduler',
  category: 'sales',
  description:
    'Capture name + date/time + reason, push the booking to Cal.com, and confirm the slot back to the visitor.',
  tags: ['booking', 'appointment', 'calendar', 'cal.com'],
  trigger: {
    id: 't_start',
    type: 'start',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'flow_started',
  },
  variables: [
    { id: 'v_name', name: 'name', defaultValue: '' },
    { id: 'v_when', name: 'when', defaultValue: '' },
    { id: 'v_reason', name: 'reason', defaultValue: '' },
    { id: 'v_cal_link', name: 'calLink', defaultValue: 'your-team/intro' },
  ],
  blocks: [
    {
      id: 'b_hello',
      groupId: 'g_intro',
      type: 'text',
      options: { content: "Let's get you booked — three quick questions." },
    },
    {
      id: 'b_name',
      groupId: 'g_questions',
      type: 'text_input',
      options: { placeholder: 'Your full name', variableId: 'v_name' },
    },
    {
      id: 'b_when',
      groupId: 'g_questions',
      type: 'date_input',
      options: {
        hasTime: true,
        variableId: 'v_when',
        labels: { button: 'Continue' },
      },
    },
    {
      id: 'b_reason',
      groupId: 'g_questions',
      type: 'text_input',
      options: {
        placeholder: 'Briefly — what would you like to cover?',
        isLong: true,
        variableId: 'v_reason',
      },
    },
    {
      id: 'b_book',
      groupId: 'g_book',
      type: 'cal_com',
      options: {
        link: '{{calLink}}',
        name: '{{name}}',
        when: '{{when}}',
        notes: '{{reason}}',
      },
    },
    {
      id: 'b_confirm',
      groupId: 'g_done',
      type: 'text',
      options: {
        content:
          "You're booked, {{name}} — confirmation hits your inbox shortly. See you on {{when}}!",
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
