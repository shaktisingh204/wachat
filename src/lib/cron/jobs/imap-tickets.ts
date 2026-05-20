/**
 * Cron job — IMAP inbox polling.
 *
 * Schedule: every 5 minutes (registered by the cron orchestrator; this
 * file only declares the job body).
 *
 * Each run iterates every tenant's `crm_ticket_email_settings` row,
 * pulls unread emails, and creates one `crm_tickets` row per message.
 * See `src/lib/integrations/imap-tickets.ts` for the protocol-level
 * details and the (documented) `imapflow` install requirement.
 */
import { pollImapInbox } from '@/lib/integrations/imap-tickets';
import type { CronJobErrorEntry, CronJobResult } from '../types';
import { jobStart, pushError } from '../utils';

export default async function runImapTickets(): Promise<CronJobResult> {
  const { startedAt, log } = jobStart('imap-tickets');
  const errors: CronJobErrorEntry[] = [];
  let processed = 0;
  const details: Record<string, unknown> = {};

  try {
    const res = await pollImapInbox();
    processed = res.processed;
    details.inboxesPolled = res.inboxesPolled;
    details.ticketsCreated = res.ticketsCreated;
    for (const e of res.errors) {
      pushError(errors, new Error(e));
    }
    log('done', {
      processed,
      ticketsCreated: res.ticketsCreated,
      errors: errors.length,
    });
  } catch (err) {
    pushError(errors, err);
    log('failed', { message: (err as Error).message });
  }

  return {
    processed,
    errors,
    durationMs: Date.now() - startedAt.getTime(),
    details,
  };
}
