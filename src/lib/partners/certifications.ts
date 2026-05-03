/**
 * Certification exam runner.
 *
 * Pure helpers: `startExam`, `submitExam` and `gradeExam` build domain
 * objects without persisting them. Persistence (Mongo writes) is the
 * caller's responsibility — keeping this file pure makes it trivial to test.
 *
 * Certificates are issued via `issueCertificate` and can later be revoked
 * via `revokeCertificate`. Both are pure transformations.
 */

import 'server-only';

import { randomUUID } from 'node:crypto';

import type {
  Certification,
  CertificationExam,
  CertificationStatus,
  ExamAttempt,
} from './types';

/** Default validity for an issued certificate, in days. */
export const DEFAULT_CERTIFICATE_VALIDITY_DAYS = 365 * 2;

export function startExam(userId: string, exam: CertificationExam): ExamAttempt {
  return {
    attemptId: randomUUID(),
    examId: exam.examId,
    userId,
    startedAt: new Date(),
    answers: {},
  };
}

export function submitExam(
  attempt: ExamAttempt,
  answers: Record<string, number>,
): ExamAttempt {
  return {
    ...attempt,
    answers: { ...attempt.answers, ...answers },
    submittedAt: new Date(),
  };
}

export interface GradeResult {
  /** % score, 0–100. */
  score: number;
  passed: boolean;
  /** Number of questions answered correctly. */
  correctCount: number;
  /** Total number of graded questions. */
  totalCount: number;
}

/**
 * Grade an attempt against the exam's answer key.
 * `exam.questions[].correctIndex` is the source of truth.
 */
export function gradeExam(attempt: ExamAttempt, exam: CertificationExam): GradeResult {
  const total = exam.questions.length;
  if (total === 0) {
    return { score: 0, passed: false, correctCount: 0, totalCount: 0 };
  }
  let correct = 0;
  for (const q of exam.questions) {
    const chosen = attempt.answers[q.id];
    if (chosen === q.correctIndex) correct += 1;
  }
  const score = Math.round((correct / total) * 100);
  return {
    score,
    passed: score >= exam.passingScore,
    correctCount: correct,
    totalCount: total,
  };
}

export interface IssueCertificateInput {
  userId: string;
  tenantId: string;
  exam: CertificationExam;
  score: number;
  validityDays?: number;
}

export function issueCertificate(input: IssueCertificateInput): Certification {
  const issuedAt = new Date();
  const validityDays = input.validityDays ?? DEFAULT_CERTIFICATE_VALIDITY_DAYS;
  const expiresAt = new Date(issuedAt.getTime() + validityDays * 24 * 60 * 60 * 1000);
  return {
    certificationId: randomUUID(),
    userId: input.userId,
    tenantId: input.tenantId,
    examId: input.exam.examId,
    title: input.exam.title,
    level: input.exam.level,
    score: input.score,
    status: 'issued',
    issuedAt,
    expiresAt,
    certificateNumber: makeCertificateNumber(input.exam.examId, issuedAt),
  };
}

export function revokeCertificate(
  cert: Certification,
  reason: string,
  at: Date = new Date(),
): Certification {
  return {
    ...cert,
    status: 'revoked' as CertificationStatus,
    revokedAt: at,
    revokedReason: reason,
  };
}

export function isCertificateValid(cert: Certification, now: Date = new Date()): boolean {
  if (cert.status !== 'issued') return false;
  if (cert.expiresAt && cert.expiresAt.getTime() < now.getTime()) return false;
  return true;
}

function makeCertificateNumber(examId: string, issuedAt: Date): string {
  // Compact, human-readable: SN-<examPrefix>-<yymmdd>-<short>
  const prefix = examId.slice(0, 4).toUpperCase();
  const yymmdd =
    String(issuedAt.getUTCFullYear()).slice(2) +
    String(issuedAt.getUTCMonth() + 1).padStart(2, '0') +
    String(issuedAt.getUTCDate()).padStart(2, '0');
  const short = randomUUID().split('-')[0].toUpperCase();
  return `SN-${prefix}-${yymmdd}-${short}`;
}
