/**
 * CRM event bus — public surface.
 *
 * Action layers call `emitCrmEvent({ kind: 'lead.assigned', ... })` and
 * downstream features (notifications fan-out, automations engine,
 * webhook dispatcher) react via `subscribeCrmEvent(...)`.
 */

export {
  emitCrmEvent,
  subscribeCrmEvent,
} from './bus';
export type {
  CrmEvent,
  CrmEventHandler,
  CrmEventKind,
} from './bus';
