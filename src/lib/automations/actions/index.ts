/**
 * Shared context every automation action receives. Kept in its own file
 * so the workflow + action handlers can import it without circular deps.
 */

import type {
    Automation,
    AutomationDomainEvent,
    AutomationEntitySnapshot,
} from '../types';

export interface ActionContext {
    automation: Automation;
    entity: AutomationEntitySnapshot;
    event: AutomationDomainEvent;
}
