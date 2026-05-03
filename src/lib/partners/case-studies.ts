/**
 * Case-study CMS — submission flow + approval queue.
 *
 * Lifecycle:
 *   draft → submitted → (approved | rejected)
 *   approved → published
 *
 * All transitions are pure functions; persistence is the caller's job.
 */

import 'server-only';

import { randomUUID } from 'node:crypto';

import type { CaseStudy, CaseStudyStatus } from './types';

export interface SubmitCaseStudyInput {
  tenantId: string;
  submittedByUserId: string;
  title: string;
  customer: string;
  industry: string;
  summary: string;
  body: string;
  metrics?: { label: string; value: string }[];
  heroImageUrl?: string;
}

export function createCaseStudyDraft(input: SubmitCaseStudyInput): CaseStudy {
  const now = new Date();
  return {
    caseStudyId: randomUUID(),
    tenantId: input.tenantId,
    title: input.title,
    customer: input.customer,
    industry: input.industry,
    summary: input.summary,
    body: input.body,
    metrics: input.metrics ?? [],
    heroImageUrl: input.heroImageUrl,
    status: 'draft',
    submittedByUserId: input.submittedByUserId,
    createdAt: now,
    updatedAt: now,
  };
}

export function submitCaseStudy(cs: CaseStudy): CaseStudy {
  ensureStatus(cs, ['draft']);
  return { ...cs, status: 'submitted' as CaseStudyStatus, updatedAt: new Date() };
}

export interface ReviewInput {
  reviewerUserId: string;
  rejectionReason?: string;
}

export function approveCaseStudy(cs: CaseStudy, input: ReviewInput): CaseStudy {
  ensureStatus(cs, ['submitted']);
  const at = new Date();
  return {
    ...cs,
    status: 'approved',
    reviewedByUserId: input.reviewerUserId,
    reviewedAt: at,
    rejectionReason: undefined,
    updatedAt: at,
  };
}

export function rejectCaseStudy(cs: CaseStudy, input: ReviewInput): CaseStudy {
  ensureStatus(cs, ['submitted']);
  if (!input.rejectionReason) {
    throw new Error('rejectionReason is required to reject a case study');
  }
  const at = new Date();
  return {
    ...cs,
    status: 'rejected',
    reviewedByUserId: input.reviewerUserId,
    reviewedAt: at,
    rejectionReason: input.rejectionReason,
    updatedAt: at,
  };
}

export function publishCaseStudy(cs: CaseStudy): CaseStudy {
  ensureStatus(cs, ['approved']);
  const at = new Date();
  return { ...cs, status: 'published', publishedAt: at, updatedAt: at };
}

/** Returns case studies awaiting moderation, oldest first. */
export function approvalQueue(items: CaseStudy[]): CaseStudy[] {
  return items
    .filter((c) => c.status === 'submitted')
    .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
}

function ensureStatus(cs: CaseStudy, allowed: CaseStudyStatus[]): void {
  if (!allowed.includes(cs.status)) {
    throw new Error(
      `Case study ${cs.caseStudyId} is in status "${cs.status}"; expected one of ${allowed.join(', ')}`,
    );
  }
}
