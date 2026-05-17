/**
 * `send_email` action handler.
 *
 * STUBBED on purpose: actual SMTP / Google / Outlook dispatch goes
 * through the existing email-settings infra under
 * `src/lib/email-dispatcher.ts` (see EmailSettings in
 * src/lib/definitions.ts). Wiring TODO:
 *
 *   import { dispatchTransactionalEmail } from '@/lib/email-dispatcher';
 *   await dispatchTransactionalEmail({
 *       tenantUserId: ctx.automation.userId,
 *       to: cfg.to,
 *       subject: cfg.subject,
 *       body: cfg.body,
 *       templateId: cfg.templateId,
 *   });
 *
 * Until that lands, we structured-log the email payload so operators can
 * verify automations are firing and view the rendered recipient/body in
 * the workflow run output.
 */

import type { SendEmailActionConfig } from '../types';
import type { ActionContext } from './index';

export async function sendEmailAction(
    cfg: SendEmailActionConfig,
    ctx: ActionContext,
): Promise<string> {
    if (!cfg.to) throw new Error('send_email: recipient (to) is required');
    if (!cfg.subject) throw new Error('send_email: subject is required');

    // Render templated tokens. Conservative: only support {{field}} on
    // top-level entity keys for now — anything richer is a TODO once we
    // pick a templating library (handlebars vs liquid).
    const subject = renderTemplate(cfg.subject, ctx);
    const body = renderTemplate(cfg.body ?? '', ctx);
    const to = renderTemplate(cfg.to, ctx);

    console.log('[automation:send_email] STUB — email dispatch not yet wired', {
        automationId: ctx.automation._id,
        userId: ctx.automation.userId,
        entityKind: ctx.event.entityKind,
        entityId: ctx.event.entityId,
        templateId: cfg.templateId,
        to,
        subject,
        bodyPreview: body.slice(0, 200),
    });

    return `Logged email to ${to} (subject: "${subject}")`;
}

function renderTemplate(tpl: string, ctx: ActionContext): string {
    if (!tpl) return '';
    return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path) => {
        const v = getPath(ctx.entity, path);
        return v == null ? '' : String(v);
    });
}

function getPath(obj: unknown, path: string): unknown {
    const segs = path.split('.');
    let cur: unknown = obj;
    for (const seg of segs) {
        if (cur == null || typeof cur !== 'object') return undefined;
        cur = (cur as Record<string, unknown>)[seg];
    }
    return cur;
}
