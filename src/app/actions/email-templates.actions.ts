'use server';

/**
 * Event-driven email template settings — server actions.
 *
 * Scope: every action is multi-tenant — keyed by `session.user._id`. Reads
 * fall through to the code defaults defined in `@/lib/email-templates/events`
 * when no per-tenant override exists.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import {
    EMAIL_EVENTS,
    findEmailEvent,
    type EmailEventCategory,
} from '@/lib/email-templates/events';
import {
    EMAIL_TEMPLATE_COLLECTION,
    renderSubject,
    renderTemplate,
    type EmailEventTemplateOverride,
} from '@/lib/email-templates/render';

export interface EmailTemplateListItem {
    eventKey: string;
    label: string;
    category: EmailEventCategory;
    description: string;
    isCustomized: boolean;
}

export interface EmailTemplateDetail {
    eventKey: string;
    label: string;
    description: string;
    category: EmailEventCategory;
    subject: string;
    body: string;
    isCustomized: boolean;
    default: { subject: string; body: string };
    variables: Array<{ key: string; description: string; example: string }>;
    updatedAt: string | null;
}

const SETTINGS_PATH = '/dashboard/crm/settings/email-templates';

/** List every event with its customisation status for the current tenant. */
export async function listEmailTemplates(): Promise<EmailTemplateListItem[]> {
    const session = await getSession();
    if (!session?.user) return [];

    let customizedKeys = new Set<string>();
    try {
        const { db } = await connectToDatabase();
        const docs = await db
            .collection<EmailEventTemplateOverride>(EMAIL_TEMPLATE_COLLECTION)
            .find({ userId: new ObjectId(session.user._id) }, { projection: { eventKey: 1 } })
            .toArray();
        customizedKeys = new Set(docs.map((d) => d.eventKey));
    } catch (err) {
        console.warn('[email-templates] listEmailTemplates fallback', err);
    }

    return EMAIL_EVENTS.map((evt) => ({
        eventKey: evt.key,
        label: evt.label,
        category: evt.category,
        description: evt.description,
        isCustomized: customizedKeys.has(evt.key),
    }));
}

/** Load a single template (override or default) plus metadata. */
export async function getEmailTemplate(
    eventKey: string,
): Promise<EmailTemplateDetail | null> {
    const session = await getSession();
    if (!session?.user) return null;

    const event = findEmailEvent(eventKey);
    if (!event) return null;

    let override: EmailEventTemplateOverride | null = null;
    try {
        const { db } = await connectToDatabase();
        override = await db
            .collection<EmailEventTemplateOverride>(EMAIL_TEMPLATE_COLLECTION)
            .findOne({
                userId: new ObjectId(session.user._id),
                eventKey,
            });
    } catch (err) {
        console.warn('[email-templates] getEmailTemplate fallback', err);
    }

    return {
        eventKey: event.key,
        label: event.label,
        description: event.description,
        category: event.category,
        subject: override?.subject ?? event.defaultSubject,
        body: override?.body ?? event.defaultBody,
        isCustomized: Boolean(override),
        default: {
            subject: event.defaultSubject,
            body: event.defaultBody,
        },
        variables: event.variables,
        updatedAt: override?.updatedAt
            ? new Date(override.updatedAt).toISOString()
            : null,
    };
}

export interface SaveEmailTemplateResult {
    ok: boolean;
    error?: string;
}

/** Upsert a per-tenant override for an event. */
export async function saveEmailTemplate(
    eventKey: string,
    subject: string,
    body: string,
): Promise<SaveEmailTemplateResult> {
    const session = await getSession();
    if (!session?.user) {
        return { ok: false, error: 'Authentication required.' };
    }
    const event = findEmailEvent(eventKey);
    if (!event) {
        return { ok: false, error: `Unknown event: ${eventKey}` };
    }
    const trimmedSubject = subject.trim();
    if (!trimmedSubject) {
        return { ok: false, error: 'Subject cannot be empty.' };
    }
    const trimmedBody = body.trim();
    if (!trimmedBody) {
        return { ok: false, error: 'Body cannot be empty.' };
    }

    try {
        const { db } = await connectToDatabase();
        await db
            .collection<EmailEventTemplateOverride>(EMAIL_TEMPLATE_COLLECTION)
            .updateOne(
                {
                    userId: new ObjectId(session.user._id),
                    eventKey,
                },
                {
                    $set: {
                        subject: trimmedSubject,
                        body: trimmedBody,
                        updatedAt: new Date(),
                    },
                    $setOnInsert: {
                        userId: new ObjectId(session.user._id),
                        eventKey,
                    },
                },
                { upsert: true },
            );
        revalidatePath(SETTINGS_PATH);
        return { ok: true };
    } catch (err) {
        return {
            ok: false,
            error: err instanceof Error ? err.message : 'Failed to save template.',
        };
    }
}

