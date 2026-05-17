/**
 * SabFlow — OpenAPI 3.x importer route (Wave A4).
 *
 *   POST /api/sabflow/presets/import-openapi
 *
 * Body shapes (any one):
 *   { specUrl: string,  id?: string, dryRun?: boolean }   — fetched from URL
 *   { spec:    object,  id?: string, dryRun?: boolean }   — inline JSON
 *   { specYaml: string, id?: string, dryRun?: boolean }   — YAML text (UNSUPPORTED for now)
 *
 * Auto-imports land as `draft` presets with an `openapi-` id prefix so they
 * never overwrite hand-curated or `n8n-` imported files. See
 * `SABFLOW_1000_APPS_PLAN.md` §3, §4, §8.
 */

import 'server-only';

import { writeFile, stat, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

import { NextResponse, type NextRequest } from 'next/server';

import { getAdminSession } from '@/lib/admin-session';
import {
  openApiToPresetVerbose,
  validatePreset,
} from '@/lib/sabflow/app-presets/importers/openapi';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/* ── Constants ───────────────────────────────────────────────────────────── */

const PRESET_DIR = resolve(process.cwd(), 'src/lib/sabflow/app-presets');
const MAX_SPEC_BYTES = 10 * 1024 * 1024; // 10 MB — §8 acceptance criteria.

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function bad(
  status: number,
  error: string,
  details?: string[],
): NextResponse {
  const body: { ok: false; error: string; details?: string[] } = {
    ok: false,
    error,
  };
  if (details && details.length > 0) body.details = details;
  return NextResponse.json(body, { status });
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

async function fetchSpecFromUrl(url: string): Promise<unknown> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('specUrl is not a valid URL.');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('specUrl must be http(s).');
  }
  const res = await fetch(parsed.toString(), {
    redirect: 'follow',
    headers: { Accept: 'application/json, application/yaml, text/yaml, */*' },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch spec: HTTP ${res.status}`);
  }
  const contentLength = Number(res.headers.get('content-length') ?? '0');
  if (contentLength && contentLength > MAX_SPEC_BYTES) {
    throw new Error(`Spec exceeds 10 MB limit (got ${contentLength} bytes).`);
  }
  const text = await res.text();
  if (text.length > MAX_SPEC_BYTES) {
    throw new Error(`Spec exceeds 10 MB limit (got ${text.length} bytes).`);
  }
  // Accept JSON only — YAML support requires a parser we don't bundle yet.
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(
      'Fetched spec is not JSON. YAML specs are not supported yet — fetch a JSON variant.',
    );
  }
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

/* ── Route ───────────────────────────────────────────────────────────────── */

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Admin gate — matches the rest of the admin-side preset tooling.
  const session = await getAdminSession();
  if (!session.isAdmin) {
    return bad(401, 'Admin session required.');
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad(400, 'Request body must be valid JSON.');
  }
  if (!isPlainObject(body)) {
    return bad(400, 'Request body must be a JSON object.');
  }

  const idOverride =
    typeof body.id === 'string' && body.id.length > 0 ? body.id : undefined;
  const dryRun = body.dryRun === true;

  // ── 1. Resolve the spec from URL / inline / YAML.
  let spec: unknown;
  if (typeof body.specYaml === 'string' && body.specYaml.length > 0) {
    return bad(
      400,
      'yaml not supported, send JSON',
      ['Convert the YAML spec to JSON before posting, or pass `spec` / `specUrl` instead.'],
    );
  }
  if (typeof body.specUrl === 'string' && body.specUrl.length > 0) {
    try {
      spec = await fetchSpecFromUrl(body.specUrl);
    } catch (err) {
      return bad(400, (err as Error).message);
    }
  } else if (isPlainObject(body.spec)) {
    // Inline JSON — enforce the size cap here too (rough char-byte estimate).
    const approxSize = JSON.stringify(body.spec).length;
    if (approxSize > MAX_SPEC_BYTES) {
      return bad(
        413,
        `Spec exceeds 10 MB limit (got ~${approxSize} bytes inline).`,
      );
    }
    spec = body.spec;
  } else {
    return bad(
      400,
      'Provide one of: `specUrl` (string), `spec` (inline JSON object), or `specYaml` (string).',
    );
  }

  // ── 2. Pre-flight OpenAPI sanity (cheap, catches obvious wrong inputs).
  if (!isPlainObject(spec)) {
    return bad(400, 'Resolved spec is not a JSON object.');
  }
  const openapiVersion = spec.openapi;
  if (typeof openapiVersion !== 'string' || !openapiVersion.startsWith('3.')) {
    return bad(
      422,
      'Only OpenAPI 3.x is supported.',
      [`Got openapi=${typeof openapiVersion === 'string' ? openapiVersion : 'undefined'}.`],
    );
  }
  if (!isPlainObject(spec.paths) || Object.keys(spec.paths).length === 0) {
    return bad(422, 'Spec has no `paths` to import.');
  }

  // ── 3. Convert.
  let preset;
  let warnings: string[];
  try {
    const result = openApiToPresetVerbose(spec, { id: idOverride });
    preset = result.preset;
    warnings = result.warnings;
  } catch (err) {
    return bad(422, (err as Error).message);
  }

  // ── 4. Validate output shape.
  const v = validatePreset(preset);
  if (!v.ok) {
    return bad(422, 'Generated preset failed shape validation.', v.errors);
  }

  // ── 5. Persist (unless dryRun) — refuse to overwrite.
  const targetPath = resolve(PRESET_DIR, `${preset.id}.json`);
  if (dryRun) {
    return NextResponse.json({
      ok: true,
      preset,
      written: false,
      details: warnings.length > 0 ? warnings : undefined,
    });
  }

  await mkdir(PRESET_DIR, { recursive: true });
  if (await fileExists(targetPath)) {
    return NextResponse.json(
      {
        ok: false,
        error: `Preset file already exists: ${preset.id}.json`,
        details: [
          'Pass a different `id` override, or delete the existing file before re-importing.',
        ],
      },
      { status: 409 },
    );
  }

  try {
    await writeFile(targetPath, `${JSON.stringify(preset, null, 2)}\n`, 'utf-8');
  } catch (err) {
    return bad(500, `Failed to write preset: ${(err as Error).message}`);
  }

  return NextResponse.json({
    ok: true,
    preset,
    written: true,
    path: targetPath,
    details: warnings.length > 0 ? warnings : undefined,
  });
}
