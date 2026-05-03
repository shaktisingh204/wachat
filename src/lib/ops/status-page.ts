/**
 * Public status-page projection.
 *
 * The status page is a flat, cacheable JSON document showing component
 * health and active incidents. The data model deliberately mirrors what most
 * status providers (statuspage.io, instatus, atlassian) emit so the view
 * layer can be ported elsewhere later.
 */

import type { Incident, IncidentStatus, StatusComponent } from './types';

/** Aggregate severity used in the top-of-page banner. */
export type OverallStatus =
    | 'operational'
    | 'degraded'
    | 'partial_outage'
    | 'major_outage'
    | 'maintenance';

export interface StatusSnapshot {
    overall: OverallStatus;
    updatedAt: number;
    components: StatusComponent[];
    incidents: Incident[];
}

/** In-memory status registry. Replace with persistent store in production. */
export class StatusPageStore {
    private components = new Map<string, StatusComponent>();
    private incidents = new Map<string, Incident>();

    upsertComponent(component: StatusComponent): void {
        this.components.set(component.id, component);
    }

    removeComponent(id: string): boolean {
        return this.components.delete(id);
    }

    upsertIncident(incident: Incident): void {
        this.incidents.set(incident.id, incident);
    }

    removeIncident(id: string): boolean {
        return this.incidents.delete(id);
    }

    listComponents(): StatusComponent[] {
        return [...this.components.values()];
    }

    listIncidents(): Incident[] {
        return [...this.incidents.values()];
    }

    /** Active incidents — those not yet resolved. */
    activeIncidents(): Incident[] {
        return this.listIncidents().filter((i) => i.status !== 'resolved');
    }

    /** Public snapshot. */
    currentStatus(now: number = Date.now()): StatusSnapshot {
        const components = this.listComponents();
        const incidents = this.activeIncidents();
        return {
            overall: aggregateStatus(components, incidents),
            updatedAt: now,
            components,
            incidents,
        };
    }
}

/** Compute the overall banner status from components + active incidents. */
export function aggregateStatus(components: StatusComponent[], activeIncidents: Incident[]): OverallStatus {
    let worst: OverallStatus = 'operational';
    for (const c of components) {
        worst = worse(worst, c.status);
    }
    for (const inc of activeIncidents) {
        if (inc.status === 'resolved') continue;
        worst = worse(worst, severityToStatus(inc.severity, inc.status));
    }
    return worst;
}

function severityToStatus(sev: Incident['severity'], status: IncidentStatus): OverallStatus {
    if (status === 'mitigated') return 'degraded';
    switch (sev) {
        case 'sev1':
            return 'major_outage';
        case 'sev2':
            return 'partial_outage';
        case 'sev3':
            return 'degraded';
        case 'sev4':
            return 'operational';
    }
}

const ORDER: OverallStatus[] = ['operational', 'maintenance', 'degraded', 'partial_outage', 'major_outage'];

function worse(a: OverallStatus, b: OverallStatus): OverallStatus {
    return ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b;
}

/** Default singleton store — used by `/api/status`. */
export const defaultStatusStore = new StatusPageStore();

/** Top-level helper expected by the API route. */
export function currentStatus(now: number = Date.now()): StatusSnapshot {
    return defaultStatusStore.currentStatus(now);
}
