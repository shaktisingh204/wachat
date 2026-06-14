/**
 * SabChat outbound-webhook event names.
 *
 * Lives here (not in the `'use server'` ops actions module) because a
 * `'use server'` file may only export async functions — this const is consumed
 * by the admin client component to render the event checklist.
 */
export const SABCHAT_WEBHOOK_EVENTS = [
  'conversation.created',
  'conversation.updated',
  'conversation.resolved',
  'message.created',
  'contact.created',
  'csat.submitted',
] as const;
