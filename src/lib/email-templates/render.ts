/**
 * Mustache-lite template renderer + per-tenant override resolver.
 *
 * Substitution syntax is `{{variable}}`. Whitespace inside the braces is
 * tolerated (`{{ var }}`). Values are HTML-escaped to defend against
 * stored-XSS through user-supplied data such as client names or ticket
 * subjects. The template itself is trusted — admins author it.
 */

import 'server-only';

import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { findEmailEvent } from './events';

export type TemplateVars = Record<string, string | number | null | undefined>;

/** Mongo document shape for tenant overrides. */
export interface EmailEventTemplateOverride {
    userId: ObjectId;
    eventKey: string;
    subject: string;
    body: string;
    updatedAt: Date;
}

const TEMPLATE_TOKEN = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;

/** Escape user-supplied substitution values to keep HTML safe. */
function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function stringifyValue(value: string | number | null | undefined): string {
    if (value === undefined || value === null) return '';
    return String(value);
}

/**
 * Render a template by substituting `{{var}}` tokens. Missing vars resolve
 * to empty strings, matching Mustache semantics for non-existent keys.
 *
 * Values are HTML-escaped — pass already-escaped HTML through the template
 * itself, not through `vars`.
 */
export function renderTemplate(template: string, vars: TemplateVars): string {
    return template.replace(TEMPLATE_TOKEN, (_, key: string) => {
        return escapeHtml(stringifyValue(vars[key]));
    });
}

/**
 * Render the subject line. Identical substitution rules to body, but HTML
 * escaping is still applied so that `<`, `>`, `&` etc. in values appear
 * literally rather than being interpreted by clients that auto-link.
 */
export function renderSubject(subject: string, vars: TemplateVars): string {
    return renderTemplate(subject, vars);
}

/* ─── DB-backed effective-template resolution ───────────────────────────── */

const COLLECTION = 'crm_email_event_templates';

/**
 * Resolve the *effective* template for a tenant + event:
 *  1. Look up `crm_email_event_templates` for the given `userId / eventKey`.
 *  2. If found, return the override.
 *  3. Otherwise return the code default from `EMAIL_EVENTS`.
 *
 * Throws when the event key is unknown — callers should pass a key listed
 * in `events.ts`.
 */
export async function getEffectiveTemplate(
    userId: string,
    eventKey: string,
): Promise<{ subject: string; body: string; isCustomized: boolean }> {
    const event = findEmailEvent(eventKey);
    if (!event) {
        throw new Error(`Unknown email event key: ${eventKey}`);
    }
    if (!userId || !ObjectId.isValid(userId)) {
        return {
            subject: event.defaultSubject,
            body: event.defaultBody,
            isCustomized: false,
        };
    }

    try {
        const { db } = await connectToDatabase();
        const doc = await db
            .collection<EmailEventTemplateOverride>(COLLECTION)
            .findOne({
                userId: new ObjectId(userId),
                eventKey,
            });
        if (doc) {
            return {
                subject: doc.subject,
                body: doc.body,
                isCustomized: true,
            };
        }
    } catch (err) {
        // Defensive: a DB hiccup should never block sending email — fall
        // back to the code default.
        console.warn('[email-templates] override lookup failed', {
            userId,
            eventKey,
            error: err instanceof Error ? err.message : String(err),
        });
    }

    return {
        subject: event.defaultSubject,
        body: event.defaultBody,
        isCustomized: false,
    };
}

/**
 * Convenience helper — resolves the effective template AND renders it with
 * the given variables, in one round-trip. Most callers want this.
 */
export async function renderEffectiveTemplate(
    userId: string,
    eventKey: string,
    vars: TemplateVars,
): Promise<{ subject: string; html: string; isCustomized: boolean }> {
    const tpl = await getEffectiveTemplate(userId, eventKey);
    return {
        subject: renderSubject(tpl.subject, vars),
        html: renderTemplate(tpl.body, vars),
        isCustomized: tpl.isCustomized,
    };
}

export const EMAIL_TEMPLATE_COLLECTION = COLLECTION;
