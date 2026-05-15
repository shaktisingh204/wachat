/**
 * Pino logger for sabwa-node.
 *
 * Uses `pino-pretty` for human-readable output in development (when stdout is
 * a TTY) and falls back to structured JSON in production so logs flow cleanly
 * into PM2 / log shippers. Mirrors the structured logging the Rust engine
 * produced via `tracing`.
 */

import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';
const level = process.env.LOG_LEVEL ?? 'info';

export const log = pino({
  level,
  base: { svc: 'sabwa-node' },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport:
    !isProduction && process.stdout.isTTY
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss.l',
            ignore: 'pid,hostname,svc',
          },
        }
      : undefined,
});

export type Logger = typeof log;
