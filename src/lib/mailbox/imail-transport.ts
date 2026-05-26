/**
 * Thin abstraction over the actual IMAP/SMTP provider.
 *
 * The application layer (server actions in
 * `src/app/actions/mailbox.actions.ts`) talks to this interface, not the
 * provider directly. A future PR will plug in a concrete implementation
 * (Postfix/Dovecot via REST shim, or a managed SaaS like SES/Mailgun
 * Inbound, or a local LMTP receiver).
 *
 * Today: the only implementation is `StubMailTransport` — it just logs and
 * resolves. Useful for hooking up the UI before the infra lands.
 *
 * TODO(integrator):
 *   - Decide provider. Options:
 *       1. Self-host Postfix + Dovecot + Rspamd in a Docker stack and
 *          expose a thin admin REST shim. Highest control, highest ops cost.
 *       2. Mailgun Routes / SES + a tiny LMTP receiver. Lower ops cost.
 *       3. ImprovMX / Forward Email-style relay (forward-only, no IMAP).
 *   - Implement `RealMailTransport` against that choice.
 *   - Wire `getMailTransport()` to swap on `process.env.MAIL_PROVIDER`.
 *   - Add `webhooks/mail/inbound` to receive inbound deliveries and
 *     populate `mail_messages` (creating raw `.eml` in SabFiles first).
 */

export interface MailAddressDescriptor {
    name?: string;
    email: string;
}

export interface OutboundMailEnvelope {
    /** Mailbox account id sending the message. */
    accountId: string;
    from: MailAddressDescriptor;
    to: MailAddressDescriptor[];
    cc?: MailAddressDescriptor[];
    bcc?: MailAddressDescriptor[];
    subject: string;
    /** SabFiles ref to the raw `.eml`. UI builds this from the composer. */
    bodyFileId?: string;
    /** Optional pre-rendered HTML body (used when bodyFileId is absent). */
    html?: string;
    text?: string;
    /** SabFiles refs for attachments. */
    attachmentFileIds?: string[];
    /** Thread continuation. */
    inReplyTo?: string;
    references?: string[];
}

export interface MailSendResult {
    messageId: string;
    accepted: string[];
    rejected: string[];
}

export interface DomainVerificationResult {
    mx: 'pending' | 'verified' | 'failed';
    spf: 'pending' | 'verified' | 'failed';
    dkim: 'pending' | 'verified' | 'failed';
    dmarc: 'pending' | 'verified' | 'failed';
    notes?: string[];
}

export interface IMailTransport {
    /**
     * Best-effort send. Implementations MUST persist to `mail_messages`
     * with `folderId = sent` after a successful send — the caller doesn't
     * do that on their behalf.
     */
    send(envelope: OutboundMailEnvelope): Promise<MailSendResult>;

    /**
     * Run live DNS lookups against the provider's expected records.
     * Stub returns all-`pending`.
     */
    verifyDomain(domainId: string): Promise<DomainVerificationResult>;

    /**
     * Provision a mailbox at the provider — usually called right after a
     * `mail_accounts` row is created. Stub: no-op.
     */
    provisionAccount(accountId: string, password: string): Promise<void>;

    /** Suspend / un-suspend / delete at the provider. */
    setAccountStatus(
        accountId: string,
        status: 'active' | 'suspended' | 'archived',
    ): Promise<void>;
}

/** Default stub — safe to ship. Replace via `getMailTransport()` rewiring. */
export class StubMailTransport implements IMailTransport {
    async send(envelope: OutboundMailEnvelope): Promise<MailSendResult> {
        // eslint-disable-next-line no-console
        console.warn(
            '[StubMailTransport] send() called — no provider wired. Envelope:',
            { ...envelope, bodyFileId: envelope.bodyFileId ?? '(none)' },
        );
        return {
            messageId: `stub-${Date.now()}@sabnode.local`,
            accepted: envelope.to.map((t) => t.email),
            rejected: [],
        };
    }

    async verifyDomain(_domainId: string): Promise<DomainVerificationResult> {
        return {
            mx: 'pending',
            spf: 'pending',
            dkim: 'pending',
            dmarc: 'pending',
            notes: ['StubMailTransport — DNS verification skipped.'],
        };
    }

    async provisionAccount(_accountId: string, _password: string): Promise<void> {
        // no-op
    }

    async setAccountStatus(
        _accountId: string,
        _status: 'active' | 'suspended' | 'archived',
    ): Promise<void> {
        // no-op
    }
}

let cachedTransport: IMailTransport | null = null;

/**
 * Lazily resolve the active mail transport. Today this always returns
 * `StubMailTransport`; when the real provider lands, branch here on
 * `process.env.MAIL_PROVIDER`.
 */
export function getMailTransport(): IMailTransport {
    if (!cachedTransport) {
        cachedTransport = new StubMailTransport();
    }
    return cachedTransport;
}
