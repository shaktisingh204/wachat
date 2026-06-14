import 'server-only';

import { getTransporter } from '@/lib/email-service';

/**
 * Best-effort onboarding welcome email, sent via the org owner's configured
 * mailer (`email_settings`). Delivered to an ALTERNATE address (a personal
 * email / manager) — never the new mailbox itself, which the employee can't
 * read until they sign in. Any failure is swallowed: the admin always has the
 * one-time credentials card as the primary hand-off path.
 */
export async function sendOnboardingEmail(
  ownerUserId: string,
  to: string,
  info: { upn: string; displayName: string; password?: string },
): Promise<boolean> {
  try {
    const transporter = await getTransporter(ownerUserId);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const loginUrl = `${appUrl}/login`;
    const safeName = info.displayName || 'there';

    const html = `
      <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:480px;margin:auto;color:#18181b">
        <h2 style="margin:0 0 8px">Welcome, ${safeName} 👋</h2>
        <p style="color:#52525b;margin:0 0 16px">Your work account is ready.</p>
        <div style="border:1px solid #e4e4e7;border-radius:10px;padding:16px;margin:0 0 16px">
          <div style="font-size:12px;text-transform:uppercase;color:#71717a">Email / sign-in</div>
          <div style="font-family:ui-monospace,monospace;font-size:14px;margin:2px 0 12px">${info.upn}</div>
          ${
            info.password
              ? `<div style="font-size:12px;text-transform:uppercase;color:#71717a">Temporary password</div>
                 <div style="font-family:ui-monospace,monospace;font-size:14px;margin:2px 0 0">${info.password}</div>`
              : `<div style="font-size:13px;color:#71717a">Your administrator will share your temporary password securely.</div>`
          }
        </div>
        <p style="margin:0 0 16px">
          <a href="${loginUrl}" style="background:#4f46e5;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block">Sign in</a>
        </p>
        <p style="color:#71717a;font-size:13px;margin:0">You'll be asked to set a new password on first sign-in.</p>
      </div>`;

    const text = `Welcome, ${safeName}.\n\nEmail / sign-in: ${info.upn}\n${
      info.password ? `Temporary password: ${info.password}\n` : ''
    }\nSign in: ${loginUrl}\nYou'll set a new password on first sign-in.`;

    await transporter.sendMail({
      from: `"SabNode" <${process.env.EMAIL_FROM || 'noreply@sabnode.com'}>`,
      to,
      subject: `Your ${info.upn} account is ready`,
      html,
      text,
    });
    return true;
  } catch {
    return false;
  }
}
