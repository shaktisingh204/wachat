/**
 * Client for the Facebook Business Admin & Commerce router on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/facebook/business` by the
 * `wachat-facebook-business` crate. Each method is a thin wrapper around
 * {@link rustFetch} so call-sites stay close to the OpenAPI operation IDs —
 * when codegen replaces this file the call sites will not need to change.
 *
 *   GET    /projects/:id                                business details
 *   GET    /projects/:id/owned-pages                    owned pages
 *   GET    /projects/:id/owned-ad-accounts              owned ad accounts
 *   GET    /projects/:id/owned-instagram                owned IG accounts
 *   GET    /projects/:id/system-users                   system users
 *   GET    /projects/:id/users                          business users
 *   GET    /projects/:id/pending-users                  pending users
 *   POST   /projects/:id/users/invite                   invite business user
 *   GET    /projects/:id/commerce/settings              commerce-merchant settings
 *   GET    /projects/:id/commerce/orders                facebook orders list
 *   POST   /projects/:id/commerce/orders/:oid/fulfill   fulfill order
 *   POST   /projects/:id/commerce/orders/:oid/cancel    cancel order
 *   POST   /projects/:id/commerce/orders/:oid/refund    refund order
 *
 * Server-only — uses the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/facebook/business';

// ---------------------------------------------------------------------------
// Wire shapes
// ---------------------------------------------------------------------------

/**
 * One of the Meta Business User roles accepted by `inviteBusinessUser`.
 * Matches the type narrowing the legacy server action used.
 */
export type BusinessUserRole =
    | 'ADMIN'
    | 'EMPLOYEE'
    | 'FINANCE_EDITOR'
    | 'FINANCE_ANALYST';

/** `getBusinessDetails` envelope. `business` is the raw Meta node. */
export interface BusinessDetailsResp {
    business: Record<string, unknown>;
}

/** `getBusinessOwnedPages` envelope. */
export interface OwnedPagesResp {
    pages: Array<Record<string, unknown>>;
}

/** `getBusinessOwnedAdAccounts` envelope (camelCase: `adAccounts`). */
export interface OwnedAdAccountsResp {
    adAccounts: Array<Record<string, unknown>>;
}

/** `getBusinessOwnedInstagramAccounts` envelope. */
export interface OwnedInstagramAccountsResp {
    accounts: Array<Record<string, unknown>>;
}

/** `getBusinessSystemUsers` envelope (camelCase: `systemUsers`). */
export interface SystemUsersResp {
    systemUsers: Array<Record<string, unknown>>;
}

/** `getBusinessUsers` envelope. */
export interface BusinessUsersResp {
    users: Array<Record<string, unknown>>;
}

/** `getBusinessPendingUsers` envelope (camelCase: `pendingUsers`). */
export interface PendingUsersResp {
    pendingUsers: Array<Record<string, unknown>>;
}

/** Body for `inviteBusinessUser`. */
export interface InviteBusinessUserBody {
    email: string;
    role: BusinessUserRole;
}

/** Generic `{ success: true }` ack returned by mutating endpoints. */
export interface AckResp {
    success: boolean;
}

/** `getCommerceMerchantSettings` envelope. `settings` is the raw Meta sub-object. */
export interface CommerceSettingsResp {
    settings: Record<string, unknown>;
}

/** Single order as returned by Meta `/{commerceAccountId}/orders`. */
export interface FacebookOrderWire {
    id: string;
    [key: string]: unknown;
}

/** `getFacebookOrders` envelope. */
export interface FacebookOrdersResp {
    orders: FacebookOrderWire[];
}

/** Body for `fulfillOrder`. */
export interface FulfillOrderBody {
    trackingInfo: {
        carrier: string;
        tracking_number: string;
    };
}

/** Body for `cancelOrder` / `refundOrder`. `reason` is optional. */
export interface OrderReasonBody {
    reason?: string;
}

// ---------------------------------------------------------------------------
// Public namespace
// ---------------------------------------------------------------------------

export const wachatFacebookBusinessApi = {
    // BUSINESS ADMIN ---------------------------------------------------------

    getBusinessDetails: (projectId: string) =>
        rustFetch<BusinessDetailsResp>(
            `${BASE}/projects/${encodeURIComponent(projectId)}`,
        ),

    getBusinessOwnedPages: (projectId: string) =>
        rustFetch<OwnedPagesResp>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/owned-pages`,
        ),

    getBusinessOwnedAdAccounts: (projectId: string) =>
        rustFetch<OwnedAdAccountsResp>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/owned-ad-accounts`,
        ),

    getBusinessOwnedInstagramAccounts: (projectId: string) =>
        rustFetch<OwnedInstagramAccountsResp>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/owned-instagram`,
        ),

    getBusinessSystemUsers: (projectId: string) =>
        rustFetch<SystemUsersResp>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/system-users`,
        ),

    getBusinessUsers: (projectId: string) =>
        rustFetch<BusinessUsersResp>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/users`,
        ),

    getBusinessPendingUsers: (projectId: string) =>
        rustFetch<PendingUsersResp>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/pending-users`,
        ),

    inviteBusinessUser: (
        projectId: string,
        body: InviteBusinessUserBody,
    ) =>
        rustFetch<AckResp>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/users/invite`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    // COMMERCE ---------------------------------------------------------------

    getCommerceMerchantSettings: (projectId: string) =>
        rustFetch<CommerceSettingsResp>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/commerce/settings`,
        ),

    getFacebookOrders: (projectId: string) =>
        rustFetch<FacebookOrdersResp>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/commerce/orders`,
        ),

    fulfillOrder: (
        projectId: string,
        orderId: string,
        body: FulfillOrderBody,
    ) =>
        rustFetch<AckResp>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/commerce/orders/${encodeURIComponent(orderId)}/fulfill`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    cancelOrder: (
        projectId: string,
        orderId: string,
        body: OrderReasonBody = {},
    ) =>
        rustFetch<AckResp>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/commerce/orders/${encodeURIComponent(orderId)}/cancel`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    refundOrder: (
        projectId: string,
        orderId: string,
        body: OrderReasonBody = {},
    ) =>
        rustFetch<AckResp>(
            `${BASE}/projects/${encodeURIComponent(projectId)}/commerce/orders/${encodeURIComponent(orderId)}/refund`,
            { method: 'POST', body: JSON.stringify(body) },
        ),
};

export type WachatFacebookBusinessApi = typeof wachatFacebookBusinessApi;
