/**
 * This file is used to run code on server startup.
 * We are using it to initialize our node-cron scheduler.
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startScheduler } = await import('./src/lib/cron-scheduler');
    startScheduler();
  }
}
