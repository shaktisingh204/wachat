/**
 * Client for the Wachat **project-agents** router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/wachat/project-agents` by the
 * `wachat-project-agents` crate — the backend for the
 * `/wachat/settings/agents` (agents, roles & routing) page. It replaces the
 * native-Mongo `src/app/wachat/settings/agents/actions.ts` plus the
 * project-scoped add branch of `handleInviteAgent`:
 *
 *   GET    /projects/{id}/agents                         → list_agents
 *   POST   /projects/{id}/agents/invite                  → invite_agent
 *   GET    /projects/{id}/agents/{agentId}/open-tickets  → open_tickets
 *   DELETE /projects/{id}/agents/{agentId}               → remove_agent
 *   PATCH  /projects/{id}/routing                        → update_routing
 *   PUT    /projects/{id}/agents/{agentId}/skills        → update_skills
 *
 * Server-only — uses the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/wachat/project-agents';

// ---------------------------------------------------------------------------
// Domain DTOs (mirror the Rust slice DTOs — camelCase over the wire because
// every Rust handler uses `serde(rename_all = "camelCase")`).
// ---------------------------------------------------------------------------

/**
 * One embedded agent on the project's `agents` array, as returned by
 * `GET /projects/{id}/agents`.
 *
 * The Rust handler returns the cleaned embedded documents verbatim
 * (`document_to_clean_json`), so `userId` is a hex string and the optional
 * fields reflect what the legacy TS wrote (`role`, `skills`). Extra fields
 * may appear; the index signature keeps the shape forward-compatible
 * without resorting to a loose `any`.
 */
export interface ProjectAgent {
    /** Agent user id as a hex string. */
    userId: string;
    /** Email of the agent. */
    email?: string;
    /** Display name of the agent. */
    name?: string;
    /** Project role (`"agent"` | `"admin"`). */
    role?: string;
    /** Skill tags used by skill-based routing. */
    skills?: string[];
    [key: string]: unknown;
}

/** Allowed routing strategies (mirrors the page `Select` options). */
export type RoutingStrategy = 'manual' | 'round-robin' | 'skill-based';

/** Body for `POST /projects/{id}/agents/invite`. */
export interface InviteAgentBody {
    /** Email of the user to add as an agent. */
    email: string;
    /** Role to assign on the project (`"agent"` | `"admin"`). */
    role: string;
}

/** Body for `DELETE /projects/{id}/agents/{agentId}`. */
export interface RemoveAgentBody {
    /**
     * Agent (user id, hex string) that inherits the removed agent's open
     * tickets. Omit / `null` to unassign those tickets.
     */
    reassignToAgentId?: string | null;
}

/** Body for `PATCH /projects/{id}/routing`. */
export interface RoutingBody {
    /** New routing strategy. */
    routingStrategy: RoutingStrategy;
}

/** Body for `PUT /projects/{id}/agents/{agentId}/skills`. */
export interface SkillsBody {
    /** Full replacement skill set for the agent. */
    skills: string[];
}

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

/** Result of `GET /projects/{id}/agents`. */
export interface ListAgentsResponse {
    agents: ProjectAgent[];
}

/** Result of `GET /projects/{id}/agents/{agentId}/open-tickets`. */
export interface OpenTicketsResponse {
    /** Number of non-closed contacts assigned to the agent. */
    count: number;
}

/** Result of `POST /projects/{id}/agents/invite`. */
export interface InviteAgentResponse {
    success: boolean;
    /** Human-readable status (e.g. "… has been added to this project."). */
    message: string;
}

/** Generic `{ success: true }` envelope for the mutation endpoints. */
export interface SuccessResponse {
    success: boolean;
}

// ---------------------------------------------------------------------------
// Public namespace
// ---------------------------------------------------------------------------

export const wachatProjectAgentsApi = {
    listAgents: (projectId: string) =>
        rustFetch<ListAgentsResponse>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/agents`,
        ),

    inviteAgent: (projectId: string, body: InviteAgentBody) =>
        rustFetch<InviteAgentResponse>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/agents/invite`,
            {
                method: 'POST',
                body: JSON.stringify(body),
            },
        ),

    openTickets: (projectId: string, agentId: string) =>
        rustFetch<OpenTicketsResponse>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/agents/${encodeURIComponent(agentId)}/open-tickets`,
        ),

    removeAgent: (projectId: string, agentId: string, body: RemoveAgentBody = {}) =>
        rustFetch<SuccessResponse>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/agents/${encodeURIComponent(agentId)}`,
            {
                method: 'DELETE',
                body: JSON.stringify(body),
            },
        ),

    updateRouting: (projectId: string, body: RoutingBody) =>
        rustFetch<SuccessResponse>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/routing`,
            {
                method: 'PATCH',
                body: JSON.stringify(body),
            },
        ),

    updateSkills: (projectId: string, agentId: string, body: SkillsBody) =>
        rustFetch<SuccessResponse>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/agents/${encodeURIComponent(agentId)}/skills`,
            {
                method: 'PUT',
                body: JSON.stringify(body),
            },
        ),
};

export type WachatProjectAgentsApi = typeof wachatProjectAgentsApi;
