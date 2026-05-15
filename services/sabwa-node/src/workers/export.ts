/**
 * Export worker.
 *
 * Drains `sabwa_exports` rows whose status is `queued`, streams matching
 * messages out of `sabwa_messages`, serialises them in the requested format,
 * writes the artifact to disk under `EXPORTS_DIR` (env, default
 * `./tmp/exports`), and updates the row with `status: 'ready'` plus a
 * `downloadUrl` pointing at the static-file route.
 *
 * The route handler also publishes `sabwa:exports:ping` on Redis so this
 * worker doesn't have to wait on the 2s polling tick for fresh jobs.
 *
 * The worker is intentionally minimal: PDF rendering falls back to a plain
 * text representation (real PDF generation will land alongside the SabFiles
 * agent that owns artifact uploads). JSON/CSV/TXT are first-class.
 */

import { Buffer } from 'node:buffer';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import type { AppState } from '../state.js';
import * as exports from '../db/exports.js';

const POLL_INTERVAL_MS = 2_000;
const EXPORTS_DIR = process.env.EXPORTS_DIR ?? path.resolve(process.cwd(), 'tmp/exports');
// `EXPORTS_PUBLIC_BASE` is prepended to the file path to form a download
// URL. Defaults to a local path the caller can serve via Nginx / a static
// route in front of the worker host.
const EXPORTS_PUBLIC_BASE = process.env.EXPORTS_PUBLIC_BASE ?? '/static/exports';

export function startExportWorker(state: AppState): () => Promise<void> {
  let stopped = false;
  let inflight: Promise<void> = Promise.resolve();

  // Listen for new-job pings so we can run immediately instead of waiting.
  const pingHandler = (): void => {
    // Fire-and-forget — the main loop ticks anyway, this just nudges it.
    runDrain(state).catch((err) => state.log.error({ err }, 'export ping drain failed'));
  };
  state.redis.sub
    .subscribe('sabwa:exports:ping', pingHandler)
    .catch((err) => state.log.warn({ err }, 'export ping subscribe failed'));

  const loop = async (): Promise<void> => {
    while (!stopped) {
      try {
        await runDrain(state);
      } catch (err) {
        state.log.error({ err }, 'export drain failed');
      }
      await sleep(POLL_INTERVAL_MS);
    }
  };

  inflight = loop();

  return async (): Promise<void> => {
    stopped = true;
    await state.redis.sub.unsubscribe('sabwa:exports:ping').catch(() => undefined);
    await inflight;
  };
}

async function runDrain(state: AppState): Promise<void> {
  // Atomically claim queued rows one at a time until the queue empties or a
  // claim returns null.
  while (true) {
    const job = await exports.takeNextQueued(state.db);
    if (!job) return;
    try {
      await runJob(state, job);
    } catch (err) {
      state.log.error({ err, id: job._id }, 'export job failed');
      await exports.setStatus(state.db, job._id, 'failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

async function runJob(state: AppState, job: exports.ExportDoc): Promise<void> {
  await fs.mkdir(EXPORTS_DIR, { recursive: true });

  const filter = buildMessageFilter(job);
  const messages = state.db.collection('sabwa_messages');
  const cursor = messages.find(filter).sort({ ts: 1 });

  const ext = job.format === 'pdf' ? 'pdf' : job.format;
  const fileName = `${job._id}.${ext}`;
  const filePath = path.join(EXPORTS_DIR, fileName);
  const handle = await fs.open(filePath, 'w');
  let bytes = 0;

  try {
    if (job.format === 'json') {
      await handle.write('[\n');
      bytes += 2;
      let first = true;
      for await (const row of cursor) {
        const chunk = (first ? '' : ',\n') + JSON.stringify(row);
        const buf = Buffer.from(chunk, 'utf8');
        await handle.write(buf);
        bytes += buf.length;
        first = false;
      }
      const tail = '\n]\n';
      await handle.write(tail);
      bytes += Buffer.byteLength(tail, 'utf8');
    } else if (job.format === 'csv') {
      const header = 'ts,chatJid,fromJid,fromMe,type,body\n';
      const headerBuf = Buffer.from(header, 'utf8');
      await handle.write(headerBuf);
      bytes += headerBuf.length;
      for await (const row of cursor) {
        const line = [
          escapeCsv((row.ts as Date | undefined)?.toISOString?.() ?? ''),
          escapeCsv(String(row.chatJid ?? '')),
          escapeCsv(String(row.fromJid ?? '')),
          row.fromMe ? '1' : '0',
          escapeCsv(String(row.type ?? '')),
          escapeCsv(String(row.body ?? '')),
        ].join(',');
        const buf = Buffer.from(line + '\n', 'utf8');
        await handle.write(buf);
        bytes += buf.length;
      }
    } else if (job.format === 'txt' || job.format === 'pdf') {
      // PDF currently degrades to plain text — a proper PDF renderer (e.g.
      // PDFKit) lands in the SabFiles-aware agent that owns artifact uploads.
      for await (const row of cursor) {
        const ts = (row.ts as Date | undefined)?.toISOString?.() ?? '';
        const dir = row.fromMe ? '→' : '←';
        const line = `[${ts}] ${dir} ${row.chatJid ?? ''}: ${row.body ?? ''}\n`;
        const buf = Buffer.from(line, 'utf8');
        await handle.write(buf);
        bytes += buf.length;
      }
    }
  } finally {
    await handle.close();
  }

  // Default retention: 7 days.
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const downloadUrl = `${EXPORTS_PUBLIC_BASE}/${encodeURIComponent(fileName)}`;
  await exports.setStatus(state.db, job._id, 'ready', {
    sizeBytes: bytes,
    downloadUrl,
    expiresAt,
  });
  state.log.info({ id: job._id, bytes, format: job.format }, 'export ready');
}

function buildMessageFilter(job: exports.ExportDoc): Record<string, unknown> {
  const base: Record<string, unknown> = { sessionId: job.sessionId };
  if (job.scope.kind === 'chats' && job.scope.jids && job.scope.jids.length > 0) {
    base.chatJid = { $in: job.scope.jids };
  }
  if (job.scope.kind === 'date_range') {
    const range: Record<string, unknown> = {};
    if (job.scope.from) range.$gte = job.scope.from;
    if (job.scope.to) range.$lte = job.scope.to;
    if (Object.keys(range).length > 0) base.ts = range;
  }
  return base;
}

function escapeCsv(value: string): string {
  if (value === '') return '';
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
