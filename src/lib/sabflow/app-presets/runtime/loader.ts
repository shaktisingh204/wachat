/**
 * SabFlow — App preset filesystem loader (SERVER ONLY).
 *
 * Reads `src/lib/sabflow/app-presets/<id>.json` from disk on demand and
 * memoises per-id parses plus the directory listing. Refreshes when the file
 * `mtime` (or the directory `mtime`) advances past the cached snapshot.
 *
 * Cheap hand-written shape validation — no zod, no extra deps.
 */
import 'server-only';

import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

import type {
  AppPreset,
  AppPresetEndpoint,
  AppPresetSummary,
} from '../types';

const PRESET_DIR = resolve(process.cwd(), 'src/lib/sabflow/app-presets');

type PresetCacheEntry = {
  preset: AppPreset;
  mtimeMs: number;
};

const presetCache = new Map<string, PresetCacheEntry>();

type DirCacheEntry = {
  ids: string[];
  mtimeMs: number;
};

let dirCache: DirCacheEntry | null = null;

/* ── Shape validation ────────────────────────────────────────────────────── */

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function validateEndpoint(raw: unknown): raw is AppPresetEndpoint {
  if (!isObject(raw)) return false;
  if (typeof raw.id !== 'string' || raw.id.length === 0) return false;
  if (typeof raw.label !== 'string') return false;
  if (typeof raw.method !== 'string') return false;
  if (typeof raw.path !== 'string') return false;
  if (!Array.isArray(raw.fields)) return false;
  return true;
}

function validatePreset(raw: unknown): raw is AppPreset {
  if (!isObject(raw)) return false;
  if (typeof raw.id !== 'string' || raw.id.length === 0) return false;
  if (typeof raw.name !== 'string' || raw.name.length === 0) return false;
  // NOTE: an EMPTY baseUrl is shape-valid — auto-imported drafts ship without
  // one. Completeness (non-empty baseUrl + ≥1 endpoint) is enforced at LIST
  // level via `isPresetComplete`, while per-id loads stay ungated so existing
  // flows referencing an incomplete preset keep resolving it.
  if (typeof raw.baseUrl !== 'string') return false;
  if (!Array.isArray(raw.endpoints)) return false;
  if (!isObject(raw.auth) || typeof raw.auth.type !== 'string') return false;
  for (const e of raw.endpoints) {
    if (!validateEndpoint(e)) return false;
  }
  return true;
}

/* ── File ops ────────────────────────────────────────────────────────────── */

function filePath(id: string): string {
  return resolve(PRESET_DIR, `${id}.json`);
}

async function readPresetFromDisk(id: string): Promise<AppPreset | undefined> {
  let stats;
  try {
    stats = await stat(filePath(id));
  } catch {
    return undefined;
  }
  const cached = presetCache.get(id);
  if (cached && cached.mtimeMs === stats.mtimeMs) {
    return cached.preset;
  }
  let raw: string;
  try {
    raw = await readFile(filePath(id), 'utf-8');
  } catch {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.warn(`[app-presets] ${id}.json — invalid JSON: ${(err as Error).message}`);
    return undefined;
  }
  if (!validatePreset(parsed)) {
    console.warn(`[app-presets] ${id}.json — fails shape validation`);
    return undefined;
  }
  presetCache.set(id, { preset: parsed, mtimeMs: stats.mtimeMs });
  return parsed;
}

async function listPresetIds(): Promise<string[]> {
  let stats;
  try {
    stats = await stat(PRESET_DIR);
  } catch {
    return [];
  }
  if (dirCache && dirCache.mtimeMs === stats.mtimeMs) {
    return dirCache.ids;
  }
  let entries: string[];
  try {
    entries = await readdir(PRESET_DIR);
  } catch {
    return [];
  }
  const ids = entries
    .filter((name) => name.endsWith('.json') && name !== 'index.json' && name !== 'package.json')
    .map((name) => name.slice(0, -5));
  ids.sort();
  dirCache = { ids, mtimeMs: stats.mtimeMs };
  return ids;
}

/* ── Public API ──────────────────────────────────────────────────────────── */

/**
 * A preset is executable only when it has a resolvable base URL and at least
 * one endpoint. This is the hard gate for every LISTING surface — incomplete
 * presets (auto-imported drafts without a baseUrl, empty shells) must never
 * show up in pickers. `status: 'draft'` alone does NOT exclude a preset:
 * a complete draft is listed, flagged `draft: true` in its summary.
 *
 * "Resolvable base URL" means any of:
 *   - a non-empty static `baseUrl`,
 *   - `auth.baseUrlFromCredential` (instance URL read from the credential at
 *     run time — self-hosted apps), or
 *   - `aws_sigv4` auth with `awsService` (host templated from service+region).
 */
export function isPresetComplete(p: AppPreset): boolean {
  if (p.endpoints.length === 0) return false;
  if (p.baseUrl.length > 0) return true;
  if (p.auth?.baseUrlFromCredential) return true;
  if (p.auth?.type === 'aws_sigv4' && p.auth.awsService) return true;
  return false;
}

export type ListPresetsOptions = {
  /** Admin/debug escape hatch — include incomplete (unexecutable) presets. */
  includeIncomplete?: boolean;
};

/** Load a single preset by id. Returns `undefined` when missing or invalid.
 *  Deliberately ungated — existing flows may reference incomplete presets. */
export async function loadPreset(id: string): Promise<AppPreset | undefined> {
  if (!id || typeof id !== 'string') return undefined;
  // Defence in depth — prevent path traversal via id.
  if (id.includes('/') || id.includes('\\') || id.includes('..')) return undefined;
  return readPresetFromDisk(id);
}

/** Load every preset on disk. Skips ones that fail validation; excludes
 *  incomplete presets unless `includeIncomplete` is set. */
export async function listPresets(
  options: ListPresetsOptions = {},
): Promise<AppPreset[]> {
  const ids = await listPresetIds();
  const presets: AppPreset[] = [];
  for (const id of ids) {
    const preset = await readPresetFromDisk(id);
    if (!preset) continue;
    if (!options.includeIncomplete && !isPresetComplete(preset)) continue;
    presets.push(preset);
  }
  return presets;
}

/** Lightweight projection for picker rendering — avoids loading endpoints. */
export async function listPresetSummaries(
  options: ListPresetsOptions = {},
): Promise<AppPresetSummary[]> {
  const presets = await listPresets(options);
  return presets.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    iconName: p.iconName,
    endpointCount: p.endpoints.length,
    lastVerified: p.lastVerified,
    status: p.status ?? 'verified',
    ...(p.status === 'draft' ? { draft: true as const } : {}),
    ...(options.includeIncomplete && !isPresetComplete(p)
      ? { complete: false as const }
      : {}),
  }));
}

/** Test helper — drop the caches so a fresh disk read happens next call. */
export function _clearAppPresetCachesForTests(): void {
  presetCache.clear();
  dirCache = null;
}