/** Remove the per-tenant override so the code default applies again. */
export async function restoreDefaultTemplate(
    eventKey: string,
): Promise<SaveEmailTemplateResult> {
    const session = await getSession();
    if (!session?.user) {
        return { ok: false, error: 'Authentication required.' };
    }
    if (!findEmailEvent(eventKey)) {
        return { ok: false, error: `Unknown event: ${eventKey}` };
    }

    try {
        const { db } = await connectToDatabase();
        await db
            .collection<EmailEventTemplateOverride>(EMAIL_TEMPLATE_COLLECTION)
            .deleteOne({
                userId: new ObjectId(session.user._id),
                eventKey,
            });
        revalidatePath(SETTINGS_PATH);
        return { ok: true };
    } catch (err) {
        return {
            ok: false,
            error: err instanceof Error ? err.message : 'Failed to restore default.',
        };
    }
}

/**
 * Render the given draft subject + body with example variable values and
 * send it to the current admin's email address using the tenant's
 * configured transport.
 */
export async function testSendTemplate(
    eventKey: string,
    subject: string,
    body: string,
): Promise<SaveEmailTemplateResult> {
    const session = await getSession();
    if (!session?.user) {
        return { ok: false, error: 'Authentication required.' };
    }
    const event = findEmailEvent(eventKey);
    if (!event) {
        return { ok: false, error: `Unknown event: ${eventKey}` };
    }
    const toAddress = session.user.email;
    if (!toAddress) {
        return { ok: false, error: 'Your account has no email address on file.' };
    }

    // Build the preview variables from the event's example values.
    const previewVars: Record<string, string> = {};
    for (const v of event.variables) {
        previewVars[v.key] = v.example;
    }

    const renderedSubject = `[TEST] ${renderSubject(subject, previewVars)}`;
    const renderedBody = renderTemplate(body, previewVars);

    try {
        const { dispatchTransactionalEmail } = await import('@/lib/email-dispatcher');
        const result = await dispatchTransactionalEmail({
            tenantUserId: session.user._id,
            to: toAddress,
            subject: renderedSubject,
            html: renderedBody,
            templateId: `event:${event.key}`,
        });
        if (!result.ok) {
            // Fall through to the simple stub when no tenant transport is set up.
            if (result.error === 'email_settings_missing') {
                const { sendEmail } = await import('@/lib/email/send');
                const stubResult = await sendEmail(
                    toAddress,
                    renderedSubject,
                    renderedBody,
                );
                if (!stubResult.ok) {
                    return { ok: false, error: 'Stub email send failed.' };
                }
                return { ok: true };
            }
            return { ok: false, error: result.error ?? 'Send failed.' };
        }
        return { ok: true };
    } catch (err) {
        return {
            ok: false,
            error: err instanceof Error ? err.message : 'Send failed.',
        };
    }
}

/**
 * Render-only helper for the preview pane — never sends, just substitutes
 * the example values into the draft template. Safe to call from the client.
 */
export async function previewEmailTemplate(
    eventKey: string,
    subject: string,
    body: string,
): Promise<{ ok: true; subject: string; html: string } | { ok: false; error: string }> {
    const event = findEmailEvent(eventKey);
    if (!event) {
        return { ok: false, error: `Unknown event: ${eventKey}` };
    }
    const previewVars: Record<string, string> = {};
    for (const v of event.variables) {
        previewVars[v.key] = v.example;
    }
    return {
        ok: true,
        subject: renderSubject(subject, previewVars),
        html: renderTemplate(body, previewVars),
    };
}
