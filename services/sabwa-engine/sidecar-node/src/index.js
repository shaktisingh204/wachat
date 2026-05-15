#!/usr/bin/env node
// @ts-check
/**
 * sabwa-baileys-sidecar — entry point.
 *
 * Long-lived Node.js process spawned by the Rust `sabwa-engine` parent.
 * Speaks newline-delimited JSON-RPC over stdin/stdout. All logging goes to
 * stderr so the protocol stream stays clean.
 *
 * Usage (debug):
 *   node src/index.js
 *
 * Then paste a JSON-RPC request (one per line), e.g.:
 *   {"id":"1","method":"pair","params":{"sessionId":"s1","method":"qr"}}
 */

import pino from 'pino';

import * as createGroup from './handlers/createGroup.js';
import * as addParticipants from './handlers/addParticipants.js';
import * as demoteAdmin from './handlers/demoteAdmin.js';
import * as getInviteCode from './handlers/getInviteCode.js';
import * as getStatus from './handlers/getStatus.js';
import * as logout from './handlers/logout.js';
import * as markRead from './handlers/markRead.js';
import * as pair from './handlers/pair.js';
import * as promoteAdmin from './handlers/promoteAdmin.js';
import * as removeParticipants from './handlers/removeParticipants.js';
import * as resume from './handlers/resume.js';
import * as revokeInviteCode from './handlers/revokeInviteCode.js';
import * as send from './handlers/send.js';
import * as setPresence from './handlers/setPresence.js';
import * as updateGroupSubject from './handlers/updateGroupSubject.js';
import { readRequests, writeResponse } from './protocol.js';
import { SessionManager } from './session-manager.js';

// stderr-only logger — stdout is reserved for protocol traffic.
const logger = pino(
  { level: process.env.SABWA_SIDECAR_LOG_LEVEL ?? 'info', name: 'sabwa-sidecar' },
  pino.destination(2),
);

const manager = new SessionManager({ logger });

/** @type {Record<string, (sm: SessionManager, params: unknown) => Promise<unknown>>} */
const handlers = {
  pair: pair.handle,
  resume: resume.handle,
  send: send.handle,
  markRead: markRead.handle,
  logout: logout.handle,
  getStatus: getStatus.handle,
  createGroup: createGroup.handle,
  addParticipants: addParticipants.handle,
  removeParticipants: removeParticipants.handle,
  promoteAdmin: promoteAdmin.handle,
  demoteAdmin: demoteAdmin.handle,
  updateGroupSubject: updateGroupSubject.handle,
  getInviteCode: getInviteCode.handle,
  revokeInviteCode: revokeInviteCode.handle,
  setPresence: setPresence.handle,
};

logger.info(
  { methods: Object.keys(handlers) },
  'sabwa-baileys-sidecar started, awaiting JSON-RPC on stdin',
);

readRequests(process.stdin, async (raw) => {
  if (!raw || typeof raw !== 'object') {
    logger.warn({ raw }, 'ignoring non-object request');
    return;
  }
  const req = /** @type {{ id?: string, method?: string, params?: unknown }} */ (raw);
  const id = typeof req.id === 'string' ? req.id : null;
  const method = typeof req.method === 'string' ? req.method : null;

  if (!id) {
    logger.warn({ req }, 'request missing id, dropping');
    return;
  }
  if (!method || !(method in handlers)) {
    writeResponse({ id, ok: false, error: `unknown method: ${method ?? '<missing>'}` });
    return;
  }

  try {
    const result = await handlers[method](manager, req.params ?? {});
    writeResponse({ id, ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ err, method }, 'handler error');
    writeResponse({ id, ok: false, error: message });
  }
});

// Make the sidecar exit cleanly when the parent closes our stdin.
process.stdin.on('end', () => {
  logger.info('stdin closed by parent, exiting');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, exiting');
  process.exit(0);
});
process.on('SIGINT', () => {
  logger.info('SIGINT received, exiting');
  process.exit(0);
});
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'uncaughtException');
});
process.on('unhandledRejection', (err) => {
  logger.error({ err }, 'unhandledRejection');
});
