import 'server-only';

import { dispatchTransactionalEmail } from '@/lib/email-dispatcher';
import { sabsmsEngine } from '@/lib/sabsms/engine-client';
import { getBrandingByWorkspace, type SabsignBranding } from '@/lib/sabsign/branding';
import type {
  EnvelopeSigner,
  SabSignEnvelopeDoc,
} from '@/lib/rust-client/sabsign-envelopes';

/**
 * SabSign signer notifications.
 *
 * Invites go out via {@link dispatchTransactionalEmail}, keyed by the envelope
 * OWNER's `userId` (= their configured `email_settings` transport). If the
 * owner hasn't configured a sender yet the dispatcher returns
 * `email_settings_missing` (never throws), so sending an envelope never fails
 * just because email isn't set up.
 *
 * OTP SMS is best-effort through the SabSMS engine — `suppressed` when the
 * engine / a provider isn't configured.
 */

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    ''
  ).replace(/\/+$/, '');
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      (({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }) as Record<
        string,
        string
      >)[c] ?? c,
  );
}

/** Absolute (when a base URL is configured) public sign link for one signer. */
export function signUrl(env: SabSignEnvelopeDoc, signer: EnvelopeSigner): string {
  const path = `/sign/${encodeURIComponent(env._id)}?signerId=${encodeURIComponent(
    signer.id,
  )}&t=${encodeURIComponent(signer.accessToken ?? '')}`;
  const base = appBaseUrl();
  return base ? `${base}${path}` : path;
}

/** Build the {subject, html} for one signer's invite (or reminder) email. */
export function buildSignerEmail(
  env: SabSignEnvelopeDoc,
  signer: EnvelopeSigner,
  opts?: { reminder?: boolean; branding?: SabsignBranding | null },
): { subject: string; html: string; url: string } {
  const docName = env.docName || env.name;
  const url = signUrl(env, signer);
  const reminder = !!opts?.reminder;
  const accent = opts?.branding?.color || '#7c3aed';
  const sender = opts?.branding?.senderName;
  const subject = reminder
    ? `Reminder: please sign ${docName}`
    : env.subject || `Signature requested: ${docName}`;
  const heading = reminder
    ? `Reminder — your signature is still needed`
    : env.subject || `Please sign: ${docName}`;
  const message = env.message
    ? `<p style="margin:0 0 16px;color:#444;">${escapeHtml(env.message)}</p>`
    : '';
  const logo = opts?.branding?.logoUrl
    ? `<img src="${opts.branding.logoUrl}" alt="${escapeHtml(sender || 'logo')}" style="max-height:40px;margin:0 0 16px;display:block;" />`
    : '';
  const footer = sender
    ? `<p style="margin:12px 0 0;color:#aaa;font-size:11px;">Sent via ${escapeHtml(sender)}</p>`
    : '';
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:8px;">
  ${logo}
  <h2 style="font-size:18px;color:#111;margin:0 0 12px;">${escapeHtml(heading)}</h2>
  <p style="margin:0 0 8px;color:#444;">Hi ${escapeHtml(signer.name || 'there')},</p>
  <p style="margin:0 0 16px;color:#444;">${
    reminder ? 'This is a friendly reminder to review and sign' : "You've been requested to review and sign"
  } <strong>${escapeHtml(docName)}</strong>.</p>
  ${message}
  <p style="margin:0 0 20px;">
    <a href="${url}" style="display:inline-block;background:${accent};color:#fff;padding:11px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Review &amp; sign</a>
  </p>
  <p style="margin:0;color:#999;font-size:12px;">If the button doesn't work, paste this link into your browser:<br><span style="word-break:break-all;">${url}</span></p>
  ${footer}
</div>`;
  return { subject, html, url };
}

/** Resolve project branding for an envelope from its (runtime) tenantId. */
async function brandingForEnvelope(env: SabSignEnvelopeDoc): Promise<SabsignBranding | null> {
  const ws = (env as { tenantId?: string }).tenantId;
  return ws ? getBrandingByWorkspace(ws) : null;
}

/**
 * E-mail every signer currently in `notified` status. Best-effort: a single
 * failed recipient does not abort the rest. Returns send counts.
 */
export async function sendSignInvites(
  env: SabSignEnvelopeDoc,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  const owner = env.userId;
  if (!owner) return { sent, failed };

  const targets = (env.signers ?? []).filter(
    (s) => s.status === 'notified' && !!s.email,
  );
  const branding = await brandingForEnvelope(env);
  for (const signer of targets) {
    try {
      const { subject, html } = buildSignerEmail(env, signer, { branding });
      const res = await dispatchTransactionalEmail({
        tenantUserId: owner,
        to: signer.email,
        subject,
        html,
        templateId: 'sabsign.invite',
      });
      if (res.ok) sent += 1;
      else {
        failed += 1;
        console.warn(`[sabsign] invite email to ${signer.email} failed:`, res.error);
      }
    } catch (e) {
      failed += 1;
      console.warn(`[sabsign] invite email to ${signer.email} threw:`, e);
    }
  }
  return { sent, failed };
}

/**
 * Re-send the signing link to every signer who hasn't finished yet (status not
 * `completed`/`declined`). Used by the reminders cron. Best-effort.
 */
export async function sendReminderEmails(
  env: SabSignEnvelopeDoc,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  const owner = env.userId;
  if (!owner) return { sent, failed };

  const targets = (env.signers ?? []).filter(
    (s) => !!s.email && s.status !== 'completed' && s.status !== 'declined',
  );
  const branding = await brandingForEnvelope(env);
  for (const signer of targets) {
    try {
      const { subject, html } = buildSignerEmail(env, signer, { reminder: true, branding });
      const res = await dispatchTransactionalEmail({
        tenantUserId: owner,
        to: signer.email,
        subject,
        html,
        templateId: 'sabsign.reminder',
      });
      if (res.ok) sent += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }
  return { sent, failed };
}

/** Best-effort OTP SMS for an SMS-OTP signer. Suppressed without SabSMS setup. */
export async function sendOtpSms(
  phone: string,
  otp: string,
  workspaceId?: string,
): Promise<boolean> {
  try {
    const res = await sabsmsEngine.enqueueSend({
      workspaceId: workspaceId ?? '',
      to: phone,
      body: `Your signing verification code is ${otp}. It expires in 10 minutes.`,
      category: 'transactional' as never,
    });
    return !!res;
  } catch (e) {
    console.warn('[sabsign] OTP SMS send failed:', e);
    return false;
  }
}
