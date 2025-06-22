
import { processBroadcastJob } from '@/lib/cron-scheduler';

export async function register() {
  // The worker should only run in a Node.js environment, not on the edge.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const cron = require('node-cron');
    
    console.log('Starting high-frequency broadcast scheduler...');
    
    // Schedule to run every second to check for new jobs.
    // This allows for high throughput as it can pick up a new job as soon as the previous one is done.
    cron.schedule('* * * * * *', () => {
      // We don't await this because we don't want to block the scheduler tick.
      // If a job takes longer than a second, the next tick will simply find no 'QUEUED' job
      // and do nothing, which is the desired behavior.
      processBroadcastJob().catch(error => {
        // A failure in one job shouldn't stop the entire scheduler.
        console.error('Error in scheduled broadcast job:', error.message);
      });
    });
    
    console.log('High-frequency broadcast scheduler is running.');
  }
}
