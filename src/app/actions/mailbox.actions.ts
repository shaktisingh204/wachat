'use server';

/**
 * Hosted Mail server actions.
 *
 * Application-layer surface for `/dashboard/mailbox/**`. Routes call these
 * server actions; under the hood they delegate to the Rust BFF clients in
 * `src/lib/rust-client/mail-*.ts`.
 *
 * Outbound send goes through {@link getMailTransport} — see
 * `src/lib/mailbox/imail-transport.ts`. With the current `StubMailTransport`
 * the UI is functional but no real mail is delivered.
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { getErrorMessage } from '@/lib/utils';
import {
    mailDomainApi,
    type MailDomainDoc,
    type MailDomainCreateInput,
    type MailDomainUpdateInput,
} from '@/lib/rust-client/mail-domains';
import {
    mailAccountApi,
    type MailAccountDoc,
    type MailAccountCreateInput,
    type MailAccountUpdateInput,
} from '@/lib/rust-client/mail-accounts';
import {
    mailAliasApi,
    type MailAliasDoc,
    type MailAliasCreateInput,
    type MailAliasUpdateInput,
} from '@/lib/rust-client/mail-aliases';
import {
    mailFolderApi,
    type MailFolderDoc,
    type MailFolderCreateInput,
    type MailFolderUpdateInput,
} from '@/lib/rust-client/mail-folders';
import {
    mailMessageApi,
    type MailMessageDoc,
    type MailMessageCreateInput,
    type MailMessageUpdateInput,
} from '@/lib/rust-client/mail-messages';
import {
    mailRuleApi,
    type MailRuleDoc,
    type MailRuleCreateInput,
    type MailRuleUpdateInput,
} from '@/lib/rust-client/mail-rules';
import {
    mailContactApi,
    type MailContactDoc,
    type MailContactCreateInput,
    type MailContactUpdateInput,
} from '@/lib/rust-client/mail-contacts-sync';
import {
    getMailTransport,
    type OutboundMailEnvelope,
} from '@/lib/mailbox/imail-transport';

/* ─── shared ─────────────────────────────────────────────────────────── */

export interface MailboxActionError {
    ok: false;
    error: string;
}

export type MailboxActionResult<T> = ({ ok: true } & T) | MailboxActionError;

function revalidateAdmin(): void {
    revalidatePath('/dashboard/mailbox');
    revalidatePath('/dashboard/mailbox/admin/domains');
    revalidatePath('/dashboard/mailbox/admin/accounts');
}

function revalidateAccount(accountId: string): void {
    revalidatePath(`/dashboard/mailbox/${accountId}/inbox`);
    revalidatePath(`/dashboard/mailbox/${accountId}/compose`);
    revalidatePath(`/dashboard/mailbox/${accountId}/rules`);
    revalidatePath(`/dashboard/mailbox/${accountId}/contacts`);
}

async function requireSession() {
    const session = await getSession();
    if (!session?.user) {
        throw new Error('Unauthorized.');
    }
    return session;
}

/* ─── Domains ────────────────────────────────────────────────────────── */

export async function listMailDomains(): Promise<MailDomainDoc[]> {
    await requireSession();
    const page = await mailDomainApi.list({ limit: 100 });
    return page.items;
}

