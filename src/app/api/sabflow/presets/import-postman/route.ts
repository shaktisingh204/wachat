/**
 * SabFlow — Postman Collection v2.1 importer route (SERVER ONLY).
 *
 *   POST /api/sabflow/presets/import-postman
 *     body: { collection: object | string }    // JSON object or URL to fetch
 *         | { collectionRaw: string }          // raw JSON text
 *         + { id?: string, dryRun?: boolean }  // overrides
 *
 *   → 200 { ok: true, preset: AppPreset, written: boolean, path?: string }
 *   → 400 { ok: false, error: string }
 *   → 409 { ok: false, error: 'preset already exists', existingId: string }
 *
 * Companion: `SABFLOW_1000_APPS_PLAN.md` §4 (source 2) + §8 acceptance.
 */
import 'server-only';

import { writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';

import { NextResponse } from 'next/server';

import {
  postmanToPreset,
  type PostmanCollection,
} from '@/lib/sabflow/app-presets/importers/postman';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const PRESET_DIR = resolve(process.cwd(), 'src/lib/sabflow/app-presets');

type ImportBody = {
  collection?: unknown;
  collectionRaw?: unknown;
  id?: unknown;
  dryRun?: unknown;
};

function fail(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error, ...(extra ?? {}) }, { status });
}

function isPostmanV2Schema(schema: unknown): boolean {
  if (typeof schema !== 'string') return false;
  return schema.includes('v2.1.0') || schema.includes('v2.0.0');
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function loadCollection(
  body: ImportBody,
): Promise<
  | { ok: true; collection: PostmanCollection }
  | { ok: false; status: number; error: string }
> {
  // 1) Raw JSON text.
  if (typeof body.collectionRaw === 'string') {
    const raw = body.collectionRaw;
    if (raw.length > MAX_BYTES) {
      return { ok: false, status: 413, error: 'collection exceeds 10 MB limit' };
    }
    try {
      const parsed = JSON.parse(raw) as PostmanCollection;
      return { ok: true, collection: parsed };
    } catch {
      return { ok: false, status: 400, error: 'collectionRaw is not valid JSON' };
    }
  }

  // 2) `collection` as object.
  if (
    body.collection !== undefined &&
    typeof body.collection === 'object' &&
    body.collection !== null
  ) {
    const size = Buffer.byteLength(JSON.stringify(body.collection), 'utf-8');
    if (size > MAX_BYTES) {
      return { ok: false, status: 413, error: 'collection exceeds 10 MB limit' };
    }
    return { ok: true, collection: body.collection as PostmanCollection };
  }

  // 3) `collection` as URL string → fetch.
  if (typeof body.collection === 'string') {
    const url = body.collection;
    if (!/^https?:\/\//i.test(url)) {
      return {
        ok: false,
        status: 400,
        error: 'collection must be a JSON object, raw JSON via collectionRaw, or an http(s) URL',
      };
    }
    let res: Response;
    try {
      res = await fetch(url, { method: 'GET' });
    } catch (err) {
      return {
        ok: false,
        status: 400,
        error: `failed to fetch collection: ${(err as Error).message}`,
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        status: 400,
        error: `failed to fetch collection: HTTP ${res.status}`,
      };
    }
    const text = await res.text();
    if (text.length > MAX_BYTES) {
      return { ok: false, status: 413, error: 'collection exceeds 10 MB limit' };
    }
    try {
      const parsed = JSON.parse(text) as PostmanCollection;
      return { ok: true, collection: parsed };
    } catch {
      return {
        ok: false,
        status: 400,
        error: 'fetched URL did not return valid JSON',
      };
    }
  }

  return {
    ok: false,
    status: 400,
    error: 'expected `collection` (object|url) or `collectionRaw` (string)',
  };
}

export async function POST(req: Request) {
  let body: ImportBody;
  try {
    body = (await req.json()) as ImportBody;
  } catch {
    return fail(400, 'request body must be JSON');
  }

  const loaded = await loadCollection(body);
  if (!loaded.ok) return fail(loaded.status, loaded.error);

  const collection = loaded.collection;

  // Validate Postman Collection v2.0/v2.1.
  const schema =
    collection && typeof collection === 'object'
      ? (collection as { info?: { schema?: unknown } }).info?.schema
      : undefined;
  if (!isPostmanV2Schema(schema)) {
    return fail(
      400,
      'unsupported Postman schema — only Collection v2.0.0 or v2.1.0 is accepted',
    );
  }

  // Reject if no items.
  const items = (collection as PostmanCollection).item;
  if (!Array.isArray(items) || items.length === 0) {
    return fail(400, 'collection has no items');
  }

  const overrides: { id?: string } = {};
  if (typeof body.id === 'string' && body.id.length > 0) {
    overrides.id = body.id;
  }

  let preset;
  try {
    preset = postmanToPreset(collection, overrides);
  } catch (err) {
    return fail(400, `failed to convert collection: ${(err as Error).message}`);
  }

  const dryRun = body.dryRun === true;
  const outPath = resolve(PRESET_DIR, `${preset.id}.json`);

  if (!dryRun) {
    if (await fileExists(outPath)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'preset already exists',
          existingId: preset.id,
        },
        { status: 409 },
      );
    }
    try {
      await writeFile(outPath, JSON.stringify(preset, null, 2) + '\n', 'utf-8');
    } catch (err) {
      return fail(500, `failed to write preset: ${(err as Error).message}`);
    }
    return NextResponse.json({
      ok: true,
      preset,
      written: true,
      path: outPath,
    });
  }

  return NextResponse.json({ ok: true, preset, written: false });
}
