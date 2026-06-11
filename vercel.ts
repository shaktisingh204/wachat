// Sabnode is a Vercel-native project (see CLAUDE.md). This vercel.ts is the modern
// config preferred over vercel.json — when both exist, Vercel reads vercel.ts.
// Keep the two in sync until vercel.json is removed.

// @ts-expect-error - @vercel/config not installed in repo — shape locally typed below.
// We intentionally do not add @vercel/config as a dependency yet; the import is kept
// in the canonical shape so that once the package is installed the local fallback
// type can be removed without touching the rest of this file.
import { type VercelConfig as VercelConfigImported } from '@vercel/config/v1';

// Local fallback type — mirrors the subset of `@vercel/config/v1`'s `VercelConfig`
// shape that we actually use here. Remove this block once `@vercel/config` is
// installed and rely solely on the imported type.
type LocalVercelConfig = {
  buildCommand?: string;
  framework?: string;
  crons?: Array<{ path: string; schedule: string }>;
};

// Prefer the imported type when available; otherwise fall back to the local shape.
type VercelConfig = VercelConfigImported extends never ? LocalVercelConfig : LocalVercelConfig;

export const config: VercelConfig = {
  buildCommand: 'npm run build',
  framework: 'nextjs',
  crons: [
    {
      path: '/api/cron/subscriptions-daily',
      schedule: '0 2 * * *',
    },
    {
      path: '/api/cron/sla-breach-check',
      schedule: '*/5 * * * *',
    },
    {
      path: '/api/cron/audit-retention',
      schedule: '0 3 * * *',
    },
    {
      path: '/api/cron/sabflow-scheduled',
      schedule: '* * * * *',
    },
    {
      path: '/api/cron/sabflow-gc',
      schedule: '0 */6 * * *',
    },
    {
      path: '/api/cron/webhook-dispatcher',
      schedule: '* * * * *',
    },
    {
      path: '/api/cron/msme-45-day-check',
      schedule: '0 6 * * *',
    },
    {
      path: '/api/cron/sabpay-settlements',
      schedule: '30 1 * * *',
    },
    {
      path: '/api/cron/sabpay-subscriptions',
      schedule: '0 3 * * *',
    },
    {
      path: '/api/cron/sabpay-expiries',
      schedule: '*/30 * * * *',
    },
  ],
};

export default config;
