/**
 * Client for the Facebook Page Events router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/facebook/events` by the
 * `wachat-facebook-events` crate. Each method is a thin wrapper around
 * {@link rustFetch} and returns the same `{ success?, error?, … }` shape
 * the legacy TS server actions returned, so the calling page/component
 * code does not need to change beyond the import.
 *
 * Server-only — relies on the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/facebook/events';

// ---------------------------------------------------------------------------
//  Wire shapes (mirrors the Rust DTO module)
// ---------------------------------------------------------------------------

export interface CreateEventResp {
    message?: string;
    error?: string;
}

export interface AckResult {
    success: boolean;
    error?: string;
}

export interface EventsResp {
    events?: any[];
    error?: string;
}

export interface EventDetailsResp {
    event?: any;
    error?: string;
}

export interface CreateEventBody {
    projectId: string;
    name: string;
    description?: string;
    /** `YYYY-MM-DD`. */
    startDate: string;
    /** `HH:MM` (24h). */
    startTime: string;
    endDate?: string;
    endTime?: string;
    placeName?: string;
    isOnline?: boolean;
    ticketUri?: string;
}

export interface UpdateEventBody {
    projectId: string;
    eventId: string;
    name?: string;
    description?: string;
    startDate?: string;
    startTime?: string;
    endDate?: string;
    endTime?: string;
}

export type RsvpStatus = 'attending' | 'maybe' | 'declined';

export interface AttendeesResp {
    attendees?: any[];
    error?: string;
}

// ---------------------------------------------------------------------------
//  Public namespace
// ---------------------------------------------------------------------------

export const wachatFacebookEventsApi = {
    /** `getFacebookEvents(projectId)` — list page events. */
    getFacebookEvents: (projectId: string) =>
        rustFetch<EventsResp>(`${BASE}/${encodeURIComponent(projectId)}`),

    /** `getEventDetails(eventId, projectId)` — single event metadata. */
    getEventDetails: (projectId: string, eventId: string) =>
        rustFetch<EventDetailsResp>(
            `${BASE}/${encodeURIComponent(projectId)}/${encodeURIComponent(eventId)}`,
        ),

    /** `handleCreateFacebookEvent(prevState, formData)` — create. */
    handleCreateFacebookEvent: (projectId: string, body: CreateEventBody) =>
        rustFetch<CreateEventResp>(`${BASE}/${encodeURIComponent(projectId)}`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    /** `handleUpdateFacebookEvent(prevState, formData)` — partial update. */
    handleUpdateFacebookEvent: (
        projectId: string,
        eventId: string,
        body: UpdateEventBody,
    ) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(projectId)}/${encodeURIComponent(eventId)}`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    /** `deleteFacebookEvent(eventId, projectId)`. */
    deleteFacebookEvent: (projectId: string, eventId: string) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(projectId)}/${encodeURIComponent(eventId)}`,
            { method: 'DELETE' },
        ),

    /**
     * `getEventAttendees(eventId, projectId, rsvpStatus)`.
     *
     * `rsvpStatus` defaults to `attending` when omitted (matches the TS
     * action's default parameter).
     */
    getEventAttendees: (
        projectId: string,
        eventId: string,
        rsvpStatus: RsvpStatus = 'attending',
    ) =>
        rustFetch<AttendeesResp>(
            `${BASE}/${encodeURIComponent(projectId)}/${encodeURIComponent(eventId)}/attendees/${encodeURIComponent(rsvpStatus)}`,
        ),
};

export type WachatFacebookEventsApi = typeof wachatFacebookEventsApi;
