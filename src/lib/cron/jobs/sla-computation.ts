import { connectToDatabase } from '@/lib/mongodb';
import { notifySlaBreach } from '@/lib/notifications/crm';
import type { CronJobResult, CronJobErrorEntry } from '../types';

/**
 * Background job for SLA computation.
 * Periodically checks open tickets and flags SLA breaches.
 */
export default async function run(): Promise<CronJobResult> {
  const start = Date.now();
  let processed = 0;
  const errors: CronJobErrorEntry[] = [];

  try {
    const { db } = await connectToDatabase();
    
    // Find open/pending tickets that have a dueBy date in the past and no SLA breach flag
    const now = new Date();
    
    // We only process tickets that haven't been flagged recently (or at all).
    // Assuming we use a field `slaBreachNotified` to prevent spamming.
    const overdueTickets = await db
      .collection('crm_tickets')
      .find({
        status: { $in: ['open', 'pending', 'new', 'in_progress'] },
        dueBy: { $ne: null, $lt: now.toISOString() },
        slaBreachNotified: { $ne: true }
      })
      .toArray();

    for (const ticket of overdueTickets) {
      processed++;
      try {
        const dueTime = new Date(ticket.dueBy).getTime();
        const overdueMs = Date.now() - dueTime;
        const overdueMinutes = Math.floor(overdueMs / 60000);

        // Notify
        await notifySlaBreach({
          userId: String(ticket.userId),
          ticketId: String(ticket._id),
          ticketSubject: ticket.subject || 'Untitled',
          breachType: 'resolution', // assuming resolution by default
          overdueMinutes
        });

        // Mark as notified
        await db.collection('crm_tickets').updateOne(
          { _id: ticket._id },
          { $set: { slaBreachNotified: true } }
        );
      } catch (err) {
        errors.push({
          ref: String(ticket._id),
          message: err instanceof Error ? err.message : 'Unknown SLA processing error'
        });
      }
    }

  } catch (err) {
    errors.push({
      message: err instanceof Error ? err.message : 'Failed to connect to DB for SLA computation'
    });
  }

  return {
    processed,
    errors,
    durationMs: Date.now() - start
  };
}
