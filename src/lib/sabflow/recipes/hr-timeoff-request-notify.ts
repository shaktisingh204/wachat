/**
 * Recipe: Time-off request → notify manager + update calendar.
 *
 * HRIS posts a `timeoff_requested` webhook. We email the manager with
 * accept/decline links, drop the OOO entry into the shared Google
 * Calendar, and post the request to #team-timeoff.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'hr-timeoff-request-notify',
  name: 'HR: Time-off request → manager + calendar',
  category: 'onboarding',
  description:
    'When a time-off request comes in, email the manager with approve/decline links, add a tentative OOO entry on the shared Google Calendar, and post to #team-timeoff.',
  tags: ['hr', 'timeoff', 'pto', 'calendar', 'manager'],
  trigger: {
    id: 't_timeoff',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'webhook_received',
    options: {
      path: '/webhooks/hr/timeoff-requested',
      method: 'POST',
      authentication: 'header',
      authHeaderName: 'X-HRIS-Signature',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_employee_name', name: 'employee.name', defaultValue: '' },
    { id: 'v_employee_email', name: 'employee.workEmail', defaultValue: '' },
    { id: 'v_manager_email', name: 'manager.email', defaultValue: '' },
    { id: 'v_start', name: 'timeoff.start', defaultValue: '' },
    { id: 'v_end', name: 'timeoff.end', defaultValue: '' },
    { id: 'v_request_id', name: 'timeoff.requestId', defaultValue: '' },
    { id: 'v_calendar_id', name: 'calendar.id', defaultValue: 'team-ooo@group.calendar.google.com' },
  ],
  blocks: [
    {
      id: 'b_email_manager',
      groupId: 'g_email',
      type: 'send_email',
      options: {
        to: '{{manager.email}}',
        subject: '{{employee.name}} requested time off ({{timeoff.start}} → {{timeoff.end}})',
        bodyType: 'html',
        body:
          '<p>{{employee.name}} requested time off from <strong>{{timeoff.start}}</strong> to ' +
          '<strong>{{timeoff.end}}</strong>.</p>' +
          '<p>' +
          '  <a href="https://hr.example.com/timeoff/{{timeoff.requestId}}/approve">Approve</a> · ' +
          '  <a href="https://hr.example.com/timeoff/{{timeoff.requestId}}/decline">Decline</a>' +
          '</p>',
      },
    },
    {
      id: 'b_calendar',
      groupId: 'g_calendar',
      type: 'webhook',
      options: {
        url: 'https://www.googleapis.com/calendar/v3/calendars/{{calendar.id}}/events',
        method: 'POST',
        headers: [
          { id: 'h1', key: 'Authorization', value: 'Bearer {{GOOGLE_CAL_TOKEN}}' },
          { id: 'h2', key: 'Content-Type', value: 'application/json' },
        ],
        body: {
          type: 'json',
          content:
            '{"summary":"{{employee.name}} — OOO (pending)","start":{"date":"{{timeoff.start}}"},"end":{"date":"{{timeoff.end}}"},"transparency":"transparent"}',
        },
      },
    },
    {
      id: 'b_slack',
      groupId: 'g_slack',
      type: 'forge_slack',
      options: {
        action: 'send_message',
        channel: '#team-timeoff',
        text:
          ':palm_tree: {{employee.name}} requested time off: *{{timeoff.start}} → {{timeoff.end}}* (pending {{manager.email}}).',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
