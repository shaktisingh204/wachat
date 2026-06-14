// PM2 manifest for the SabFlow WebSocket gateway.
//
// Follows the standard sidecar shape in the repo-root
// ecosystem.config.js: run the built artefact directly with the `node`
// interpreter, fork mode, single instance, env-passthrough.
//
// WS state for v0 is in-process (no Redis adapter yet), so `instances: 1`
// is a hard requirement — do NOT raise without first wiring a pub/sub
// adapter into the sibling #1 server bootstrap.
//
// Build before reload:
//   cd services/sabflow-ws && npm run build
//   pm2 reload ecosystem.config.js --update-env

require('dotenv').config();

module.exports = {
  apps: [
    {
      name: 'sabflow-ws',
      cwd: './services/sabflow-ws',

      // Run the compiled artefact — sibling #1's tsc target is dist/index.js.
      script: 'dist/index.js',
      interpreter: 'node',

      instances: 1,
      exec_mode: 'fork',

      watch: false,
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 20,
      kill_timeout: 10000,
      max_memory_restart: '512M',

      // Log file conventions follow the standard PM2 defaults (under
      // ~/.pm2/logs/<app>-out.log + <app>-error.log). Pin them explicitly so
      // ops scripts can grep a stable path.
      out_file: './logs/sabflow-ws-out.log',
      error_file: './logs/sabflow-ws-error.log',
      merge_logs: true,
      time: true,

      env: {
        NODE_ENV: 'production',
        SABFLOW_WS_PORT: process.env.SABFLOW_WS_PORT || '4002',
        SABFLOW_WS_JWT_SECRET: process.env.SABFLOW_WS_JWT_SECRET,
        REDIS_URL: process.env.REDIS_URL,
        OTLP_ENDPOINT: process.env.OTLP_ENDPOINT || '',
      },
    },
  ],
};
