/**
 * SabFlow failure alerting.
 *
 * Fires when an execution finishes with `status === 'error'`.  Two channels:
 *
 *   - Email — uses the existing nodemailer integration; falls back to the
 *     workspace SMTP env (`SMTP_HOST` / `SMTP_USER` / `SMTP_PASS`).
 *   - Slack — POST to an incoming-webhook URL with a compact text block.
 *
 * Best-effort: every dispatch is wrapped in try/catch so a flaky SMTP host
 * or Slack outage never bubbles up to the engine.  Throttling is in-memory
 * (per-flow Map of `lastAlertAt`) so a stuck flow can't paper over the
 * inbox.
 *
 * Server-only — imports nodemailer transitively via integrations/sendEmail.
 */

import type {
  ExecutionHistoryEntry,
  FlowNotificationSettings,
  SabFlowDoc,
} from '@/lib/sabflow/types';

/* ── State ──────────────────────────────────────────────────────────────── */

const lastAlertAt = new Map<string, number>();

/* ── Public API ─────────────────────────────────────────────────────────── */

export type AlertResult = {
  emailSent: boolean;
  slackSent: boolean;
  throttled: boolean;
  errors: string[];
};

/**
 * Send the failure alert for a freshly-failed execution.  Caller passes
 * the flow's notification settings; this module decides whether each
 * channel fires.
 *
 * Safe to await from inside the execution-finalisation path — never throws.
 */
export async function sendFailureAlert(
  flow: SabFlowDoc,
  execution: ExecutionHistoryEntry,
  settings: FlowNotificationSettings | undefined,
): Promise<AlertResult> {
  const result: AlertResult = {
    emailSent: false,
    slackSent: false,
    throttled: false,
    errors: [],
  };

  if (!settings?.alertOnFailure) return result;
  if (execution.status !== 'error') return result;

  /* Throttle check */
  const cooldownMs = Math.max(
    0,
    (settings.failureAlertCooldownMinutes ?? 5) * 60 * 1000,
  );
  const flowKey = execution.flowId;
  const lastAt = lastAlertAt.get(flowKey) ?? 0;
  if (cooldownMs > 0 && Date.now() - lastAt < cooldownMs) {
    result.throttled = true;
    return result;
  }
  lastAlertAt.set(flowKey, Date.now());

  /* Channel: email */
  const recipients =
    (settings.failureEmailAddresses ?? []).length > 0
      ? settings.failureEmailAddresses!
      : settings.emailAddresses ?? [];
  if (recipients.length > 0) {
    try {
      await sendFailureEmail(recipients, flow, execution);
      result.emailSent = true;
    } catch (e) {
      result.errors.push(
        `email: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  /* Channel: Slack */
  if (settings.failureSlackWebhook) {
    try {
      await postFailureSlack(settings.failureSlackWebhook, flow, execution);
      result.slackSent = true;
    } catch (e) {
      result.errors.push(
        `slack: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  return result;
}

/** Reset the in-memory throttle.  Tests / hot-reload only. */
export function resetAlertThrottle(flowId?: string): void {
  if (flowId === undefined) {
    lastAlertAt.clear();
    return;
  }
  lastAlertAt.delete(flowId);
}

/* ── Channel implementations ────────────────────────────────────────────── */

async function sendFailureEmail(
  recipients: string[],
  flow: SabFlowDoc,
  execution: ExecutionHistoryEntry,
): Promise<void> {
  // Dynamic import keeps this module browser-safe at type-check time.  The
  // runtime path is server-only — nodemailer is a Node dependency.
  const nodemailer = await import('nodemailer');

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    throw new Error(
      'SMTP credentials missing — set SMTP_HOST, SMTP_USER, SMTP_PASS to enable failure emails.',
    );
  }

  const subject = `[SabFlow] "${flow.name}" failed`;
  const text =
    `Flow:        ${flow.name}\n` +
    `Flow ID:     ${flow._id?.toString?.() ?? '(unknown)'}\n` +
    `Execution:   ${execution.id}\n` +
    `Started at:  ${formatTimestamp(execution.startedAt)}\n` +
    `Finished at: ${formatTimestamp(execution.finishedAt)}\n` +
    `Trigger:     ${execution.triggerMode}\n` +
    `Nodes:       ${execution.nodeCount}\n` +
    `\nError:\n${execution.error ?? '(no error message)'}\n`;
  const html =
    `<p>Flow <strong>${escapeHtml(flow.name)}</strong> failed.</p>` +
    `<table cellpadding="4" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;font-size:13px;">` +
    `<tr><td><b>Execution</b></td><td><code>${escapeHtml(execution.id)}</code></td></tr>` +
    `<tr><td><b>Trigger</b></td><td>${escapeHtml(execution.triggerMode ?? '—')}</td></tr>` +
    `<tr><td><b>Started</b></td><td>${escapeHtml(formatTimestamp(execution.startedAt))}</td></tr>` +
    `<tr><td><b>Finished</b></td><td>${escapeHtml(formatTimestamp(execution.finishedAt))}</td></tr>` +
    `<tr><td><b>Nodes</b></td><td>${execution.nodeCount}</td></tr>` +
    `</table>` +
    `<p><b>Error</b></p><pre style="background:#f4f4f5;padding:8px;border-radius:6px;">${escapeHtml(
      execution.error ?? '(no error message)',
    )}</pre>`;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  await transporter.sendMail({
    from: user,
    to: recipients.join(','),
    subject,
    text,
    html,
  });
}

async function postFailureSlack(
  webhookUrl: string,
  flow: SabFlowDoc,
  execution: ExecutionHistoryEntry,
): Promise<void> {
  const body = {
    text: `:rotating_light: SabFlow failure — *${flow.name}*`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:rotating_light: *${flow.name}* failed`,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Execution*\n\`${execution.id}\`` },
          { type: 'mrkdwn', text: `*Trigger*\n${execution.triggerMode ?? '—'}` },
          {
            type: 'mrkdwn',
            text: `*Started*\n${formatTimestamp(execution.startedAt)}`,
          },
          { type: 'mrkdwn', text: `*Nodes*\n${execution.nodeCount}` },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Error*\n\`\`\`${truncate(execution.error ?? '(no error message)', 800)}\`\`\``,
        },
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Slack webhook ${res.status}: ${text.slice(0, 200)}`);
  }
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

function formatTimestamp(d: Date | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d).toISOString();
  } catch {
    return '—';
  }
}

function truncate(s: string, max: number): string {
  if (!s) return '';
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
