/**
 * Shared email template helpers. Every transactional email the team module
 * sends shares the same Clay-branded chrome (warm cream background, rose
 * accent band, obsidian CTA button, quiet footer) so the brand stays
 * consistent across invite / welcome / role-change messages.
 *
 * All helpers return a single HTML string — pass it to `nodemailer.sendMail`.
 */

export type EmailTemplateInput = {
    title: string;
    preheader?: string;
    badge?: string;
    bodyHtml: string;
    primaryCta?: { label: string; href: string };
    secondaryCta?: { label: string; href: string };
    footnote?: string;
};

export function renderBrandedEmail(input: EmailTemplateInput): string {
    const {
        title,
        preheader,
        badge,
        bodyHtml,
        primaryCta,
        secondaryCta,
        footnote,
    } = input;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escape(title)}</title>
</head>
<body style="margin:0;padding:0;background:#F4F2EE;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1C1917;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escape(preheader)}</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F2EE;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #E7E3DC;border-radius:18px;box-shadow:0 6px 24px rgba(28,25,23,0.06);overflow:hidden;">
        <tr><td style="height:6px;background:#B07B7B;"></td></tr>
        <tr><td style="padding:40px 40px 24px 40px;">
          ${badge ? `<div style="display:inline-block;background:#F5E6E3;color:#6F2A28;font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;padding:6px 12px;border-radius:999px;">${escape(badge)}</div>` : ''}
          <h1 style="margin:20px 0 8px 0;font-size:24px;font-weight:600;letter-spacing:-0.015em;color:#1C1917;">${escape(title)}</h1>
          <div style="font-size:14px;color:#57534E;line-height:1.55;">${bodyHtml}</div>
        </td></tr>
        ${
            primaryCta
                ? `<tr><td style="padding:8px 40px 24px 40px;">
            <a href="${escapeAttr(primaryCta.href)}" style="display:inline-block;background:#1F1C1A;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:500;padding:12px 22px;border-radius:999px;">${escape(primaryCta.label)}</a>
            ${
                secondaryCta
                    ? `<a href="${escapeAttr(secondaryCta.href)}" style="display:inline-block;margin-left:8px;background:#FFFFFF;color:#1F1C1A;text-decoration:none;font-size:14px;font-weight:500;padding:12px 22px;border:1px solid #E7E3DC;border-radius:999px;">${escape(secondaryCta.label)}</a>`
                    : ''
            }
          </td></tr>`
                : ''
        }
        ${
            footnote
                ? `<tr><td style="padding:0 40px 40px 40px;border-top:1px solid #F1EDE6;">
          <p style="margin:16px 0 0 0;font-size:11px;color:#A8A29E;line-height:1.5;">${footnote}</p>
        </td></tr>`
                : '<tr><td style="padding-bottom:40px"></td></tr>'
        }
      </table>
      <p style="margin:16px 0 0 0;font-size:11px;color:#A8A29E;">SabNode · Teams</p>
    </td></tr>
  </table>
</body>
</html>`;
}

function escape(s: string): string {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeAttr(s: string): string {
    return escape(s);
}

/* ─── Specific templates ──────────────────────────────────────────────────── */

export function renderWelcomeEmail(input: {
    inviteeName: string;
    projectName: string;
    inviterName: string;
    role: string;
    dashboardUrl: string;
}) {
    return renderBrandedEmail({
        title: `Welcome to ${input.projectName}, ${input.inviteeName}`,
        preheader: `You're now a ${input.role} on ${input.projectName}.`,
        badge: 'Welcome',
        bodyHtml: `
      <p style="margin:0 0 12px 0;">You've accepted the invitation from <strong>${escape(input.inviterName)}</strong> and are now a <strong>${escape(input.role)}</strong> on <strong>${escape(input.projectName)}</strong>.</p>
      <p style="margin:0 0 12px 0;">Jump into the dashboard to start collaborating — your team can assign you tasks, start chats, and grant more permissions as needed.</p>
    `,
        primaryCta: { label: 'Open dashboard', href: input.dashboardUrl },
        footnote: 'If you have questions, reply to this email to reach your workspace admins.',
    });
}

export function renderRoleChangedEmail(input: {
    memberName: string;
    projectName: string;
    newRole: string;
    changedBy: string;
    dashboardUrl: string;
}) {
    return renderBrandedEmail({
        title: `Your role on ${input.projectName} changed`,
        preheader: `You're now a ${input.newRole} on ${input.projectName}.`,
        badge: 'Role updated',
        bodyHtml: `
      <p style="margin:0 0 12px 0;">${escape(input.changedBy)} updated your role on <strong>${escape(input.projectName)}</strong>.</p>
      <p style="margin:0 0 12px 0;">You're now a <strong>${escape(input.newRole)}</strong>. Permissions may have changed — open the dashboard to review what you can access.</p>
    `,
        primaryCta: { label: 'Open dashboard', href: input.dashboardUrl },
    });
}
