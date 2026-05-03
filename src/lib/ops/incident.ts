/**
 * Incident lifecycle helpers.
 *
 * These are pure data transforms — callers persist the resulting `Incident`
 * objects to whichever store they like (Mongo, Postgres, in-memory). Every
 * mutation appends a structured event to `timeline` so a postmortem can
 * reconstruct the sequence after the fact.
 */

import type { Incident, IncidentEvent, IncidentSeverity, IncidentStatus } from './types';

export interface OpenIncidentInput {
    id: string;
    title: string;
    severity: IncidentSeverity;
    affectedComponents?: string[];
    commander?: string;
    detectedBy?: string;
    summary?: string;
    /** Optional explicit start time, defaults to now. */
    startedAt?: number;
    /** Optional war-room URL — overrides the auto-generated link if provided. */
    warRoomUrl?: string;
}

/** Build a brand new incident in `open` state with a single detection entry. */
export function openIncident(input: OpenIncidentInput): Incident {
    const startedAt = input.startedAt ?? Date.now();
    const detection: IncidentEvent = {
        timestamp: startedAt,
        kind: 'detection',
        actor: input.detectedBy,
        message: input.detectedBy ? `Detected by ${input.detectedBy}` : 'Incident detected',
    };
    return {
        id: input.id,
        title: input.title,
        severity: input.severity,
        status: 'open',
        startedAt,
        affectedComponents: input.affectedComponents ?? [],
        commander: input.commander,
        warRoomUrl: input.warRoomUrl ?? warRoomLink(input.id),
        timeline: [detection],
        summary: input.summary,
    };
}

/** Append a free-form note to the timeline. Returns a new incident. */
export function appendNote(incident: Incident, message: string, actor?: string, timestamp?: number): Incident {
    return {
        ...incident,
        timeline: [
            ...incident.timeline,
            { timestamp: timestamp ?? Date.now(), actor, kind: 'note', message },
        ],
    };
}

/** Transition the incident to `acknowledged`. No-op when already past that state. */
export function acknowledge(incident: Incident, actor?: string, timestamp?: number): Incident {
    if (incident.status !== 'open') return incident;
    const ts = timestamp ?? Date.now();
    return appendStatus(
        { ...incident, status: 'acknowledged', acknowledgedAt: ts },
        'acknowledged',
        actor,
        ts,
    );
}

/** Transition the incident to `mitigated`. */
export function mitigate(incident: Incident, actor?: string, timestamp?: number): Incident {
    if (incident.status === 'resolved') return incident;
    const ts = timestamp ?? Date.now();
    return appendStatus({ ...incident, status: 'mitigated', mitigatedAt: ts }, 'mitigated', actor, ts);
}

/** Transition the incident to `resolved`. */
export function resolve(incident: Incident, actor?: string, timestamp?: number): Incident {
    if (incident.status === 'resolved') return incident;
    const ts = timestamp ?? Date.now();
    return appendStatus({ ...incident, status: 'resolved', resolvedAt: ts }, 'resolved', actor, ts);
}

function appendStatus(incident: Incident, to: IncidentStatus, actor?: string, ts?: number): Incident {
    return {
        ...incident,
        timeline: [
            ...incident.timeline,
            {
                timestamp: ts ?? Date.now(),
                actor,
                kind: 'status_change',
                message: `Status → ${to}`,
                metadata: { to },
            },
        ],
    };
}

/** Auto-generated war-room URL helper. */
export function warRoomLink(incidentId: string): string {
    const base = process.env.INCIDENT_WAR_ROOM_BASE_URL ?? 'https://meet.sabnode.com/incident';
    return `${base}/${encodeURIComponent(incidentId)}`;
}

/** Total duration in ms — undefined while still open. */
export function incidentDurationMs(incident: Incident): number | undefined {
    if (incident.resolvedAt === undefined) return undefined;
    return Math.max(0, incident.resolvedAt - incident.startedAt);
}

/** Mean-time-to-* metrics. Each value is undefined when the corresponding state hasn't been reached. */
export interface IncidentMetrics {
    mttd: number | undefined;
    mtta: number | undefined;
    mttm: number | undefined;
    mttr: number | undefined;
}

/**
 * Compute MTTA / MTTM / MTTR relative to `startedAt` for a single incident.
 * MTTD is approximated as 0 here (start = detection); callers with an
 * explicit "first symptom" timestamp can compute it separately.
 */
export function incidentMetrics(incident: Incident): IncidentMetrics {
    return {
        mttd: 0,
        mtta: incident.acknowledgedAt !== undefined ? incident.acknowledgedAt - incident.startedAt : undefined,
        mttm: incident.mitigatedAt !== undefined ? incident.mitigatedAt - incident.startedAt : undefined,
        mttr: incident.resolvedAt !== undefined ? incident.resolvedAt - incident.startedAt : undefined,
    };
}

/** Comms templates. Severity-aware copy ready for Slack / email / SMS. */
export interface CommsTemplate {
    channel: 'slack' | 'email' | 'sms' | 'status_page';
    subject: string;
    body: string;
}

/** Render the four canonical comms templates for an incident snapshot. */
export function renderCommsTemplates(incident: Incident): CommsTemplate[] {
    const sev = incident.severity.toUpperCase();
    const components = incident.affectedComponents.join(', ') || 'multiple components';
    const status = incident.status;

    return [
        {
            channel: 'slack',
            subject: `[${sev}] ${incident.title}`,
            body:
                `*Incident ${incident.id}* — ${incident.title}\n` +
                `Status: *${status}*\n` +
                `Components: ${components}\n` +
                (incident.warRoomUrl ? `War room: ${incident.warRoomUrl}\n` : '') +
                (incident.commander ? `Commander: ${incident.commander}\n` : ''),
        },
        {
            channel: 'email',
            subject: `[${sev}] ${incident.title} (${status})`,
            body:
                `An incident is currently ${status}.\n\n` +
                `Title: ${incident.title}\n` +
                `Affected components: ${components}\n` +
                `Started at: ${new Date(incident.startedAt).toISOString()}\n` +
                (incident.summary ? `\nSummary:\n${incident.summary}\n` : '') +
                (incident.warRoomUrl ? `\nWar room: ${incident.warRoomUrl}\n` : ''),
        },
        {
            channel: 'sms',
            subject: '',
            body: `[${sev}] ${incident.title} — ${status}. ${incident.warRoomUrl ?? ''}`.trim(),
        },
        {
            channel: 'status_page',
            subject: incident.title,
            body:
                `We are ${statusVerb(status)} an issue affecting ${components}. ` +
                `We'll post updates here as we have them.`,
        },
    ];
}

function statusVerb(status: IncidentStatus): string {
    switch (status) {
        case 'open':
            return 'investigating';
        case 'acknowledged':
            return 'investigating';
        case 'mitigated':
            return 'monitoring a fix for';
        case 'resolved':
            return 'resolving';
    }
}
