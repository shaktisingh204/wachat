import 'server-only';

import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getTransporter } from '@/lib/email-service';
import { SmsService } from '@/lib/sms/services/provider.factory';
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

  const { db } = await connectToDatabase();
  const config = await db.collection('sms_configs').findOne({
    userId: new ObjectId(d.userId),
  });
  if (!config || !config.isActive) {
    return { sent: false, error: 'No active SMS provider configuration.' };
  }

  const provider = await SmsService.getProvider(d.userId);
  if (!provider) return { sent: false, error: 'Provider init failed.' };

  // Resolve DLT template — explicit ID wins; otherwise match by prefix.
  let dlt = {
    dltTemplateId: '',
    dltPrincipalEntityId: config.dlt?.principalEntityId || '',
    dltHeaderId: '',
  };
  if (d.templateId) {
    const tpl = await db
      .collection('dlt_templates')
      .findOne({ _id: new ObjectId(d.templateId) });
    if (tpl) {
      dlt.dltTemplateId = tpl.dltTemplateId;
      dlt.dltHeaderId = tpl.headerId;
    }
  } else if (binding.templatePrefix) {
    const tpl = await db.collection('dlt_templates').findOne({
      userId: new ObjectId(d.userId),
      name: { $regex: `^${escapeRegex(binding.templatePrefix)}` },
    });
    if (tpl) {
      dlt.dltTemplateId = tpl.dltTemplateId;
      dlt.dltHeaderId = tpl.headerId;
    }
  }

  // Sender ID — pass through to the provider where supported. Providers
  // that don't expose a sender override silently fall back to their
  // account default; that's intended.
  if (binding.senderId && (dlt as any).senderId !== binding.senderId) {
    (dlt as any).senderId = binding.senderId;
  }

  const result = await provider.send(d.to, d.message, dlt as any);

  await db.collection('sms_logs').insertOne({
    userId: new ObjectId(d.userId),
    to: d.to,
    content: d.message,
    provider: config.provider,
    status: result.status,
    providerMessageId: result.messageId,
    error: result.error,
    eventKey: d.eventKey,
    senderId: binding.senderId,
    sentAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return {
    sent: result.status === 'SENT' || result.status === 'QUEUED',
    messageId: result.messageId,
    error: result.error,
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
