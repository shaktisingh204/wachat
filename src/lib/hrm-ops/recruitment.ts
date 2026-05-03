/**
 * Recruitment — ATS pipeline, candidate sourcing, interview kits.
 */

import type { Candidate, Interview, JobPosting, Offer, ID } from './types';

export const DEFAULT_PIPELINE: Candidate['stage'][] = [
  'applied',
  'screening',
  'interview',
  'offer',
  'hired',
];

export const REJECTED: Candidate['stage'] = 'rejected';

export interface PipelineStats {
  total: number;
  byStage: Record<Candidate['stage'], number>;
  conversion: Partial<Record<Candidate['stage'], number>>; // % of applied that reached this stage
}

export function pipelineStats(candidates: Candidate[]): PipelineStats {
  const byStage = {
    applied: 0,
    screening: 0,
    interview: 0,
    offer: 0,
    hired: 0,
    rejected: 0,
  } as Record<Candidate['stage'], number>;
  for (const c of candidates) byStage[c.stage]++;
  const total = candidates.length;
  const reached = (stage: Candidate['stage']) => {
    const order = DEFAULT_PIPELINE.indexOf(stage);
    let count = 0;
    for (const c of candidates) {
      const ci = DEFAULT_PIPELINE.indexOf(c.stage);
      if (ci >= order && c.stage !== 'rejected') count++;
    }
    return count;
  };
  const applied = reached('applied') || 1;
  const conversion: PipelineStats['conversion'] = {};
  for (const stage of DEFAULT_PIPELINE) {
    conversion[stage] = Math.round((reached(stage) / applied) * 100);
  }
  return { total, byStage, conversion };
}

export function advance(candidate: Candidate): Candidate {
  if (candidate.stage === 'rejected' || candidate.stage === 'hired') return candidate;
  const i = DEFAULT_PIPELINE.indexOf(candidate.stage);
  if (i < 0) return candidate;
  const next = DEFAULT_PIPELINE[Math.min(i + 1, DEFAULT_PIPELINE.length - 1)];
  return { ...candidate, stage: next };
}

export function reject(candidate: Candidate): Candidate {
  return { ...candidate, stage: 'rejected' };
}

/** Score a candidate based on resume keywords vs. job requirements. */
export function scoreCandidate(
  candidate: Candidate & { resumeText?: string },
  job: JobPosting,
): number {
  const requirements = (job.requirements ?? []).map((r) => r.toLowerCase());
  if (requirements.length === 0) return 50;
  const text = (candidate.resumeText ?? '').toLowerCase();
  if (!text) return 30;
  const matched = requirements.filter((r) => text.includes(r)).length;
  return Math.round((matched / requirements.length) * 100);
}

export interface InterviewKit {
  jobId: ID;
  competencies: string[];
  questions: { competency: string; prompt: string; difficulty: 'easy' | 'medium' | 'hard' }[];
  rubric: { score: number; descriptor: string }[];
}

export function buildInterviewKit(job: JobPosting): InterviewKit {
  const competencies = inferCompetencies(job);
  return {
    jobId: job.id,
    competencies,
    questions: competencies.flatMap((c) => [
      { competency: c, prompt: `Describe a time when you demonstrated ${c}.`, difficulty: 'easy' },
      { competency: c, prompt: `How would you approach a problem requiring strong ${c}?`, difficulty: 'medium' },
      { competency: c, prompt: `Walk through the most ambitious project where ${c} mattered.`, difficulty: 'hard' },
    ]),
    rubric: [
      { score: 1, descriptor: 'No evidence' },
      { score: 2, descriptor: 'Limited evidence' },
      { score: 3, descriptor: 'Meets expectations' },
      { score: 4, descriptor: 'Exceeds expectations' },
      { score: 5, descriptor: 'Exceptional' },
    ],
  };
}

function inferCompetencies(job: JobPosting): string[] {
  const t = job.title.toLowerCase();
  if (/engineer|developer|swe|software/.test(t)) return ['problem solving', 'system design', 'code quality', 'collaboration'];
  if (/product/.test(t)) return ['discovery', 'prioritisation', 'metrics', 'communication'];
  if (/design/.test(t)) return ['craft', 'systems thinking', 'user empathy', 'critique'];
  if (/sales|account/.test(t)) return ['discovery', 'negotiation', 'pipeline hygiene', 'storytelling'];
  return ['execution', 'communication', 'ownership', 'teamwork'];
}

export interface OfferDraft {
  candidateId: ID;
  jobId: ID;
  ctc: number;
  currency: Offer['currency'];
  startDate: string;
}

export function draftOffer(d: OfferDraft, tenantId: ID): Offer {
  return {
    id: `off_${d.candidateId}_${Date.now()}`,
    tenantId,
    candidateId: d.candidateId,
    jobId: d.jobId,
    ctc: d.ctc,
    currency: d.currency,
    startDate: d.startDate,
    status: 'draft',
  };
}

export function nextInterviewRound(prior: Interview[]): number {
  return prior.length === 0 ? 1 : Math.max(...prior.map((i) => i.round)) + 1;
}
