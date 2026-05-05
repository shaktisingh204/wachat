/**
 * Client for the Wachat send + chat + payment-request routers on the Rust BFF.
 *
 * Mirrors the routes registered under `/v1/wachat` by the
 * `wachat-templates-send` (or sibling) crate. Each method is a one-line shim
 * around {@link rustFetch} so the namespace surface stays close to the OpenAPI
 * operation IDs — when codegen replaces this file the call sites won't change.
 *
 *   POST /messages/send                       → send (kind-tagged)
 *   POST /messages/catalog                    → sendCatalog
 *   POST /messages/cta-url                    → sendCtaUrl
 *   POST /messages/location-request           → sendLocationRequest
 *   POST /messages/address                    → sendAddress
 *   POST /messages/order-details              → sendOrderDetails
 *   POST /messages/order-status               → sendOrderStatus
 *
 *   POST /contacts/resolve                    → resolveContact
 *
 *   GET  /chat/initial                        → initialChatData
 *   GET  /chat/conversation/:id               → getConversation
 *   POST /chat/mark-read/:id                  → markConversationAsRead
 *   POST /chat/mark-unread/:id                → markConversationAsUnread
 *
 *   POST /payment-requests/send               → sendPaymentRequest
 *   GET  /payment-requests/by-reference/:id   → getPaymentRequestStatus
 *   GET  /payment-requests                    → listPaymentRequests
 *
 * Server-only — uses the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/wachat';

// ---------------------------------------------------------------------------
// Shared sub-shapes
// ---------------------------------------------------------------------------

/**
 * Wire-format for browser-uploaded media. The Rust handler receives the raw
 * base64 payload, performs the Meta `/media` upload itself, then attaches the
 * resulting handle to the outgoing message — keeps the Meta access token
 * server-side.
 */
export interface MediaFilePayload {
    content: string; // base64
    name: string;
    type: string; // MIME
}

// ---------------------------------------------------------------------------
// /messages/send — kind-tagged union
// ---------------------------------------------------------------------------

/**
 * Body for `POST /v1/wachat/messages/send`.
 *
 * The Rust handler dispatches on `kind` so the same endpoint covers text and
 * media variants. When `mediaFile` is present the Rust side uploads to Meta
 * first, then sends with the resulting handle.
 */
export interface SendMessageBody {
    /** Discriminant — Rust derives `messageType` from this and from `mediaFile.type`. */
    kind: 'text' | 'image' | 'video' | 'document';
    projectId: string;
    contactId: string;
    phoneNumberId: string;
    waId: string;
    /** Body text for text messages, or caption for media messages. */
    messageText?: string;
    mediaFile?: MediaFilePayload;
}

export interface SendMessageResult {
    messageLogId: string;
    wamid: string;
}

// ---------------------------------------------------------------------------
// /messages/catalog
// ---------------------------------------------------------------------------

export interface SendCatalogBody {
    projectId: string;
    contactId: string;
    headerText?: string;
    bodyText: string;
    footerText?: string;
    productRetailerIds: string[];
}

// ---------------------------------------------------------------------------
// /messages/cta-url
// ---------------------------------------------------------------------------

export interface SendCtaUrlBody {
    projectId: string;
    contactId: string;
    phoneNumberId: string;
    waId: string;
    displayText: string;
    url: string;
    headerText?: string;
    bodyText: string;
    footerText?: string;
}

// ---------------------------------------------------------------------------
// /messages/location-request
// ---------------------------------------------------------------------------

export interface SendLocationRequestBody {
    projectId: string;
    contactId: string;
    phoneNumberId: string;
    waId: string;
    bodyText: string;
}

// ---------------------------------------------------------------------------
// /messages/address
// ---------------------------------------------------------------------------

export interface SendAddressBody {
    projectId: string;
    contactId: string;
    phoneNumberId: string;
    waId: string;
    bodyText: string;
    country: string;
    values?: Record<string, string>;
    savedAddressId?: string;
}

