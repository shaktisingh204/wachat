/**
 * Communication Channels — shared types.
 *
 * Framework-agnostic: a `Channel` is an abstract messaging pipe (WhatsApp,
 * SMS, voice, RCS, …). Concrete adapters live under `./adapters/*` and are
 * registered into a process-wide registry via `./registry.ts`.
 */

export type Channel =
    | 'whatsapp'
    | 'sms'
    | 'email'
    | 'voice'
    | 'telegram'
    | 'instagram'
    | 'rcs'
    | 'imessage'
    | 'wechat'
    | 'line'
    | 'kakao'
    | 'discord'
    | 'webpush'
    | 'in-app';

export type MessageDirection = 'inbound' | 'outbound';

export type MessageStatus =
    | 'queued'
    | 'sent'
    | 'delivered'
    | 'read'
    | 'failed'
    | 'unknown';

export type MessageContentKind =
    | 'text'
    | 'image'
    | 'video'
    | 'audio'
    | 'file'
    | 'location'
    | 'template'
    | 'interactive'
    | 'call'
    | 'system';

export interface MediaAttachment {
    kind: 'image' | 'video' | 'audio' | 'file';
    url: string;
    mimeType?: string;
    sizeBytes?: number;
    /** Optional caption / alt text. */
    caption?: string;
    fileName?: string;
}

export interface MessageContent {
    kind: MessageContentKind;
    /** Plain-text body (rendered fallback for non-text kinds). */
    text?: string;
    media?: MediaAttachment[];
    /** Provider-specific blob, e.g. WA template payload. */
    raw?: Record<string, unknown>;
}

/**
 * Canonical contact identifier — channel-specific identifiers (E.164 phone,
 * email address, telegram chat id, …) get joined to a single `contactId` at
 * the application layer (CRM / Wachat contacts collection).
 */
export interface ContactRef {
    /** Application-level contact id (CRM canonical). */
    contactId: string;
    tenantId: string;
    /** Per-channel handle. */
    address: string;
    channel: Channel;
}

export interface Message {
    id: string;
    tenantId: string;
    threadId: string;
    channel: Channel;
    direction: MessageDirection;
    status: MessageStatus;
    /** ISO 8601 timestamp. */
    createdAt: string;
    /** External id from the channel provider (e.g. Twilio SID, WA waMsgId). */
    providerMessageId?: string;
    from: ContactRef;
    to: ContactRef;
    content: MessageContent;
    /** Optional cost in micro-USD ($1 = 1_000_000). */
    costMicroUsd?: number;
    error?: { code: string; message: string };
}

export interface Thread {
    id: string;
    tenantId: string;
    /** Canonical contact this thread belongs to (cross-channel merges share id). */
    contactId: string;
    /** Channels active on this thread. */
    channels: Channel[];
    lastMessageAt: string;
    lastMessage?: Message;
    /** Inbox-level unread count (across all channels). */
    unreadCount: number;
}

export interface DeliveryReport {
    messageId: string;
    providerMessageId?: string;
    channel: Channel;
    status: MessageStatus;
    /** Provider error code if status === 'failed'. */
    errorCode?: string;
    errorMessage?: string;
    /** ISO timestamp of the status change. */
    at: string;
    /** Raw provider payload for audit. */
    raw?: Record<string, unknown>;
}

/**
 * Standard error thrown by adapters for missing creds / send failures.
 * Routing & inbox layers catch these and demote the channel.
 */
export class ChannelError extends Error {
    public readonly channel: Channel;
    public readonly code: string;
    public readonly retryable: boolean;
    constructor(opts: {
        channel: Channel;
        code: string;
        message: string;
        retryable?: boolean;
    }) {
        super(opts.message);
        this.name = 'ChannelError';
        this.channel = opts.channel;
        this.code = opts.code;
        this.retryable = opts.retryable ?? false;
    }
}

/**
 * Per-tenant adapter credentials. Concrete adapters narrow this further.
 */
export interface ChannelCredentials {
    [key: string]: string | undefined;
}

export interface SendOptions {
    /** Optional explicit thread id; if absent the adapter resolves one. */
    threadId?: string;
    /** Idempotency key for retried sends. */
    idempotencyKey?: string;
    /** Tenant-supplied metadata, echoed back on delivery reports. */
    metadata?: Record<string, string>;
}

export interface SendResult {
    /** Internal id we assign immediately. */
    messageId: string;
    /** Provider-side id once accepted. */
    providerMessageId?: string;
    status: MessageStatus;
}

/**
 * Webhook envelope normalised for any inbound channel event.
 * Adapters parse provider payloads and emit zero or more of these.
 */
export interface InboundEvent {
    kind: 'message' | 'delivery' | 'read' | 'typing' | 'call';
    channel: Channel;
    tenantId: string;
    message?: Message;
    delivery?: DeliveryReport;
    /** Free-form raw payload for debugging. */
    raw?: Record<string, unknown>;
}

/**
 * Common interface every channel adapter must satisfy. Adapters are stateless
 * by convention; per-tenant credentials are passed through the `creds`
 * argument so a single adapter instance can serve all tenants.
 */
export interface ChannelAdapter {
    readonly channel: Channel;
    readonly displayName: string;
    /** True if this adapter only supports outbound (e.g. webpush). */
    readonly outboundOnly?: boolean;
    /** True if the adapter is interface-only / not yet implemented. */
    readonly stub?: boolean;

    /**
     * Send a message. Adapters MUST throw `ChannelError` if creds are missing
     * or the provider rejects the request.
     */
    send(
        creds: ChannelCredentials,
        to: ContactRef,
        content: MessageContent,
        opts?: SendOptions,
    ): Promise<SendResult>;

    /** Optional: parse a raw provider webhook into normalised events. */
    parseWebhook?(payload: unknown, headers?: Record<string, string>): InboundEvent[];

    /** Optional: signed-webhook verification. Defaults to allow. */
    verifyWebhook?(
        payload: string,
        headers: Record<string, string>,
        secret: string,
    ): boolean;
}
