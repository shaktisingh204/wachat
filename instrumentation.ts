
/**
 * This file is used to run code on server startup.
 * It sets up a high-frequency internal scheduler to process broadcast jobs.
 * This replaces the need for an external cron job service.
 */
import { processBroadcastJob } from '@/lib/cron-scheduler';

export async function register() {
  // The worker should only run in a Node.js environment, not on the edge, and only in production.
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'production') {
    console.log('Starting internal broadcast scheduler...');

    // This creates a persistent worker that constantly checks for new jobs.
    // It's designed for a long-running server environment (`next start`).
    const worker = async () => {
      // This loop runs indefinitely.
      while (true) {
        try {
          // processBroadcastJob finds and processes one job from the queue.
          const result = await processBroadcastJob();

          // If no job was found, pause for a second to prevent the loop
          // from consuming CPU resources unnecessarily while idle.
          if (result && result.message && result.message.includes('No queued broadcasts')) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          }
          // If a job was processed, the loop continues immediately to check for the next one.
        } catch (error) {
          console.error('Error in broadcast worker loop:', error);
          // In case of a failure, wait for 5 seconds before retrying to avoid spamming errors.
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    };

    // Start the single, persistent worker.
    worker();
    
    console.log('Internal broadcast scheduler is running.');
  }
}