export async function createMailDomain(
    input: MailDomainCreateInput,
): Promise<MailboxActionResult<{ domain: MailDomainDoc | null; id: string }>> {
    try {
        await requireSession();
        if (!input.domain?.trim()) {
            return { ok: false, error: 'Domain is required.' };
        }
        const res = await mailDomainApi.create(input);
        revalidateAdmin();
        return { ok: true, domain: res.entity, id: res.id };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function updateMailDomain(
    id: string,
    patch: MailDomainUpdateInput,
): Promise<MailboxActionResult<{ domain: MailDomainDoc }>> {
    try {
        await requireSession();
        const entity = await mailDomainApi.update(id, patch);
        revalidateAdmin();
        return { ok: true, domain: entity };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function deleteMailDomain(
    id: string,
): Promise<MailboxActionResult<{ deleted: boolean }>> {
    try {
        await requireSession();
        const res = await mailDomainApi.delete(id);
        revalidateAdmin();
        return { ok: true, deleted: res.deleted };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

/**
 * Kick off a DNS recheck via the configured transport. Today this is the
 * stub provider so all statuses stay `pending` — the caller's UI just
 * shows the latest persisted state.
 *
 * TODO(integrator): when the real transport lands, persist the result via
 * `mailDomainApi.update(...)` so the row reflects the lookup outcome.
 */
export async function recheckMailDomainDns(
    id: string,
): Promise<MailboxActionResult<{ verification: Awaited<ReturnType<ReturnType<typeof getMailTransport>['verifyDomain']>> }>> {
    try {
        await requireSession();
        const transport = getMailTransport();
        const verification = await transport.verifyDomain(id);
        // TODO(integrator): persist result via mailDomainApi.update once real
        // verification returns concrete `verified` / `failed` states.
        return { ok: true, verification };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

/* ─── Mailbox accounts ───────────────────────────────────────────────── */

export interface ListMailAccountsParams {
    domainId?: string;
    q?: string;
    status?: 'active' | 'suspended' | 'archived' | 'all';
    limit?: number;
    page?: number;
}

export async function listMailAccounts(
    params: ListMailAccountsParams = {},
): Promise<MailAccountDoc[]> {
    await requireSession();
    const filter: Record<string, unknown> = {};
    if (params.domainId) filter.domainId = params.domainId;
    if (params.status && params.status !== 'all') filter.status = params.status;
    const page = await mailAccountApi.list({
        q: params.q,
        page: params.page ?? 0,
        limit: params.limit ?? 50,
        filter,
    });
    return page.items;
}

export async function getMailAccount(id: string): Promise<MailAccountDoc | null> {
    await requireSession();
    return mailAccountApi.getById(id);
}

export async function createMailAccount(
    input: MailAccountCreateInput,
): Promise<MailboxActionResult<{ account: MailAccountDoc | null; id: string }>> {
    try {
        await requireSession();
        if (!input.localPart?.trim()) {
            return { ok: false, error: 'Local part (the bit before @) is required.' };
        }
        const res = await mailAccountApi.create(input);
        if (res.entity && input.password) {
            // TODO(integrator): forward to transport so the provider knows.
            await getMailTransport().provisionAccount(res.id, input.password);
        }
        revalidateAdmin();
        return { ok: true, account: res.entity, id: res.id };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function updateMailAccount(
    id: string,
    patch: MailAccountUpdateInput,
): Promise<MailboxActionResult<{ account: MailAccountDoc }>> {
    try {
        await requireSession();
        const entity = await mailAccountApi.update(id, patch);
        if (patch.status) {
            await getMailTransport().setAccountStatus(id, patch.status);
        }
        revalidateAdmin();
        revalidateAccount(id);
        return { ok: true, account: entity };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function deleteMailAccount(
    id: string,
): Promise<MailboxActionResult<{ deleted: boolean }>> {
    try {
        await requireSession();
        const res = await mailAccountApi.delete(id);
        revalidateAdmin();
        return { ok: true, deleted: res.deleted };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

/* ─── Aliases ────────────────────────────────────────────────────────── */

export async function listMailAliases(
    domainId?: string,
): Promise<MailAliasDoc[]> {
    await requireSession();
    const page = await mailAliasApi.list({
        limit: 100,
        filter: domainId ? { domainId } : undefined,
    });
    return page.items;
}

export async function createMailAlias(
    input: MailAliasCreateInput,
): Promise<MailboxActionResult<{ alias: MailAliasDoc | null; id: string }>> {
    try {
        await requireSession();
        const res = await mailAliasApi.create(input);
        revalidateAdmin();
        return { ok: true, alias: res.entity, id: res.id };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function updateMailAlias(
    id: string,
    patch: MailAliasUpdateInput,
): Promise<MailboxActionResult<{ alias: MailAliasDoc }>> {
    try {
        await requireSession();
        const entity = await mailAliasApi.update(id, patch);
        revalidateAdmin();
        return { ok: true, alias: entity };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function deleteMailAlias(
    id: string,
): Promise<MailboxActionResult<{ deleted: boolean }>> {
    try {
        await requireSession();
        const res = await mailAliasApi.delete(id);
        revalidateAdmin();
        return { ok: true, deleted: res.deleted };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

/* ─── Folders ────────────────────────────────────────────────────────── */

export async function listMailFolders(accountId: string): Promise<MailFolderDoc[]> {
    await requireSession();
    const page = await mailFolderApi.list({
        limit: 100,
        filter: { accountId },
    });
    return page.items;
}

export async function createMailFolder(
    input: MailFolderCreateInput,
): Promise<MailboxActionResult<{ folder: MailFolderDoc | null; id: string }>> {
    try {
        await requireSession();
        const res = await mailFolderApi.create(input);
        revalidateAccount(input.accountId);
        return { ok: true, folder: res.entity, id: res.id };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function updateMailFolder(
    id: string,
    accountId: string,
    patch: MailFolderUpdateInput,
): Promise<MailboxActionResult<{ folder: MailFolderDoc }>> {
    try {
        await requireSession();
        const entity = await mailFolderApi.update(id, patch);
        revalidateAccount(accountId);
        return { ok: true, folder: entity };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function deleteMailFolder(
    id: string,
    accountId: string,
): Promise<MailboxActionResult<{ deleted: boolean }>> {
    try {
        await requireSession();
        const res = await mailFolderApi.delete(id);
        revalidateAccount(accountId);
        return { ok: true, deleted: res.deleted };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

/* ─── Messages ───────────────────────────────────────────────────────── */

export interface ListMailMessagesParams {
    accountId: string;
    folderId?: string;
    q?: string;
    unreadOnly?: boolean;
    starredOnly?: boolean;
    label?: string;
    page?: number;
    limit?: number;
}

export async function listMailMessages(
    params: ListMailMessagesParams,
): Promise<MailMessageDoc[]> {
    await requireSession();
    const filter: Record<string, unknown> = { accountId: params.accountId };
    if (params.folderId) filter.folderId = params.folderId;
    if (params.unreadOnly) filter.unread = true;
    if (params.starredOnly) filter.starred = true;
    if (params.label) filter.label = params.label;
    const page = await mailMessageApi.list({
        q: params.q,
        page: params.page ?? 0,
        limit: params.limit ?? 50,
        filter,
    });
    return page.items;
}

export async function getMailMessage(id: string): Promise<MailMessageDoc | null> {
    await requireSession();
    return mailMessageApi.getById(id);
}

export async function markMailMessage(
    id: string,
    patch: MailMessageUpdateInput,
    accountId: string,
): Promise<MailboxActionResult<{ message: MailMessageDoc }>> {
    try {
        await requireSession();
        const entity = await mailMessageApi.update(id, patch);
        revalidateAccount(accountId);
        return { ok: true, message: entity };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

/**
 * Composer "Save draft" — creates a row in the `drafts` folder. The body
 * is expected to be a SabFiles `.eml` ref.
 */
export async function saveMailDraft(
    input: MailMessageCreateInput,
): Promise<MailboxActionResult<{ message: MailMessageDoc | null; id: string }>> {
    try {
        await requireSession();
        const res = await mailMessageApi.create({
            ...input,
            unread: false,
        });
        revalidateAccount(input.accountId);
        return { ok: true, message: res.entity, id: res.id };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

/**
 * Send via the configured transport. With `StubMailTransport` this just
 * logs and resolves — no actual SMTP traffic. The caller is expected to
 * have already produced a SabFiles `.eml` ref (or HTML/text body).
 */
export async function sendMailMessage(
    envelope: OutboundMailEnvelope,
): Promise<MailboxActionResult<{ messageId: string }>> {
    try {
        await requireSession();
        const transport = getMailTransport();
        const result = await transport.send(envelope);
        revalidateAccount(envelope.accountId);
        return { ok: true, messageId: result.messageId };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

/* ─── Rules ──────────────────────────────────────────────────────────── */

export async function listMailRules(accountId: string): Promise<MailRuleDoc[]> {
    await requireSession();
    const page = await mailRuleApi.list({ limit: 100, filter: { accountId } });
    return page.items;
}

export async function createMailRule(
    input: MailRuleCreateInput,
): Promise<MailboxActionResult<{ rule: MailRuleDoc | null; id: string }>> {
    try {
        await requireSession();
        const res = await mailRuleApi.create(input);
        revalidateAccount(input.accountId);
        return { ok: true, rule: res.entity, id: res.id };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function updateMailRule(
    id: string,
    accountId: string,
    patch: MailRuleUpdateInput,
): Promise<MailboxActionResult<{ rule: MailRuleDoc }>> {
    try {
        await requireSession();
        const entity = await mailRuleApi.update(id, patch);
        revalidateAccount(accountId);
        return { ok: true, rule: entity };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function deleteMailRule(
    id: string,
    accountId: string,
): Promise<MailboxActionResult<{ deleted: boolean }>> {
    try {
        await requireSession();
        const res = await mailRuleApi.delete(id);
        revalidateAccount(accountId);
        return { ok: true, deleted: res.deleted };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

/* ─── Contacts (address book) ────────────────────────────────────────── */

export async function listMailContacts(
    accountId: string,
    q?: string,
): Promise<MailContactDoc[]> {
    await requireSession();
    const page = await mailContactApi.list({
        q,
        limit: 100,
        filter: { accountId },
    });
    return page.items;
}

export async function createMailContact(
    input: MailContactCreateInput,
): Promise<MailboxActionResult<{ contact: MailContactDoc | null; id: string }>> {
    try {
        await requireSession();
        const res = await mailContactApi.create(input);
        revalidateAccount(input.accountId);
        return { ok: true, contact: res.entity, id: res.id };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function updateMailContact(
    id: string,
    accountId: string,
    patch: MailContactUpdateInput,
): Promise<MailboxActionResult<{ contact: MailContactDoc }>> {
    try {
        await requireSession();
        const entity = await mailContactApi.update(id, patch);
        revalidateAccount(accountId);
        return { ok: true, contact: entity };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

export async function deleteMailContact(
    id: string,
    accountId: string,
): Promise<MailboxActionResult<{ deleted: boolean }>> {
    try {
        await requireSession();
        const res = await mailContactApi.delete(id);
        revalidateAccount(accountId);
        return { ok: true, deleted: res.deleted };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}
