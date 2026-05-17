/**
 * Recipe: Offboarding → create equipment-return checklist + tasks.
 *
 * Triggered by the offboarding webhook; fetches the employee's
 * assigned assets from the asset-tracker API and creates a checklist
 * ticket plus an email to the employee with the return label PDF.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'hr-offboarding-equipment-return',
  name: 'HR: Offboarding equipment-return checklist',
  category: 'onboarding',
  description:
    'On offboarding, pull the employee\'s assigned equipment from the asset tracker, create a return-checklist ticket, and email the employee with a prepaid return-label PDF.',
  tags: ['hr', 'offboarding', 'equipment', 'checklist', 'assets'],
  trigger: {
    id: 't_equipment_return',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'hr_termination',
    options: {
      path: '/webhooks/hr/equipment-return',
      method: 'POST',
      authentication: 'header',
      authHeaderName: 'X-HRIS-Signature',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_employee_email', name: 'employee.workEmail', defaultValue: '' },
    { id: 'v_employee_personal', name: 'employee.personalEmail', defaultValue: '' },
    { id: 'v_assets', name: 'employee.assets', defaultValue: '[]' },
    { id: 'v_assets_count', name: 'employee.assetsCount', defaultValue: '0' },
    { id: 'v_label_url', name: 'returnLabelPdfUrl', defaultValue: '' },
    { id: 'v_ticket_id', name: 'checklist.ticketId', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_fetch_assets',
      groupId: 'g_fetch',
      type: 'webhook',
      options: {
        url: '/api/it/assets/by-user?email={{employee.workEmail}}',
        method: 'GET',
        responseMappings: [
          { id: 'rm1', jsonPath: 'assets', variableId: 'v_assets' },
          { id: 'rm2', jsonPath: 'count', variableId: 'v_assets_count' },
          { id: 'rm3', jsonPath: 'returnLabelPdfUrl', variableId: 'v_label_url' },
        ],
      },
    },
    {
      id: 'b_create_ticket',
      groupId: 'g_ticket',
      type: 'webhook',
      options: {
        url: '/api/crm/tickets',
        method: 'POST',
        headers: [{ id: 'h1', key: 'Content-Type', value: 'application/json' }],
        body: {
          type: 'json',
          content:
            '{"subject":"Equipment return — {{employee.workEmail}}","queue":"it-offboarding","priority":"normal","body":"Assets to recover ({{employee.assetsCount}}): {{employee.assets}}"}',
        },
        responseMappings: [
          { id: 'rm1', jsonPath: 'id', variableId: 'v_ticket_id' },
        ],
      },
    },
    {
      id: 'b_email',
      groupId: 'g_email',
      type: 'send_email',
      options: {
        to: '{{employee.personalEmail}}',
        subject: 'Returning your equipment',
        bodyType: 'html',
        body:
          '<p>Thanks for your service — please return the assets listed below within 14 days:</p>' +
          '<pre>{{employee.assets}}</pre>' +
          '<p>Prepaid return label: <a href="{{returnLabelPdfUrl}}">download PDF</a></p>' +
          '<p>Tracking ticket: <code>{{checklist.ticketId}}</code></p>',
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