// ---------------------------------------------------------------------------
// /messages/order-details
// ---------------------------------------------------------------------------

/** Reused by order-details → matches Meta's amount-with-offset shape. */
export interface MoneyAmount {
    value: number;
    offset?: number;
}

export interface OrderItem {
    retailer_id: string;
    name: string;
    amount: MoneyAmount;
    quantity: number;
    sale_amount?: MoneyAmount;
}

export interface OrderShape {
    status: string;
    catalog_id?: string;
    items: OrderItem[];
    subtotal?: MoneyAmount;
    tax?: MoneyAmount & { description?: string };
    shipping?: MoneyAmount & { description?: string };
    discount?: MoneyAmount & {
        description?: string;
        discount_program_name?: string;
    };
}

export interface SendOrderDetailsBody {
    projectId: string;
    contactId: string;
    phoneNumberId: string;
    waId: string;
    referenceId: string;
    type: 'digital-goods' | 'physical-goods';
    paymentType: string;
    paymentLink?: string;
    totalAmount: number;
    currency: string;
    order: OrderShape;
}

// ---------------------------------------------------------------------------
// /messages/order-status
// ---------------------------------------------------------------------------

export type OrderStatus =
    | 'payment_request'
    | 'accepted'
    | 'pending'
    | 'completed'
    | 'canceled'
    | 'shipped'
    | 'delivered';

export interface SendOrderStatusBody {
    projectId: string;
    contactId: string;
    phoneNumberId: string;
    waId: string;
    referenceId: string;
    status: OrderStatus;
    description?: string;
}

// ---------------------------------------------------------------------------
// Generic ack — most send endpoints return either a wamid pair or this.
// ---------------------------------------------------------------------------

export interface SendAck {
    message?: string;
    error?: string;
}

// ---------------------------------------------------------------------------
// /contacts/resolve
// ---------------------------------------------------------------------------

export interface ResolveContactBody {
    projectId: string;
    phoneNumberId: string;
    waId: string;
}

/**
 * Result of `POST /v1/wachat/contacts/resolve`.
 *
 * `created` distinguishes upsert insert vs match so the call site can decide
 * whether to fire any "new contact" side effects. The wider contact document
 * is intentionally returned as `unknown` — the TS Server Action layer reshapes
 * it into the legacy `WithId<Contact>` shape via `JSON.parse(JSON.stringify())`.
 */
export interface ResolveContactResult {
    id: string;
    projectId: string;
    phoneNumberId: string;
    waId: string;
    created: boolean;
    /** Full contact document mirroring the Mongo shape. */
    contact?: unknown;
}

// ---------------------------------------------------------------------------
// /chat/initial
// ---------------------------------------------------------------------------

export interface InitialChatDataQuery {
    projectId: string;
    phoneNumberId?: string | null;
    contactId?: string | null;
    waId?: string | null;
}

/**
 * Result of `GET /v1/wachat/chat/initial`.
 *
 * Mirrors the legacy Server Action return shape exactly. Internal documents
 * (`project`, `contacts`, `conversation`, `templates`, `selectedContact`) are
 * returned as `unknown` because the TS layer never inspects them at the type
 * level — they are JSON-passed through to client components that own the
 * rendering.
 */
export interface InitialChatDataResult {
    project: unknown | null;
    contacts: unknown[];
    totalContacts: number;
    conversation: unknown[];
    templates: unknown[];
    selectedContact?: unknown | null;
    selectedPhoneNumberId: string;
}

// ---------------------------------------------------------------------------
// /payment-requests
// ---------------------------------------------------------------------------

export interface SendPaymentRequestBody {
    contactId: string;
    amount: string;
    description: string;
    externalReference?: string;
}

export interface PaymentRequestStatusQuery {
    projectId: string;
    phoneNumberId: string;
}

/**
 * Single payment-request record returned by the list endpoint. Matches the
 * Meta `/payment_requests` resource shape directly — the Rust side passes the
 * Graph response through after auth/scope checks.
 */
