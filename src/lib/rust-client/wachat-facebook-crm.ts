/**
 * Client for the wachat-facebook-crm router on the Rust BFF.
 *
 * Mirrors the Subscribers, CRM & Labels slice of
 * `src/app/actions/facebook.actions.ts`. Each method is a thin wrapper
 * around {@link rustFetch}.
 *
 *   GET    /projects/:projectId/subscribers              listSubscribers
 *   POST   /subscribers/:subscriberId/status             updateSubscriberStatus
 *   GET    /projects/:projectId/kanban                   getKanbanData
 *   POST   /projects/:projectId/kanban/statuses          saveKanbanStatuses
 *
 *   GET    /projects/:projectId/labels                   getCustomLabels
 *   POST   /projects/:projectId/labels                   createCustomLabel
 *   DELETE /projects/:projectId/labels/:labelId          deleteCustomLabel
 *
 *   GET    /projects/:projectId/labels/users/:psid       getLabelsForUser
 *   POST   /projects/:projectId/labels/:labelId/users    assignLabelToUser
 *   DELETE /projects/:projectId/labels/:labelId/users    removeLabelFromUser
 *
 *   POST   /projects/:projectId/blocked                  blockProfile
 *   DELETE /projects/:projectId/blocked                  unblockProfile
 *
 * Server-only — uses the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/facebook/crm';

// ---------------------------------------------------------------------------
// Wire shapes
// ---------------------------------------------------------------------------

export interface SubscribersResult {
    subscribers?: any[];
    error?: string;
}

export interface KanbanColumn {
    name: string;
    conversations: any[];
}

export interface KanbanResult {
    project: any | null;
    columns: KanbanColumn[];
}

export interface SuccessResult {
    success: boolean;
    error?: string;
}

export interface LabelsResult {
    labels?: any[];
    error?: string;
}

export interface CreateLabelResult {
    labelId?: string;
    error?: string;
}

export interface UpdateStatusBody {
    status: string;
}

export interface SaveKanbanStatusesBody {
    statuses: string[];
}

export interface CreateLabelBody {
    name: string;
}

export interface UserPsidBody {
    psid: string;
}

export interface ProfileIdBody {
    profileId: string;
}

// ---------------------------------------------------------------------------
// Public namespace
// ---------------------------------------------------------------------------

export const wachatFacebookCrmApi = {
    // --- Subscribers + Kanban ---
    listSubscribers: (projectId: string) =>
        rustFetch<SubscribersResult>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/subscribers`,
        ),

    updateSubscriberStatus: (subscriberId: string, status: string) =>
        rustFetch<SuccessResult>(
            `${BASE}/subscribers/${encodeURIComponent(subscriberId)}/status`,
            { method: 'POST', body: JSON.stringify({ status }) },
        ),

    getKanbanData: (projectId: string) =>
        rustFetch<KanbanResult>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/kanban`,
        ),

    saveKanbanStatuses: (projectId: string, statuses: string[]) =>
        rustFetch<SuccessResult>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/kanban/statuses`,
            { method: 'POST', body: JSON.stringify({ statuses }) },
        ),

    // --- Custom labels (Meta page-scoped) ---
    getCustomLabels: (projectId: string) =>
        rustFetch<LabelsResult>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/labels`,
        ),

    createCustomLabel: (projectId: string, name: string) =>
        rustFetch<CreateLabelResult>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/labels`,
            { method: 'POST', body: JSON.stringify({ name }) },
        ),

    deleteCustomLabel: (labelId: string, projectId: string) =>
        rustFetch<SuccessResult>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/labels/${encodeURIComponent(labelId)}`,
            { method: 'DELETE' },
        ),

    getLabelsForUser: (psid: string, projectId: string) =>
        rustFetch<LabelsResult>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/labels/users/${encodeURIComponent(psid)}`,
        ),

    assignLabelToUser: (labelId: string, psid: string, projectId: string) =>
        rustFetch<SuccessResult>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/labels/${encodeURIComponent(labelId)}/users`,
            { method: 'POST', body: JSON.stringify({ psid }) },
        ),

    removeLabelFromUser: (labelId: string, psid: string, projectId: string) =>
        rustFetch<SuccessResult>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/labels/${encodeURIComponent(labelId)}/users`,
            { method: 'DELETE', body: JSON.stringify({ psid }) },
        ),

    // --- Profile block / unblock ---
    blockProfile: (profileId: string, projectId: string) =>
        rustFetch<SuccessResult>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/blocked`,
            { method: 'POST', body: JSON.stringify({ profileId }) },
        ),

    unblockProfile: (profileId: string, projectId: string) =>
        rustFetch<SuccessResult>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/blocked`,
            { method: 'DELETE', body: JSON.stringify({ profileId }) },
        ),
};

export type WachatFacebookCrmApi = typeof wachatFacebookCrmApi;
