/**
 * Client for the Messenger Profile / Personas / Saved Responses router on
 * the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/facebook/messenger-profile` by
 * the `wachat-facebook-messenger-profile` crate. Each method is a thin
 * wrapper around {@link rustFetch} and returns the same
 * `{ success?, error?, … }` shape the legacy TS server actions returned,
 * so the calling component code does not need to change beyond the import.
 *
 * Server-only — relies on the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/facebook/messenger-profile';

// ---------------------------------------------------------------------------
//  Wire shapes (mirrors the Rust DTO module)
// ---------------------------------------------------------------------------

export interface AckResult {
    success?: boolean;
    error?: string;
}

export interface MessageResult {
    message?: string;
    error?: string;
}

export interface ProfileResp {
    profile?: any;
    error?: string;
}

export interface SetGreetingBody {
    greeting: string;
}

export interface SetGetStartedBody {
    payload: string;
}

export interface IceBreakerInput {
    question: string;
    payload: string;
}

export interface SetIceBreakersBody {
    iceBreakers: IceBreakerInput[];
}

export interface SetWhitelistedDomainsBody {
    domains: string[];
}

export interface DeleteProfileFieldsBody {
    fields: string[];
}

/**
 * Single item in the persistent menu. Either an external link (`web_url`)
 * or an in-flow postback button (`postback`).
 */
export type PersistentMenuItem =
    | { type: 'web_url'; title: string; url: string }
    | { type: 'postback'; title: string; payload: string };

export interface SavePersistentMenuBody {
    menuItems: PersistentMenuItem[];
}

export interface PersonasResp {
    personas?: any[];
    error?: string;
}

export interface CreatePersonaBody {
    name: string;
    profilePictureUrl: string;
}

export interface CreatePersonaResp {
    personaId?: string;
    error?: string;
}

export interface SavedResponsesResp {
    responses?: any[];
    error?: string;
}

export interface CreateSavedResponseBody {
    title: string;
    message: string;
    /** Optional URL of an image attachment. */
    image?: string;
}

export interface UpdateSavedResponseBody {
    title: string;
    message: string;
}

export type ReusableAttachmentType = 'image' | 'video' | 'audio' | 'file';

export interface UploadReusableAttachmentBody {
    type: ReusableAttachmentType;
    url: string;
}

export interface UploadReusableAttachmentResp {
    attachmentId?: string;
    error?: string;
}

// ---------------------------------------------------------------------------
//  Public namespace
// ---------------------------------------------------------------------------

function buildQuery(params: Record<string, string | undefined>): string {
    const entries = Object.entries(params).filter(
        ([, v]) => v !== undefined && v !== '',
    );
    if (entries.length === 0) return '';
    const qs = entries
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');
    return `?${qs}`;
}

export const wachatFacebookMessengerProfileApi = {
    // -----------------------------------------------------------------------
    // Messenger Profile fields
    // -----------------------------------------------------------------------

    /**
     * `GET /v1/facebook/messenger-profile/:projectId/profile?fields=…`
     *
     * `fields` defaults to
     * `greeting,get_started,persistent_menu,ice_breakers,whitelisted_domains`
     * server-side when omitted.
     */
    getMessengerProfile: (projectId: string, fields?: string) =>
        rustFetch<ProfileResp>(
            `${BASE}/${encodeURIComponent(projectId)}/profile${buildQuery({ fields })}`,
        ),

    setMessengerGreeting: (projectId: string, body: SetGreetingBody) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(projectId)}/profile/greeting`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    setMessengerGetStarted: (projectId: string, body: SetGetStartedBody) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(projectId)}/profile/get-started`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    setMessengerIceBreakers: (projectId: string, body: SetIceBreakersBody) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(projectId)}/profile/ice-breakers`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    setWhitelistedDomains: (
        projectId: string,
        body: SetWhitelistedDomainsBody,
    ) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(projectId)}/profile/whitelisted-domains`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    deleteMessengerProfileFields: (
        projectId: string,
        body: DeleteProfileFieldsBody,
    ) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(projectId)}/profile`,
            { method: 'DELETE', body: JSON.stringify(body) },
        ),

    savePersistentMenu: (projectId: string, body: SavePersistentMenuBody) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(projectId)}/profile/persistent-menu`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    // -----------------------------------------------------------------------
    // Personas
    // -----------------------------------------------------------------------

    getPersonas: (projectId: string) =>
        rustFetch<PersonasResp>(
            `${BASE}/${encodeURIComponent(projectId)}/personas`,
        ),

    createPersona: (projectId: string, body: CreatePersonaBody) =>
        rustFetch<CreatePersonaResp>(
            `${BASE}/${encodeURIComponent(projectId)}/personas`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    deletePersona: (projectId: string, personaId: string) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(projectId)}/personas/${encodeURIComponent(personaId)}`,
            { method: 'DELETE' },
        ),

    // -----------------------------------------------------------------------
    // Saved Responses
    // -----------------------------------------------------------------------

    getSavedResponses: (projectId: string) =>
        rustFetch<SavedResponsesResp>(
            `${BASE}/${encodeURIComponent(projectId)}/saved-responses`,
        ),

    createSavedResponse: (projectId: string, body: CreateSavedResponseBody) =>
        rustFetch<MessageResult>(
            `${BASE}/${encodeURIComponent(projectId)}/saved-responses`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    updateSavedResponse: (
        projectId: string,
        responseId: string,
        body: UpdateSavedResponseBody,
    ) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(projectId)}/saved-responses/${encodeURIComponent(responseId)}`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    deleteSavedResponse: (projectId: string, responseId: string) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(projectId)}/saved-responses/${encodeURIComponent(responseId)}`,
            { method: 'DELETE' },
        ),

    // -----------------------------------------------------------------------
    // Reusable attachments
    //
    // The Rust BFF accepts a URL or a previously uploaded asset URL. Binary
    // multipart upload (the rare `Content-Type: multipart/form-data` path)
    // continues to be handled by the legacy TS shim — the TS code that needs
    // it can keep using the original action.
    // -----------------------------------------------------------------------

    uploadReusableAttachment: (
        projectId: string,
        body: UploadReusableAttachmentBody,
    ) =>
        rustFetch<UploadReusableAttachmentResp>(
            `${BASE}/${encodeURIComponent(projectId)}/attachments`,
            { method: 'POST', body: JSON.stringify(body) },
        ),
};

export type WachatFacebookMessengerProfileApi =
    typeof wachatFacebookMessengerProfileApi;
