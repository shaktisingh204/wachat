import 'server-only';

import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getTransporter } from '@/lib/email-service';
import { sabsmsEngine } from '@/lib/sabsms/engine-client';
import type { EmailSettings } from '@/lib/definitions';

import {
  formatSmtpFromHeader,
  getCrmSmsBinding,
  getCrmSmtpBinding,
  isCrmEmailEventEnabled,
  isCrmSmsTriggerEnabled,
} from './module-connections.server';

/**
 * CRM transactional dispatch helpers.
 *
 * Any CRM action that wants to fire an event-bound email/SMS should call
 * `sendCrmEventEmail` / `sendCrmEventSms` instead of nodemailer / the
 * SMS provider directly. These helpers consult the CRM ↔ module
 * connections (set via the wizards at /dashboard/crm/settings/integrations/*)
 * to decide whether the event is enabled, which sender identity to use,
 * and how to look up the DLT template.
 */

export interface CrmEmailDispatch {
  /** Tenant owner. */
  userId: string;
  /** Event key matching the connection wizard catalog
   *  (e.g. 'invoice.created', 'quote.sent'). */
  eventKey: string;
  to: string;
  subject: string;
  html: string;
}

export interface CrmSmsDispatch {
  userId: string;
  eventKey: string;
  to: string;
  message: string;
  /** Optional explicit template ID. If omitted, the SMS binding's
   *  `templatePrefix` is matched against `dlt_templates.name`. */
  templateId?: string;
}

export async function sendCrmEventEmail(
  d: CrmEmailDispatch,
): Promise<{ sent: boolean; skipped?: boolean; error?: string }> {
  const enabled = await isCrmEmailEventEnabled(d.userId, d.eventKey);
  if (!enabled) return { sent: false, skipped: true };

  const { db } = await connectToDatabase();
  const settings = (await db.collection<EmailSettings>('email_settings').findOne({
    userId: new ObjectId(d.userId),
  })) as EmailSettings | null;

  const binding = await getCrmSmtpBinding(d.userId);
  const fromHeader = binding
    ? formatSmtpFromHeader(binding)
    : settings
      ? `"${settings.fromName}" <${settings.fromEmail}>`
      : null;
  if (!fromHeader) {
    return { sent: false, error: 'No SMTP sender configured.' };
  }

  try {
    const transporter = await getTransporter();
    await transporter.sendMail({
      from: fromHeader,
      ...(binding?.replyTo ? { replyTo: binding.replyTo } : {}),
      to: d.to,
      subject: d.subject,
      html: d.html,
    });
    return { sent: true };
  } catch (e: any) {
    return { sent: false, error: e?.message ?? 'send failed' };
  }
}

export async function sendCrmEventSms(
  d: CrmSmsDispatch,
): Promise<{
  sent: boolean;
  skipped?: boolean;
  error?: string;
  messageId?: string;
}> {
  const binding = await getCrmSmsBinding(d.userId);
  if (!binding) return { sent: false, skipped: true, error: 'No SMS binding' };

  const enabled = await isCrmSmsTriggerEnabled(d.userId, d.eventKey);
  if (!enabled) return { sent: false, skipped: true };

  try {
    const result = await sabsmsEngine.enqueueSend({
      workspaceId: d.userId,
      to: d.to,
      body: d.message,
      category: 'transactional',
      eventKey: d.eventKey,
      senderId: binding.senderId,
      templateId: d.templateId,
      templatePrefix: binding.templatePrefix,
    });
    return {
      sent: result.status === 'queued' || result.status === 'sent',
      messageId: result.id,
    };
  } catch (e: any) {
    return { sent: false, error: e?.message ?? 'send failed' };
  }
}
