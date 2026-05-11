import type { IntegrationResult, ResolvedOptions, Credential } from './types';

export async function executeSendEmail(
  options: ResolvedOptions,
  credential?: Credential,
): Promise<IntegrationResult> {
  const nodemailer = await import('nodemailer');

  const host = credential?.host ?? (options.host as string) ?? 'smtp.gmail.com';
  const port = Number(credential?.port ?? options.port ?? 587);
  const user = credential?.user ?? (options.from as string) ?? '';
  const pass = credential?.pass ?? (options.password as string) ?? '';

  const to = options.to as string;
  const subject = (options.subject as string) ?? '(no subject)';
  const text = (options.text as string) ?? '';
  const html = options.html as string | undefined;

  if (!to) return { error: 'send_email: "to" is required' };
  if (!user) return { error: 'send_email: sender credentials are required' };

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    const info = await transporter.sendMail({ from: user, to, subject, text, html });
    return {
      outputs: { messageId: info.messageId, accepted: (info.accepted as string[]).join(',') },
      logs: [`Email sent to ${to}: ${info.messageId}`],
    };
  } catch (err) {
    return { error: `send_email failed: ${(err as Error).message}` };
  }
}
