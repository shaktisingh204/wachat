#!/usr/bin/env node
/**
 * SabNode cron worker.
 * Started by PM2; uses node-cron to schedule jobs that hit /api/cron/[job]
 * on the main Next.js app.
 */
import cron from 'node-cron';

const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';
const TOKEN = process.env.CRON_SECRET;

if (!TOKEN) {
  console.error('[cron-worker] CRON_SECRET not set, exiting.');
  process.exit(1);
}

const JOBS = [
  { name: 'recurring-invoices', schedule: '*/15 * * * *' },
  { name: 'recurring-events', schedule: '*/15 * * * *' },
  { name: 'recurring-tasks', schedule: '*/15 * * * *' },
  { name: 'recurring-expenses', schedule: '0 0 * * *' },
  { name: 'shift-rotation', schedule: '0 1 * * *' },
  { name: 'auto-clock-out', schedule: '*/30 * * * *' },
  { name: 'follow-up-reminders', schedule: '0 9 * * *' },
  { name: 'visa-passport-expiry-alerts', schedule: '0 9 * * *' },
  { name: 'estimate-contract-expiry', schedule: '0 9 * * *' },
  { name: 'exchange-rate-update', schedule: '0 6 * * *' },
  { name: 'imap-tickets', schedule: '*/5 * * * *' },
  { name: 'database-backup-retention', schedule: '0 3 * * *' },
];

async function runJob(name) {
  const url = `${BASE_URL}/api/cron/${name}?token=${TOKEN}`;
  const start = Date.now();
  try {
    const res = await fetch(url);
    const text = await res.text();
    console.log(`[cron-worker] ${new Date().toISOString()} ${name} → ${res.status} in ${Date.now() - start}ms`);
    if (res.status >= 400) console.error(`[cron-worker] ${name} body: ${text}`);
  } catch (err) {
    console.error(`[cron-worker] ${name} error:`, err);
  }
}

for (const job of JOBS) {
  cron.schedule(job.schedule, () => runJob(job.name), { scheduled: true, timezone: process.env.TZ || 'UTC' });
  console.log(`[cron-worker] Scheduled ${job.name} on "${job.schedule}"`);
}

console.log(`[cron-worker] Ready. Base URL: ${BASE_URL}`);
process.on('SIGTERM', () => { console.log('[cron-worker] SIGTERM, exiting.'); process.exit(0); });
