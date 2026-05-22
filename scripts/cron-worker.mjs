#!/usr/bin/env node
/**
 * SabNode Master Cron Worker.
 * Scheduled via PM2; uses node-cron to trigger all standalone, Vercel-configured,
 * and dynamic /api/cron/* endpoints on the main Next.js web application.
 */
import cron from 'node-cron';

const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';
const TOKEN = process.env.CRON_SECRET;

if (!TOKEN) {
  console.error('[cron-worker] CRON_SECRET is not configured. Exiting.');
  process.exit(1);
}

// Complete registry of all standalone and dynamic cron jobs across the codebase
const JOBS = [
  // ─── Standalone & Vercel Cron Endpoints ───
  { name: 'webhook-dispatcher', path: '/api/cron/webhook-dispatcher', schedule: '* * * * *' },
  { name: 'sabflow-scheduled', path: '/api/cron/sabflow-scheduled', schedule: '* * * * *' },
  { name: 'send-broadcasts', path: '/api/cron/send-broadcasts', schedule: '* * * * *' },
  { name: 'send-scheduled-emails', path: '/api/cron/send-scheduled-emails', schedule: '* * * * *' },
  { name: 'process-webhooks', path: '/api/cron/process-webhooks', schedule: '*/5 * * * *' },
  { name: 'sla-breach-check', path: '/api/cron/sla-breach-check', schedule: '*/5 * * * *' },
  { name: 'qr-scan-notify', path: '/api/cron/qr-scan-notify', schedule: '*/5 * * * *' },
  { name: 'link-scheduler', path: '/api/cron/link-scheduler', schedule: '*/15 * * * *' },
  { name: 'abandoned-cart-reminder', path: '/api/cron/abandoned-cart-reminder', schedule: '*/15 * * * *' },
  { name: 'sync-local-templates', path: '/api/cron/sync-local-templates', schedule: '*/15 * * * *' },
  { name: 'post-randomizer', path: '/api/cron/post-randomizer', schedule: '0 * * * *' },
  { name: 'reports-scheduler', path: '/api/cron/reports-scheduler?execute=1', schedule: '0 * * * *' },
  { name: 'cleanup', path: '/api/cron/cleanup', schedule: '0 * * * *' },
  { name: 'subscriptions-daily', path: '/api/cron/subscriptions-daily', schedule: '0 2 * * *' },
  { name: 'sabflow-executions-retention', path: '/api/cron/sabflow-executions-retention', schedule: '0 2 * * *' },
  { name: 'audit-retention', path: '/api/cron/audit-retention?execute=1', schedule: '0 3 * * *' },
  { name: 'delete-failed-templates', path: '/api/cron/delete-failed-templates', schedule: '0 4 * * *' },
  { name: 'sabflow-gc', path: '/api/cron/sabflow-gc', schedule: '0 */6 * * *' },
  { name: 'url-health', path: '/api/cron/url-health', schedule: '0 */6 * * *' },
  { name: 'msme-45-day-check', path: '/api/cron/msme-45-day-check?execute=1', schedule: '0 6 * * *' },

  // ─── Dynamic Job Router Endpoints (/api/cron/[job]) ───
  { name: 'recurring-invoices', path: '/api/cron/recurring-invoices', schedule: '*/15 * * * *' },
  { name: 'recurring-events', path: '/api/cron/recurring-events', schedule: '*/15 * * * *' },
  { name: 'recurring-tasks', path: '/api/cron/recurring-tasks', schedule: '*/15 * * * *' },
  { name: 'recurring-expenses', path: '/api/cron/recurring-expenses', schedule: '0 0 * * *' },
  { name: 'shift-rotation', path: '/api/cron/shift-rotation', schedule: '0 1 * * *' },
  { name: 'auto-clock-out', path: '/api/cron/auto-clock-out', schedule: '*/30 * * * *' },
  { name: 'follow-up-reminders', path: '/api/cron/follow-up-reminders', schedule: '0 9 * * *' },
  { name: 'visa-passport-expiry-alerts', path: '/api/cron/visa-passport-expiry-alerts', schedule: '0 9 * * *' },
  { name: 'estimate-contract-expiry', path: '/api/cron/estimate-contract-expiry', schedule: '0 9 * * *' },
  { name: 'exchange-rate-update', path: '/api/cron/exchange-rate-update', schedule: '0 6 * * *' },
  { name: 'imap-tickets', path: '/api/cron/imap-tickets', schedule: '*/5 * * * *' },
  { name: 'database-backup-retention', path: '/api/cron/database-backup-retention', schedule: '0 3 * * *' },
];

/**
 * Triggers a cron job route on the web application using multiple authentication
 * formats for complete compatibility.
 * @param {typeof JOBS[0]} job 
 */
async function runJob(job) {
  const urlObj = new URL(job.path, BASE_URL);
  
  // Attach token parameter (compatible with dynamic job router and simple URL parsers)
  urlObj.searchParams.set('token', TOKEN);
  
  const url = urlObj.toString();
  const start = Date.now();
  
  try {
    const headers = {
      'Authorization': `Bearer ${TOKEN}`, // Compatible with standard Vercel crons & SLA
      'x-cron-secret': TOKEN,             // Compatible with SLA fallback & MSME
      'vercel-cron': '1',                 // Compatible with SabFlow scheduled / retention fallback
      'User-Agent': 'SabNode-MasterCronWorker/1.0',
    };
    
    const res = await fetch(url, {
      method: 'GET',
      headers,
    });
    
    const text = await res.text();
    const duration = Date.now() - start;
    
    if (res.ok) {
      console.log(`[cron-worker] [SUCCESS] ${new Date().toISOString()} ${job.name} (HTTP ${res.status}) in ${duration}ms`);
    } else {
      console.error(`[cron-worker] [WARNING] ${new Date().toISOString()} ${job.name} (HTTP ${res.status}) in ${duration}ms. Response: ${text.slice(0, 500)}`);
    }
  } catch (err) {
    const duration = Date.now() - start;
    console.error(`[cron-worker] [FAILURE] ${new Date().toISOString()} ${job.name} failed in ${duration}ms. Error:`, err.message || err);
  }
}

// Register all cron jobs
for (const job of JOBS) {
  cron.schedule(job.schedule, () => runJob(job), {
    scheduled: true,
    timezone: process.env.TZ || 'UTC',
  });
  console.log(`[cron-worker] Scheduled ${job.name} on "${job.schedule}" to path "${job.path}"`);
}

console.log(`[cron-worker] Master Cron Worker initialized. Base URL: ${BASE_URL}. Total registered jobs: ${JOBS.length}`);

// Handle graceful termination
process.on('SIGTERM', () => {
  console.log('[cron-worker] SIGTERM received. Shutting down gracefully.');
  process.exit(0);
});
process.on('SIGINT', () => {
  console.log('[cron-worker] SIGINT received. Shutting down gracefully.');
  process.exit(0);
});
