/**
 * Lifecycle marketing primitives.
 *
 * Defines the data shapes for:
 *   - onboarding email sequences,
 *   - in-app product tour steps,
 *   - NPS survey scheduling,
 *   - win-back triggers for dormant tenants.
 *
 * Pure helpers; the actual sender lives in `email-service` / `team-notifications`.
 */

import 'server-only';

// ── Email sequences ──────────────────────────────────────────────────────────

export interface OnboardingEmail {
  /** Stable id within the sequence — used for idempotency. */
  id: string;
  /** Days after signup to send. 0 = same day. */
  delayDays: number;
  subject: string;
  /** Email template id from `email-templates.ts`. */
  templateId: string;
  /** Sent only when these conditions hold; defaults to "always". */
  sendIf?: OnboardingCondition[];
}

export type OnboardingCondition =
  | { type: 'has_imported_contacts'; expected: boolean }
  | { type: 'has_sent_broadcast'; expected: boolean }
  | { type: 'has_connected_channel'; channel: 'whatsapp' | 'email' | 'sms'; expected: boolean }
  | { type: 'has_invited_teammate'; expected: boolean };

export const DEFAULT_ONBOARDING_SEQUENCE: readonly OnboardingEmail[] = [
  {
    id: 'welcome',
    delayDays: 0,
    subject: 'Welcome to SabNode',
    templateId: 'onboarding-welcome',
  },
  {
    id: 'connect-channel',
    delayDays: 1,
    subject: 'Connect your first channel',
    templateId: 'onboarding-connect-channel',
    sendIf: [{ type: 'has_connected_channel', channel: 'whatsapp', expected: false }],
  },
  {
    id: 'import-contacts',
    delayDays: 2,
    subject: 'Bring your contacts',
    templateId: 'onboarding-import-contacts',
    sendIf: [{ type: 'has_imported_contacts', expected: false }],
  },
  {
    id: 'first-broadcast',
    delayDays: 4,
    subject: 'Send your first broadcast',
    templateId: 'onboarding-first-broadcast',
    sendIf: [{ type: 'has_sent_broadcast', expected: false }],
  },
  {
    id: 'invite-team',
    delayDays: 7,
    subject: 'Bring your team along',
    templateId: 'onboarding-invite-team',
    sendIf: [{ type: 'has_invited_teammate', expected: false }],
  },
  {
    id: 'check-in',
    delayDays: 14,
    subject: 'How are things going?',
    templateId: 'onboarding-check-in',
  },
] as const;

// ── In-app tour ──────────────────────────────────────────────────────────────

export interface TourStep {
  id: string;
  /** CSS selector for the element to highlight. */
  target: string;
  title: string;
  body: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  /** Optional URL the user must land on for this step to be shown. */
  routeMatch?: string;
}

export const DEFAULT_TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'sidebar',
    target: '[data-tour="sidebar"]',
    title: 'Your workspace',
    body: 'All modules — Wachat, SabFlow, CRM, SEO — are here.',
    placement: 'right',
  },
  {
    id: 'connect-channel',
    target: '[data-tour="connect-channel"]',
    title: 'Connect a channel',
    body: 'Start by linking your WhatsApp or Email account.',
    placement: 'bottom',
    routeMatch: '/dashboard',
  },
  {
    id: 'first-broadcast',
    target: '[data-tour="new-broadcast"]',
    title: 'Send your first message',
    body: 'Compose a broadcast and reach contacts in seconds.',
    placement: 'bottom',
    routeMatch: '/dashboard/broadcasts',
  },
  {
    id: 'help',
    target: '[data-tour="help"]',
    title: 'Need a hand?',
    body: 'Jump into community support or talk to our team here.',
    placement: 'top',
  },
] as const;

// ── NPS survey scheduler ─────────────────────────────────────────────────────

export interface NpsScheduleInput {
  /** When the tenant signed up. */
  signedUpAt: Date;
  /** Last time we sent an NPS survey to this tenant (if ever). */
  lastNpsAt?: Date;
  /** "Now" injection for testability. */
  now?: Date;
}

/** First NPS at 30 days post-signup, then every 90 days. */
export const NPS_FIRST_DAYS = 30;
export const NPS_REPEAT_DAYS = 90;

export function shouldSendNps(input: NpsScheduleInput): boolean {
  const now = (input.now ?? new Date()).getTime();
  const ageDays = (now - input.signedUpAt.getTime()) / 86_400_000;
  if (ageDays < NPS_FIRST_DAYS) return false;
  if (!input.lastNpsAt) return true;
  const sinceDays = (now - input.lastNpsAt.getTime()) / 86_400_000;
  return sinceDays >= NPS_REPEAT_DAYS;
}

// ── Win-back triggers ────────────────────────────────────────────────────────

export interface WinbackInput {
  lastActiveAt: Date;
  churnedAt?: Date;
  now?: Date;
  /** Whether the tenant has previously received a win-back email. */
  alreadyContacted?: boolean;
}

export type WinbackTrigger =
  | { kind: 'dormant_30d' }
  | { kind: 'dormant_60d' }
  | { kind: 'churned_30d' }
  | null;

/**
 * Decide which win-back path to trigger, if any. Returns null when the
 * tenant is healthy or already contacted.
 */
export function evaluateWinback(input: WinbackInput): WinbackTrigger {
  if (input.alreadyContacted) return null;
  const now = (input.now ?? new Date()).getTime();

  if (input.churnedAt) {
    const days = (now - input.churnedAt.getTime()) / 86_400_000;
    if (days >= 30) return { kind: 'churned_30d' };
    return null;
  }

  const dormant = (now - input.lastActiveAt.getTime()) / 86_400_000;
  if (dormant >= 60) return { kind: 'dormant_60d' };
  if (dormant >= 30) return { kind: 'dormant_30d' };
  return null;
}
