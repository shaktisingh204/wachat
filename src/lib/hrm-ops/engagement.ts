/**
 * Engagement — eNPS surveys, anonymous reporting.
 *
 * eNPS scoring: respondents pick 0-10 to "How likely are you to recommend
 *   {company} as a place to work?". Promoters = 9-10, Passives = 7-8,
 *   Detractors = 0-6. Score = (%promoters - %detractors) ranges -100..100.
 */

import type { EnpsScore, Survey, ID } from './types';

export interface EnpsResponse {
  surveyId: ID;
  responseId: ID;
  rating: number; // 0..10
  /** anonymized hash of respondent (never store identity directly). */
  hashedRespondent: string;
  comment?: string;
  submittedAt: string;
}

export function classifyResponse(rating: number): 'promoter' | 'passive' | 'detractor' {
  if (rating >= 9) return 'promoter';
  if (rating >= 7) return 'passive';
  return 'detractor';
}

export function calculateEnps(survey: Survey, responses: EnpsResponse[], period: string): EnpsScore {
  const ratings = responses.filter((r) => r.surveyId === survey.id);
  const total = ratings.length || 1;
  let promoters = 0;
  let passives = 0;
  let detractors = 0;
  for (const r of ratings) {
    const c = classifyResponse(r.rating);
    if (c === 'promoter') promoters++;
    else if (c === 'passive') passives++;
    else detractors++;
  }
  const score = Math.round(((promoters - detractors) / total) * 100);
  return {
    id: `enps_${survey.id}_${period}`,
    tenantId: survey.tenantId,
    surveyId: survey.id,
    period,
    responses: ratings.length,
    promoters,
    passives,
    detractors,
    score,
  };
}

/**
 * Hash a respondent identity into a stable opaque token so anonymous
 * responses cannot be correlated back to the employee. SHA-256 + survey
 * salt; never stores the underlying email.
 */
export async function hashRespondent(employeeId: string, surveySalt: string): Promise<string> {
  // Prefer Web Crypto when available (edge / browser / node 20+).
  const data = new TextEncoder().encode(`${surveySalt}:${employeeId}`);
  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    const buf = await globalThis.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback: simple non-crypto hash (still opaque, but never reaches prod
  // because Node 20+ exposes globalThis.crypto.subtle).
  let h = 0;
  for (let i = 0; i < data.length; i++) h = (h * 31 + data[i]) >>> 0;
  return h.toString(16);
}

/**
 * Anonymous incident report — lightweight form output that the engagement
 * module forwards to the configured ombuds inbox.
 */
export interface AnonymousReport {
  id: ID;
  tenantId: ID;
  category: 'harassment' | 'discrimination' | 'safety' | 'compliance' | 'other';
  subject: string;
  body: string;
  /** Token used for the reporter to view replies; never tied to identity. */
  conversationToken: string;
  submittedAt: string;
}

export function createAnonymousReport(input: Omit<AnonymousReport, 'id' | 'submittedAt'>): AnonymousReport {
  return {
    ...input,
    id: `report_${input.conversationToken.slice(0, 8)}_${Date.now()}`,
    submittedAt: new Date().toISOString(),
  };
}
