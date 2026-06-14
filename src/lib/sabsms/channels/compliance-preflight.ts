/**
 * SabSMS v3 — the ONE governance gate every channel passes through.
 *
 * This is the structural guarantee competitors lack: a STOP captured on
 * SMS suppresses WhatsApp and voice too, because every channel fans out
 * through this single pre-flight before its adapter runs.
 *
 * V3.0 enforces the cross-channel suppression ledger. V3.4 adds the
 * frequency cap, geo-permissions, and quiet-hours checks HERE — same
 * gate, more checks — so callers never change.
 *
 * The suppression lookup is injectable (`PreflightDeps`) so the gate is
 * unit-testable without Mongo; the default loads the real collection
 * lazily (dynamic import keeps this module light for tests).
 */

import { createHash } from 'node:crypto';

import { countryFromE164 } from '../phone';
import type { SabsmsFrequencyCap, SabsmsGeoPermissions } from '../types';
import { evaluateGeo } from '../governance/geo-permissions';
import {
  DAY_MS,
  HOUR_MS,
  capIsActive,
  exceedsFrequencyCap,
} from '../governance/frequency-cap';
import type {
  DispatchContext,
  DispatchRecipient,
  SabsmsDispatchChannel,
} from './types';
import { PHONE_BASED_CHANNELS } from './types';

/**
 * SHA-256 lowercase hex of the E.164 string. MUST match the engine's
 * `compliance::hash_phone` (services/sabsms-engine/src/compliance/mod.rs:89)
 * — it hashes the raw E.164 bytes (including the leading `+`) — or the
 * suppression ledger and this gate silently disagree.
 */
export function phoneHash(e164: string): string {
  return createHash('sha256').update(e164).digest('hex');
}

export type PreflightVerdict =
  | { allow: true }
  | { allow: false; reason: string };

export interface PreflightDeps {
  /** Override the suppression lookup (tests). Returns true if suppressed. */
  isSuppressed?: (workspaceId: string, phoneHash: string) => Promise<boolean>;
  /** Override the geo-permission config lookup (tests). */
  getGeoConfig?: (workspaceId: string) => Promise<SabsmsGeoPermissions | undefined>;
  /** Override the frequency-cap config lookup (tests). */
  getFrequencyCap?: (workspaceId: string) => Promise<SabsmsFrequencyCap | undefined>;
  /** Override the recent-send counter (tests). `windowMs` is a duration. */
  countRecentSends?: (
    workspaceId: string,
    e164: string,
    windowMs: number,
  ) => Promise<number>;
}

async function defaultIsSuppressed(
  workspaceId: string,
  hash: string,
): Promise<boolean> {
  const { getSabsmsCollections } = await import('../db/collections');
  const { cols } = await getSabsmsCollections();
  // Presence === suppressed; Mongo's TTL index reaps expired rows, so we
  // mirror the engine's `is_suppressed` (no expiresAt filter here).
  const hit = await cols.suppressions.findOne({ workspaceId, phoneHash: hash });
  return hit != null;
}

async function defaultGetGeoConfig(
  workspaceId: string,
): Promise<SabsmsGeoPermissions | undefined> {
  const { loadGeoConfig } = await import('../governance/geo-permissions');
  return loadGeoConfig(workspaceId);
}

async function defaultGetFrequencyCap(
  workspaceId: string,
): Promise<SabsmsFrequencyCap | undefined> {
  const { loadFrequencyCap } = await import('../governance/frequency-cap');
  return loadFrequencyCap(workspaceId);
}

async function defaultCountRecentSends(
  workspaceId: string,
  e164: string,
  windowMs: number,
): Promise<number> {
  const { countRecentSends } = await import('../governance/frequency-cap');
  return countRecentSends(workspaceId, e164, windowMs);
}

export async function compliancePreflight(
  input: {
    workspaceId: string;
    channel: SabsmsDispatchChannel;
    recipient: DispatchRecipient;
    ctx: DispatchContext;
  },
  deps: PreflightDeps = {},
): Promise<PreflightVerdict> {
  const { workspaceId, channel, recipient, ctx } = input;

  // OTP / opt-out confirmations must reach a just-suppressed contact.
  if (ctx.allowSuppressed) return { allow: true };

  // Suppression and geo are phone-keyed. Email suppression lives in
  // SabMail's own ledger (checked inside the email adapter), so the phone
  // gates only govern phone-based channels.
  if (PHONE_BASED_CHANNELS.has(channel) && recipient.e164) {
    const isSuppressed = deps.isSuppressed ?? defaultIsSuppressed;
    if (await isSuppressed(workspaceId, phoneHash(recipient.e164))) {
      return { allow: false, reason: 'recipient_suppressed' };
    }

    // Geo permissions — only act on a confidently-resolved country; an
    // unresolved prefix is left to the engine (which resolves the true
    // destination at send time).
    const country = countryFromE164(recipient.e164);
    if (country) {
      const getGeoConfig = deps.getGeoConfig ?? defaultGetGeoConfig;
      const geo = await getGeoConfig(workspaceId);
      if (geo) {
        const verdict = evaluateGeo(country, geo);
        if (!verdict.allow) return { allow: false, reason: verdict.reason };
      }
    }

    // Frequency cap — marketing-pressure governance, counted globally
    // across all campaigns/journeys. (OTP/transactional already returned
    // via the allowSuppressed bypass above.)
    const getFrequencyCap = deps.getFrequencyCap ?? defaultGetFrequencyCap;
    const cap = await getFrequencyCap(workspaceId);
    if (capIsActive(cap)) {
      const count = deps.countRecentSends ?? defaultCountRecentSends;
      const [perHour, perDay] = await Promise.all([
        cap.perHour != null ? count(workspaceId, recipient.e164, HOUR_MS) : Promise.resolve(0),
        cap.perDay != null ? count(workspaceId, recipient.e164, DAY_MS) : Promise.resolve(0),
      ]);
      if (exceedsFrequencyCap({ perHour, perDay }, cap)) {
        return { allow: false, reason: 'frequency_cap' };
      }
    }
  }

  return { allow: true };
}