export interface PaymentRequestRecord {
    id: string;
    status?: string;
    amount?: { currency?: string; value?: string };
    receiver?: { wa_id?: string };
    description?: string;
    external_reference?: string;
    created_at?: string;
    [k: string]: unknown;
}

// ---------------------------------------------------------------------------
// Query helper — keeps `?project_id=…&phone_number_id=…` strings off call sites.
// ---------------------------------------------------------------------------

function qs(params: Record<string, string | undefined | null>): string {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') search.set(k, v);
    }
    const s = search.toString();
    return s ? `?${s}` : '';
}

// ---------------------------------------------------------------------------
// Public namespace
// ---------------------------------------------------------------------------

export const whatsappSendApi = {
    // ----------- /messages/* -----------

    send: (body: SendMessageBody) =>
        rustFetch<SendMessageResult & SendAck>(`${BASE}/messages/send`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    sendCatalog: (body: SendCatalogBody) =>
        rustFetch<SendAck>(`${BASE}/messages/catalog`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    sendCtaUrl: (body: SendCtaUrlBody) =>
        rustFetch<SendAck>(`${BASE}/messages/cta-url`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    sendLocationRequest: (body: SendLocationRequestBody) =>
        rustFetch<SendAck>(`${BASE}/messages/location-request`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    sendAddress: (body: SendAddressBody) =>
        rustFetch<SendAck>(`${BASE}/messages/address`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    sendOrderDetails: (body: SendOrderDetailsBody) =>
        rustFetch<SendAck>(`${BASE}/messages/order-details`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    sendOrderStatus: (body: SendOrderStatusBody) =>
        rustFetch<SendAck>(`${BASE}/messages/order-status`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    // ----------- /contacts/* -----------

    resolveContact: (body: ResolveContactBody) =>
        rustFetch<ResolveContactResult>(`${BASE}/contacts/resolve`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    // ----------- /chat/* -----------

    initialChatData: (query: InitialChatDataQuery) =>
        rustFetch<InitialChatDataResult>(
            `${BASE}/chat/initial${qs({
                project_id: query.projectId,
                phone_number_id: query.phoneNumberId ?? undefined,
                contact_id: query.contactId ?? undefined,
                wa_id: query.waId ?? undefined,
            })}`,
        ),

    getConversation: (contactId: string) =>
        rustFetch<unknown[]>(
            `${BASE}/chat/conversation/${encodeURIComponent(contactId)}`,
        ),

    markConversationAsRead: (contactId: string) =>
        rustFetch<{ success: boolean }>(
            `${BASE}/chat/mark-read/${encodeURIComponent(contactId)}`,
            { method: 'POST' },
        ),

    markConversationAsUnread: (contactId: string) =>
        rustFetch<{ success: boolean }>(
            `${BASE}/chat/mark-unread/${encodeURIComponent(contactId)}`,
            { method: 'POST' },
        ),

    // ----------- /payment-requests/* -----------

    sendPaymentRequest: (body: SendPaymentRequestBody) =>
        rustFetch<SendAck>(`${BASE}/payment-requests/send`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    getPaymentRequestStatus: (
        requestId: string,
        query: PaymentRequestStatusQuery,
    ) =>
        rustFetch<{ status?: string; error?: string }>(
            `${BASE}/payment-requests/by-reference/${encodeURIComponent(requestId)}${qs({
                project_id: query.projectId,
                phone_number_id: query.phoneNumberId,
            })}`,
        ),

    listPaymentRequests: (query: PaymentRequestStatusQuery) =>
        rustFetch<{ requests?: PaymentRequestRecord[]; error?: string }>(
            `${BASE}/payment-requests${qs({
                project_id: query.projectId,
                phone_number_id: query.phoneNumberId,
            })}`,
        ),
};

export type WhatsappSendApi = typeof whatsappSendApi;
