/**
 * Recipe: Cal.com booking → confirmation email + CRM note.
 */

import type { Recipe } from './types';
import { registerRecipe } from './registry';

const recipe: Recipe = {
  id: 'calendar-booking-confirm',
  name: 'Calendar: Booking confirmation',
  category: 'sales',
  description:
    'When Cal.com fires a booking webhook, send the invitee a confirmation email and log a CRM note.',
  tags: ['calendar', 'cal.com', 'booking', 'confirmation', 'crm'],
  trigger: {
    id: 't_booking',
    type: 'webhook',
    graphCoordinates: { x: 0, y: 0 },
    appEvent: 'calendar_booking_created',
    options: {
      path: '/webhooks/cal/booking',
      method: 'POST',
      authentication: 'none',
      responseMode: 'immediately',
      enabled: true,
    },
  },
  variables: [
    { id: 'v_email', name: 'invitee.email', defaultValue: '' },
    { id: 'v_when', name: 'booking.startTime', defaultValue: '' },
  ],
  blocks: [
    {
      id: 'b_confirm',
      groupId: 'g_confirm',
      type: 'send_email',
      options: {
        to: '{{invitee.email}}',
        subject: 'You\'re booked!',
        body: 'Confirmed for {{booking.startTime}}. Looking forward to it.',
      },
    },
    {
      id: 'b_note',
      groupId: 'g_note',
      type: 'webhook',
      options: {
        url: '/api/crm/notes',
        method: 'POST',
        headers: [{ id: 'h1', key: 'Content-Type', value: 'application/json' }],
        body: {
          type: 'json',
          content: '{"contactEmail":"{{invitee.email}}","note":"Booked for {{booking.startTime}}"}',
        },
      },
    },
  ],
};

registerRecipe(recipe);
export default recipe;
