/**
 * PM2 process definitions for the SabCRM engine (vendored Twenty stack).
 *
 * Two long-running processes:
 *   - sabcrm-server : NestJS API on port 4300 (also serves the built SPA)
 *   - sabcrm-worker : BullMQ background worker
 *
 * Secrets (PG_DATABASE_URL, REDIS_URL, APP_SECRET, FRONTEND_URL, …) are
 * loaded by Twenty from `packages/twenty-server/.env`; only process-level
 * overrides live here. Runs the yarn prod scripts so the entry paths stay
 * owned by Twenty (`start:prod` = `node dist/main`,
 * `worker:prod` = `node dist/queue-worker/queue-worker`).
 *
 * Requires corepack-provisioned yarn 4 on PATH (see deploy.sh).
 * Mirrors `services/sabwa-node/ecosystem.config.js`.
 */
const SERVER_DIR = '/var/www/sabnode/services/sabcrm/packages/twenty-server';

module.exports = {
  apps: [
    {
      name: 'sabcrm-server',
      script: 'yarn',
      args: 'start:prod',
      interpreter: 'none',
      cwd: SERVER_DIR,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '1500M',
      env: {
        NODE_ENV: 'production',
        // Remapped off :3000 so it never collides with the Next.js app.
        PORT: 4300,
      },
    },
    {
      name: 'sabcrm-worker',
      script: 'yarn',
      args: 'worker:prod',
      interpreter: 'none',
      cwd: SERVER_DIR,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '1500M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
