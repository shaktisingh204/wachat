'use server';

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { gate } from '@/lib/sabhrm/gate';
import { getActiveSabHrmProject } from '@/lib/sabhrm/workspace';
import type { ActionResult } from '@/lib/sabhrm/types';

/* ── settings DTO (local — not in shared types.ts) ───────────────────── */

export type SabHrmRegion = 'IN' | 'US' | 'OTHER';

export interface SabHrmSettings {
  /** Display name of the project (not editable here). */
  name: string;
  legalName: string;
  region: SabHrmRegion;
  currency: string;
  fiscalYearStartMonth: number; // 1-12
  timezone: string;
}

export interface SabHrmSettingsInput {
  legalName: string;
  region: SabHrmRegion;
  currency?: string;
  fiscalYearStartMonth?: number;
  timezone?: string;
}

const REGION_DEFAULTS: Record<SabHrmRegion, { currency: string; fyStart: number }> = {
  IN: { currency: 'INR', fyStart: 4 },
  US: { currency: 'USD', fyStart: 1 },
  OTHER: { currency: 'USD', fyStart: 1 },
};

/* ── read ────────────────────────────────────────────────────────────── */

export async function getSabHrmSettings(): Promise<ActionResult<SabHrmSettings>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const project = await getActiveSabHrmProject();
    if (!project) return { ok: false, error: 'No SabHRM organization selected.' };
    const sabhrm = project.sabhrm ?? {};
    const region = (sabhrm.region as SabHrmRegion | undefined) ?? 'IN';
    const defaults = REGION_DEFAULTS[region] ?? REGION_DEFAULTS.IN;
    return {
      ok: true,
      data: {
        name: project.name,
        legalName: sabhrm.legalName ?? project.name ?? '',
        region,
        currency: sabhrm.currency ?? defaults.currency,
        fiscalYearStartMonth: sabhrm.fiscalYearStartMonth ?? defaults.fyStart,
        timezone: sabhrm.timezone ?? '',
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to load settings.' };
  }
}

/* ── update ──────────────────────────────────────────────────────────── */

export async function updateSabHrmSettings(
  input: SabHrmSettingsInput,
): Promise<ActionResult<SabHrmSettings>> {
  const g = await gate();
  if (!g.ok) return { ok: false, error: g.error };
  const { db, workspaceId } = g.ctx;

  const legalName = input.legalName?.trim();
  if (!legalName) return { ok: false, error: 'Organization legal name is required.' };
  if (!['IN', 'US', 'OTHER'].includes(input.region)) {
    return { ok: false, error: 'Pick a region.' };
  }

  const defaults = REGION_DEFAULTS[input.region];
  const currency = (input.currency?.trim() || defaults.currency).toUpperCase();
  const fyStart =
    input.fiscalYearStartMonth && input.fiscalYearStartMonth >= 1 && input.fiscalYearStartMonth <= 12
      ? input.fiscalYearStartMonth
      : defaults.fyStart;
  const timezone = input.timezone?.trim() ?? '';

  try {
    // workspaceId IS the project _id string → resolve to ObjectId.
    if (!ObjectId.isValid(workspaceId)) return { ok: false, error: 'Invalid organization id.' };
    const res = await db.collection('projects').updateOne(
      { _id: new ObjectId(workspaceId), kind: 'hrm' },
      {
        $set: {
          'sabhrm.legalName': legalName,
          'sabhrm.region': input.region,
          'sabhrm.currency': currency,
          'sabhrm.fiscalYearStartMonth': fyStart,
          'sabhrm.timezone': timezone || undefined,
        },
      },
    );
    if (res.matchedCount === 0) return { ok: false, error: 'Organization not found.' };

    revalidatePath('/sabhrm/settings');
    revalidatePath('/sabhrm');

    const project = await db
      .collection('projects')
      .findOne({ _id: new ObjectId(workspaceId) }, { projection: { name: 1 } });

    return {
      ok: true,
      data: {
        name: project ? String((project as Record<string, unknown>).name ?? legalName) : legalName,
        legalName,
        region: input.region,
        currency,
        fiscalYearStartMonth: fyStart,
        timezone,
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to save settings.' };
  }
}
