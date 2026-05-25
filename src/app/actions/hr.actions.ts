'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import {
  hrList,
  hrGetById,
  hrSave,
  hrDelete,
  hrBulkDelete,
  hrBulkArchive,
  hrBulkMarkReminder,
  hrBulkUpdateStatus,
  formToObject,
} from '@/lib/hr-crud';
import { hasNegativeNumber, isDateBefore } from '@/lib/form-validation';
import type {
  HrJobPosting,
  HrCandidate,
  HrInterview,
  HrOfferLetter,
  HrCareersPageConfig,
  HrOnboardingTemplate,
  HrWelcomeKit,
  HrProbation,
  HrAnnouncement,
  HrPolicy,
  HrDocument,
  HrDocumentTemplate,
  HrTrainingProgram,
  HrCertification,
  HrLearningPath,
  HrOkr,
  HrFeedback360,
  HrOneOnOne,
  HrTimesheet,
  HrTravelRequest,
  HrExpenseClaim,
  HrAsset,
  HrAssetAssignment,
  HrRecognition,
  HrSurvey,
  HrCompensationBand,
  HrExit,
  HrSuccessionPlan,
} from '@/lib/hr-types';
import type { WithId } from 'mongodb';

/**
 * Every HR entity follows the same CRUD pattern. Each entity gets:
 *   get<Entity>s()           — list all for the tenant
 *   get<Entity>ById(id)      — fetch single
 *   save<Entity>(prev, form) — insert or update
 *   delete<Entity>(id)       — remove
 *
 * Forms use `useActionState`, so `save*` signatures are
 *   (prevState, formData) => Promise<{ message?, error? }>.
 */

type FormState = { message?: string; error?: string; id?: string };

async function genericSave(
  collection: string,
  revalidate: string,
  formData: FormData,
  options: {
    idFields?: string[];
    dateFields?: string[];
    numericKeys?: string[];
    jsonKeys?: string[];
    nonNegativeKeys?: string[];
    dateOrders?: Array<{ start: string; end: string; label?: string }>;
  } = {},
): Promise<FormState> {
  try {
    const data = formToObject(formData, options.numericKeys || []);
    const negativeKey = hasNegativeNumber(data, options.nonNegativeKeys || []);
    if (negativeKey) {
      return { error: `${negativeKey} must be zero or greater.` };
    }
    for (const order of options.dateOrders || []) {
      if (isDateBefore(data, order.start, order.end)) {
        return { error: order.label || `${order.end} cannot be before ${order.start}.` };
      }
    }
    for (const k of options.jsonKeys || []) {
      if (typeof data[k] === 'string' && data[k]) {
        try {
          data[k] = JSON.parse(data[k]);
        } catch {
          /* leave as string */
        }
      }
    }
    const res = await hrSave(collection, data, {
      idFields: options.idFields,
      dateFields: options.dateFields,
    });
    if (res.error) return { error: res.error };
    revalidatePath(revalidate);
    return { message: 'Saved successfully.', id: res.id };
  } catch (e: any) {
    return { error: e?.message || 'Failed to save' };
  }
}

/* ═══════════════════════════════════════════════════════════════════
 *  Recruitment
 * ══════════════════════════════════════════════════════════════════ */

export async function getJobPostings() {
  return hrList<HrJobPosting>('hr_job_postings');
}
export async function getJobPostingById(id: string) {
  return hrGetById<HrJobPosting>('hr_job_postings', id);
}
export async function saveJobPosting(_prev: any, formData: FormData) {
  return genericSave('hr_job_postings', '/dashboard/hrm/hr/jobs', formData, {
    dateFields: ['postedAt'],
    numericKeys: ['salaryMin', 'salaryMax'],
    nonNegativeKeys: ['salaryMin', 'salaryMax'],
  });
}
export async function deleteJobPosting(id: string) {
  const r = await hrDelete('hr_job_postings', id);
  revalidatePath('/dashboard/hrm/hr/jobs');
  return r;
}

export async function getCandidates() {
  return hrList<HrCandidate>('hr_candidates');
}
export async function getCandidateById(id: string) {
  return hrGetById<HrCandidate>('hr_candidates', id);
}
export async function saveCandidate(_prev: any, formData: FormData) {
  return genericSave('hr_candidates', '/dashboard/hrm/hr/candidates', formData, {
    idFields: ['jobId'],
    numericKeys: ['rating'],
  });
}
export async function deleteCandidate(id: string) {
  const r = await hrDelete('hr_candidates', id);
  revalidatePath('/dashboard/hrm/hr/candidates');
  return r;
}

export async function getInterviews() {
  return hrList<HrInterview>('hr_interviews');
}
export async function getInterviewById(id: string) {
  return hrGetById<HrInterview>('hr_interviews', id);
}
export async function saveInterview(_prev: any, formData: FormData) {
  return genericSave('hr_interviews', '/dashboard/hrm/hr/interviews', formData, {
    idFields: ['candidateId'],
    dateFields: ['scheduledAt'],
    numericKeys: ['roundNumber'],
  });
}
export async function deleteInterview(id: string) {
  const r = await hrDelete('hr_interviews', id);
  revalidatePath('/dashboard/hrm/hr/interviews');
  return r;
}

export async function getOfferLetters() {
  return hrList<HrOfferLetter>('hr_offer_letters');
}
export async function getOfferLetterById(id: string) {
  return hrGetById<HrOfferLetter>('hr_offer_letters', id);
}
export async function saveOfferLetter(_prev: any, formData: FormData) {
  return genericSave('hr_offer_letters', '/dashboard/hrm/hr/offers', formData, {
    idFields: ['candidateId'],
    dateFields: ['joiningDate', 'sentAt', 'respondedAt'],
    numericKeys: ['salary', 'ctc'],
    nonNegativeKeys: ['salary', 'ctc'],
  });
}
export async function deleteOfferLetter(id: string) {
  const r = await hrDelete('hr_offer_letters', id);
  revalidatePath('/dashboard/hrm/hr/offers');
  return r;
}

export async function getCareersPageConfig(): Promise<WithId<HrCareersPageConfig> | null> {
  const docs = await hrList<HrCareersPageConfig>('hr_careers_page');
  return docs[0] || null;
}
export async function saveCareersPageConfig(_prev: any, formData: FormData) {
  return genericSave('hr_careers_page', '/dashboard/hrm/hr/careers-page', formData);
}

/* ═══════════════════════════════════════════════════════════════════
 *  Onboarding
 * ══════════════════════════════════════════════════════════════════ */

export async function getOnboardingTemplates() {
  return hrList<HrOnboardingTemplate>('hr_onboarding_templates');
}
export async function getOnboardingTemplateById(id: string) {
  return hrGetById<HrOnboardingTemplate>('hr_onboarding_templates', id);
}
export async function saveOnboardingTemplate(_prev: any, formData: FormData) {
  // Strip ephemeral row-level picker fields — only the consolidated
  // `tasks` JSON should reach the DB.
  const fd = new FormData();
  for (const [k, v] of formData.entries()) {
    if (k.startsWith('__taskAssignee-')) continue;
    fd.append(k, v);
  }
  return genericSave(
    'hr_onboarding_templates',
    '/dashboard/hrm/hr/onboarding',
    fd,
    {
      jsonKeys: ['tasks', 'documents'],
      idFields: ['department', 'mentorId', 'buddyId'],
      numericKeys: ['estimatedDays'],
    },
  );
}
export async function deleteOnboardingTemplate(id: string) {
  const r = await hrDelete('hr_onboarding_templates', id);
  revalidatePath('/dashboard/hrm/hr/onboarding');
  return r;
}

export async function getWelcomeKits() {
  return hrList<HrWelcomeKit>('hr_welcome_kits');
}
export async function getDisciplinaryCases() {
  return hrList<HrDisciplinaryCase>('hr_disciplinary_cases');
}
export async function getDisciplinaryCase(id: string) {
  return hrGetById<HrDisciplinaryCase>('hr_disciplinary_cases', id);
}
export async function saveDisciplinaryCase(_prev: any, formData: FormData) {
  return genericSave('hr_disciplinary_cases', '/dashboard/hrm/hr/disciplinary', formData, {
    idFields: ['employeeId', 'reportedBy'],
    dateFields: ['incidentDate', 'investigationDate', 'decisionDate'],
  });
}
export async function deleteDisciplinaryCase(id: string) {
  const r = await hrDelete('hr_disciplinary_cases', id);
  revalidatePath('/dashboard/hrm/hr/disciplinary');
  return r;
}
export async function addDisciplinaryHearing(caseId: string, hearing: any) {
  // In a real app we'd push to case.hearings array
  revalidatePath(`/dashboard/hrm/hr/disciplinary/${caseId}`);
  return { success: true };
}
export async function saveWelcomeKit(_prev: any, formData: FormData) {
  return genericSave(
    'hr_welcome_kits',
    '/dashboard/hrm/hr/welcome-kit',
    formData,
    { jsonKeys: ['items'] },
  );
}
export async function deleteWelcomeKit(id: string) {
  const r = await hrDelete('hr_welcome_kits', id);
  revalidatePath('/dashboard/hrm/hr/welcome-kit');
  return r;
}

export async function getProbations() {
  return hrList<HrProbation>('hr_probations');
}
export async function saveProbation(_prev: any, formData: FormData) {
  return genericSave('hr_probations', '/dashboard/hrm/hr/probation', formData, {
    idFields: ['employeeId'],
    dateFields: ['startDate', 'endDate'],
  });
}
export async function deleteProbation(id: string) {
  const r = await hrDelete('hr_probations', id);
  revalidatePath('/dashboard/hrm/hr/probation');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Workspace — Announcements, Policies, Documents
 * ══════════════════════════════════════════════════════════════════ */

export async function getAnnouncements() {
  return hrList<HrAnnouncement>('hr_announcements');
}
export async function saveAnnouncement(_prev: any, formData: FormData) {
  return genericSave('hr_announcements', '/dashboard/hrm/hr/announcements', formData, {
    idFields: ['departmentId'],
    dateFields: ['publishAt'],
  });
}
export async function deleteAnnouncement(id: string) {
  const r = await hrDelete('hr_announcements', id);
  revalidatePath('/dashboard/hrm/hr/announcements');
  return r;
}

export async function getPolicies() {
  return hrList<HrPolicy>('hr_policies');
}
export async function savePolicy(_prev: any, formData: FormData) {
  return genericSave('hr_policies', '/dashboard/hrm/hr/policies', formData, {
    dateFields: ['effectiveDate'],
  });
}
export async function deletePolicy(id: string) {
  const r = await hrDelete('hr_policies', id);
  revalidatePath('/dashboard/hrm/hr/policies');
  return r;
}

export async function getDocuments() {
  return hrList<HrDocument>('hr_documents');
}
export async function saveDocument(_prev: any, formData: FormData) {
  return genericSave('hr_documents', '/dashboard/hrm/hr/documents', formData, {
    idFields: ['employeeId'],
    dateFields: ['expiresAt'],
  });
}
export async function deleteDocument(id: string) {
  const r = await hrDelete('hr_documents', id);
  revalidatePath('/dashboard/hrm/hr/documents');
  return r;
}

export async function getDocumentTemplates() {
  return hrList<HrDocumentTemplate>('hr_document_templates');
}
export async function saveDocumentTemplate(_prev: any, formData: FormData) {
  return genericSave(
    'hr_document_templates',
    '/dashboard/hrm/hr/document-templates',
    formData,
    { jsonKeys: ['placeholders'] },
  );
}
export async function deleteDocumentTemplate(id: string) {
  const r = await hrDelete('hr_document_templates', id);
  revalidatePath('/dashboard/hrm/hr/document-templates');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Training & Development
 * ══════════════════════════════════════════════════════════════════ */

export async function getTrainingPrograms() {
  return hrList<HrTrainingProgram>('hr_training_programs');
}
export async function saveTrainingProgram(_prev: any, formData: FormData) {
  return genericSave('hr_training_programs', '/dashboard/hrm/hr/training', formData, {
    dateFields: ['startDate', 'endDate'],
    numericKeys: ['costPerParticipant'],
    nonNegativeKeys: ['costPerParticipant'],
    dateOrders: [{ start: 'startDate', end: 'endDate', label: 'End date cannot be before start date.' }],
  });
}
export async function deleteTrainingProgram(id: string) {
  const r = await hrDelete('hr_training_programs', id);
  revalidatePath('/dashboard/hrm/hr/training');
  return r;
}

export async function getCertifications() {
  return hrList<HrCertification>('hr_certifications');
}
export async function getCertification(id: string) {
  return hrGetById<HrCertification>('hr_certifications', id);
}
export async function saveCertification(_prev: any, formData: FormData) {
  return genericSave('hr_certifications', '/dashboard/hrm/hr/certifications', formData, {
    idFields: ['employeeId'],
    dateFields: ['issuedAt', 'expiresAt'],
  });
}
export async function deleteCertification(id: string) {
  const r = await hrDelete('hr_certifications', id);
  revalidatePath('/dashboard/hrm/hr/certifications');
  return r;
}

export async function getLearningPaths() {
  return hrList<HrLearningPath>('hr_learning_paths');
}
export async function saveLearningPath(_prev: any, formData: FormData) {
  return genericSave('hr_learning_paths', '/dashboard/hrm/hr/learning-paths', formData, {
    jsonKeys: ['steps'],
  });
}
export async function deleteLearningPath(id: string) {
  const r = await hrDelete('hr_learning_paths', id);
  revalidatePath('/dashboard/hrm/hr/learning-paths');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Performance
 * ══════════════════════════════════════════════════════════════════ */

export async function getOkrs() {
  return hrList<HrOkr>('hr_okrs');
}
export async function saveOkr(_prev: any, formData: FormData) {
  return genericSave('hr_okrs', '/dashboard/hrm/hr/okrs', formData, {
    idFields: ['employeeId'],
    jsonKeys: ['keyResults'],
  });
}
export async function deleteOkr(id: string) {
  const r = await hrDelete('hr_okrs', id);
  revalidatePath('/dashboard/hrm/hr/okrs');
  return r;
}

export async function getFeedback360() {
  return hrList<HrFeedback360>('hr_feedback_360');
}
export async function saveFeedback360(_prev: any, formData: FormData) {
  return genericSave('hr_feedback_360', '/dashboard/hrm/hr/feedback-360', formData, {
    idFields: ['employeeId'],
    dateFields: ['submittedAt'],
    numericKeys: ['rating'],
  });
}
export async function deleteFeedback360(id: string) {
  const r = await hrDelete('hr_feedback_360', id);
  revalidatePath('/dashboard/hrm/hr/feedback-360');
  return r;
}

export async function getOneOnOnes() {
  return hrList<HrOneOnOne>('hr_one_on_ones');
}
export async function saveOneOnOne(_prev: any, formData: FormData) {
  return genericSave('hr_one_on_ones', '/dashboard/hrm/hr/one-on-ones', formData, {
    idFields: ['employeeId'],
    dateFields: ['scheduledAt'],
  });
}
export async function deleteOneOnOne(id: string) {
  const r = await hrDelete('hr_one_on_ones', id);
  revalidatePath('/dashboard/hrm/hr/one-on-ones');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Time & Expense
 * ══════════════════════════════════════════════════════════════════ */

export async function getTimesheets() {
  return hrList<HrTimesheet>('hr_timesheets');
}
export async function saveTimesheet(_prev: any, formData: FormData) {
  return genericSave('hr_timesheets', '/dashboard/hrm/hr/timesheets', formData, {
    idFields: ['employeeId'],
    dateFields: ['weekStart'],
    numericKeys: ['totalHours'],
    jsonKeys: ['entries'],
  });
}
export async function deleteTimesheet(id: string) {
  const r = await hrDelete('hr_timesheets', id);
  revalidatePath('/dashboard/hrm/hr/timesheets');
  return r;
}

export async function getTravelRequests() {
  return hrList<HrTravelRequest>('hr_travel_requests');
}
export async function saveTravelRequest(_prev: any, formData: FormData) {
  return genericSave('hr_travel_requests', '/dashboard/hrm/hr/travel', formData, {
    idFields: ['employeeId'],
    dateFields: ['fromDate', 'toDate'],
    numericKeys: ['estimatedCost'],
    nonNegativeKeys: ['estimatedCost'],
    dateOrders: [{ start: 'fromDate', end: 'toDate', label: 'Return date cannot be before travel start date.' }],
  });
}
export async function deleteTravelRequest(id: string) {
  const r = await hrDelete('hr_travel_requests', id);
  revalidatePath('/dashboard/hrm/hr/travel');
  return r;
}

export async function getExpenseClaims() {
  return hrList<HrExpenseClaim>('hr_expense_claims');
}
export async function saveExpenseClaim(_prev: any, formData: FormData) {
  return genericSave('hr_expense_claims', '/dashboard/hrm/hr/expense-claims', formData, {
    idFields: ['employeeId'],
    dateFields: ['incurredAt'],
    numericKeys: ['amount'],
    nonNegativeKeys: ['amount'],
  });
}
export async function deleteExpenseClaim(id: string) {
  const r = await hrDelete('hr_expense_claims', id);
  revalidatePath('/dashboard/hrm/hr/expense-claims');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Assets
 * ══════════════════════════════════════════════════════════════════ */

export async function getAssets() {
  return hrList<HrAsset>('hr_assets');
}
export async function saveAsset(_prev: any, formData: FormData) {
  return genericSave('hr_assets', '/dashboard/hrm/hr/assets', formData, {
    dateFields: ['purchaseDate'],
  });
}
export async function deleteAsset(id: string) {
  const r = await hrDelete('hr_assets', id);
  revalidatePath('/dashboard/hrm/hr/assets');
  return r;
}

export async function getAssetAssignments() {
  return hrList<HrAssetAssignment>('hr_asset_assignments');
}
export async function saveAssetAssignment(_prev: any, formData: FormData) {
  return genericSave(
    'hr_asset_assignments',
    '/dashboard/hrm/hr/asset-assignments',
    formData,
    {
      idFields: ['assetId', 'employeeId'],
      dateFields: ['assignedAt', 'expectedReturnAt', 'returnedAt'],
      dateOrders: [
        { start: 'assignedAt', end: 'expectedReturnAt', label: 'Expected return date cannot be before assigned date.' },
        { start: 'assignedAt', end: 'returnedAt', label: 'Actual return date cannot be before assigned date.' },
      ],
    },
  );
}
export async function deleteAssetAssignment(id: string) {
  const r = await hrDelete('hr_asset_assignments', id);
  revalidatePath('/dashboard/hrm/hr/asset-assignments');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Engagement
 * ══════════════════════════════════════════════════════════════════ */

export async function getRecognitions() {
  return hrList<HrRecognition>('hr_recognitions');
}
export async function saveRecognition(_prev: any, formData: FormData) {
  return genericSave('hr_recognitions', '/dashboard/hrm/hr/recognition', formData, {
    idFields: ['employeeId'],
    dateFields: ['givenAt'],
    numericKeys: ['points'],
  });
}
export async function deleteRecognition(id: string) {
  const r = await hrDelete('hr_recognitions', id);
  revalidatePath('/dashboard/hrm/hr/recognition');
  return r;
}

export async function getSurveys() {
  return hrList<HrSurvey>('hr_surveys');
}
export async function saveSurvey(_prev: any, formData: FormData) {
  return genericSave('hr_surveys', '/dashboard/hrm/hr/surveys', formData, {
    jsonKeys: ['questions'],
    numericKeys: ['responsesCount'],
  });
}
export async function deleteSurvey(id: string) {
  const r = await hrDelete('hr_surveys', id);
  revalidatePath('/dashboard/hrm/hr/surveys');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Compensation & Exit
 * ══════════════════════════════════════════════════════════════════ */

export async function getCompensationBands() {
  return hrList<HrCompensationBand>('hr_compensation_bands');
}
export async function saveCompensationBand(_prev: any, formData: FormData) {
  return genericSave(
    'hr_compensation_bands',
    '/dashboard/hrm/hr/compensation-bands',
    formData,
    {
      numericKeys: ['min_salary', 'max_salary', 'minSalary', 'maxSalary'],
      nonNegativeKeys: ['min_salary', 'max_salary', 'minSalary', 'maxSalary'],
    },
  );
}
export async function deleteCompensationBand(id: string) {
  const r = await hrDelete('hr_compensation_bands', id);
  revalidatePath('/dashboard/hrm/hr/compensation-bands');
  return r;
}

export async function getExits() {
  return hrList<HrExit>('hr_exits');
}
export async function saveExit(_prev: any, formData: FormData) {
  return genericSave('hr_exits', '/dashboard/hrm/hr/exits', formData, {
    idFields: ['employeeId'],
    dateFields: ['resignationDate', 'lastWorkingDate'],
    numericKeys: ['fnfAmount'],
  });
}
export async function deleteExit(id: string) {
  const r = await hrDelete('hr_exits', id);
  revalidatePath('/dashboard/hrm/hr/exits');
  return r;
}

export async function getSuccessionPlans() {
  return hrList<HrSuccessionPlan>('hr_succession_plans');
}
export async function saveSuccessionPlan(_prev: any, formData: FormData) {
  return genericSave('hr_succession_plans', '/dashboard/hrm/hr/succession', formData, {
    jsonKeys: ['successors'],
  });
}
export async function deleteSuccessionPlan(id: string) {
  const r = await hrDelete('hr_succession_plans', id);
  revalidatePath('/dashboard/hrm/hr/succession');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Bulk actions (§1D Deep-list template) — performance + engagement
 *
 *  Used by the deepened list pages at:
 *    /dashboard/crm/hr/{okrs,feedback-360,one-on-ones,recognition,surveys}
 *
 *  Each action is multi-tenant (hrBulk* uses requireSession internally)
 *  and revalidates both the crm and hrm twin paths so either route
 *  reflects fresh data after a bulk op.
 * ══════════════════════════════════════════════════════════════════ */

function revalidatePair(slug: string): void {
  revalidatePath(`/dashboard/crm/hr/${slug}`);
  revalidatePath(`/dashboard/hrm/hr/${slug}`);
}

/* ── OKRs ─────────────────────────────────────────────────────── */

export async function bulkDeleteOkrs(ids: string[]) {
  const r = await hrBulkDelete('hr_okrs', ids);
  revalidatePair('okrs');
  return r;
}
export async function bulkArchiveOkrs(ids: string[]) {
  const r = await hrBulkArchive('hr_okrs', ids);
  revalidatePair('okrs');
  return r;
}

/* ── 360 feedback ─────────────────────────────────────────────── */

export async function bulkDeleteFeedback360(ids: string[]) {
  const r = await hrBulkDelete('hr_feedback_360', ids);
  revalidatePair('feedback-360');
  return r;
}
export async function bulkArchiveFeedback360(ids: string[]) {
  const r = await hrBulkArchive('hr_feedback_360', ids);
  revalidatePair('feedback-360');
  return r;
}
export async function bulkRemindFeedback360(ids: string[]) {
  const r = await hrBulkMarkReminder('hr_feedback_360', ids);
  revalidatePair('feedback-360');
  return r;
}

/* ── 1:1s ─────────────────────────────────────────────────────── */

export async function bulkDeleteOneOnOnes(ids: string[]) {
  const r = await hrBulkDelete('hr_one_on_ones', ids);
  revalidatePair('one-on-ones');
  return r;
}
export async function bulkArchiveOneOnOnes(ids: string[]) {
  const r = await hrBulkArchive('hr_one_on_ones', ids);
  revalidatePair('one-on-ones');
  return r;
}
export async function bulkRemindOneOnOnes(ids: string[]) {
  const r = await hrBulkMarkReminder('hr_one_on_ones', ids);
  revalidatePair('one-on-ones');
  return r;
}

/* ── Recognition ──────────────────────────────────────────────── */

export async function bulkDeleteRecognitions(ids: string[]) {
  const r = await hrBulkDelete('hr_recognitions', ids);
  revalidatePair('recognition');
  return r;
}
export async function bulkArchiveRecognitions(ids: string[]) {
  const r = await hrBulkArchive('hr_recognitions', ids);
  revalidatePair('recognition');
  return r;
}

/* ── Surveys ──────────────────────────────────────────────────── */

export async function bulkDeleteSurveys(ids: string[]) {
  const r = await hrBulkDelete('hr_surveys', ids);
  revalidatePair('surveys');
  return r;
}
export async function bulkArchiveSurveys(ids: string[]) {
  const r = await hrBulkArchive('hr_surveys', ids);
  revalidatePair('surveys');
  return r;
}
export async function bulkRemindSurveys(ids: string[]) {
  const r = await hrBulkMarkReminder('hr_surveys', ids);
  revalidatePair('surveys');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Bulk actions (§1D Deep-list template) — people-ops
 *
 *  Welcome kits / compensation bands / expense claims / travel.
 *  Probation lives in `crm-probation.actions.ts` and ships its own
 *  bulk helpers there.
 * ══════════════════════════════════════════════════════════════════ */

/* ── Welcome kits ─────────────────────────────────────────────── */

export async function bulkDeleteWelcomeKits(ids: string[]) {
  const r = await hrBulkDelete('hr_welcome_kits', ids);
  revalidatePair('welcome-kit');
  return r;
}
export async function bulkArchiveWelcomeKits(ids: string[]) {
  const r = await hrBulkArchive('hr_welcome_kits', ids);
  revalidatePair('welcome-kit');
  return r;
}
export async function bulkMarkWelcomeKitsSent(ids: string[]) {
  const r = await hrBulkUpdateStatus('hr_welcome_kits', ids, 'sent', {
    sent_date: new Date(),
  });
  revalidatePair('welcome-kit');
  return r;
}

/* ── Compensation bands ───────────────────────────────────────── */

export async function bulkDeleteCompensationBands(ids: string[]) {
  const r = await hrBulkDelete('hr_compensation_bands', ids);
  revalidatePair('compensation-bands');
  return r;
}
export async function bulkArchiveCompensationBands(ids: string[]) {
  const r = await hrBulkArchive('hr_compensation_bands', ids);
  revalidatePair('compensation-bands');
  return r;
}

/* ── Expense claims ───────────────────────────────────────────── */

export async function bulkDeleteExpenseClaims(ids: string[]) {
  const r = await hrBulkDelete('hr_expense_claims', ids);
  revalidatePair('expense-claims');
  return r;
}
export async function bulkApproveExpenseClaims(ids: string[]) {
  const r = await hrBulkUpdateStatus('hr_expense_claims', ids, 'approved', {
    approvedAt: new Date(),
  });
  revalidatePair('expense-claims');
  return r;
}
export async function bulkRejectExpenseClaims(ids: string[]) {
  const r = await hrBulkUpdateStatus('hr_expense_claims', ids, 'rejected', {
    rejectedAt: new Date(),
  });
  revalidatePair('expense-claims');
  return r;
}
export async function bulkReimburseExpenseClaims(ids: string[]) {
  const r = await hrBulkUpdateStatus('hr_expense_claims', ids, 'reimbursed', {
    reimbursedAt: new Date(),
  });
  revalidatePair('expense-claims');
  return r;
}

/* ── Travel requests ──────────────────────────────────────────── */

export async function bulkDeleteTravelRequests(ids: string[]) {
  const r = await hrBulkDelete('hr_travel_requests', ids);
  revalidatePair('travel');
  return r;
}
export async function bulkApproveTravelRequests(ids: string[]) {
  const r = await hrBulkUpdateStatus('hr_travel_requests', ids, 'approved', {
    approvedAt: new Date(),
  });
  revalidatePair('travel');
  return r;
}
export async function bulkRejectTravelRequests(ids: string[]) {
  const r = await hrBulkUpdateStatus('hr_travel_requests', ids, 'rejected', {
    rejectedAt: new Date(),
  });
  revalidatePair('travel');
  return r;
}
export async function bulkCompleteTravelRequests(ids: string[]) {
  const r = await hrBulkUpdateStatus('hr_travel_requests', ids, 'completed', {
    completedAt: new Date(),
  });
  revalidatePair('travel');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  KPIs (§1D Deep-list template) — people-ops
 *
 *  Each helper is multi-tenant via hrList (which scopes by userId).
 *  Returning derived aggregates rather than raw counts keeps the
 *  client lightweight and avoids re-counting in render.
 * ══════════════════════════════════════════════════════════════════ */

export interface HrWelcomeKitKpis {
  total: number;
  pending: number;
  sent: number;
  expiringSoon: number;
  byPhase: { onboarding: number; preboarding: number };
}

export async function getWelcomeKitKpis(): Promise<HrWelcomeKitKpis> {
  const empty: HrWelcomeKitKpis = {
    total: 0,
    pending: 0,
    sent: 0,
    expiringSoon: 0,
    byPhase: { onboarding: 0, preboarding: 0 },
  };
  const rows = await hrList<any>('hr_welcome_kits');
  if (!rows) return empty;
  const now = new Date();
  const in14 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  let pending = 0;
  let sent = 0;
  let expiring = 0;
  let onboarding = 0;
  let preboarding = 0;
  for (const r of rows as any[]) {
    const status = String(r.status ?? 'pending');
    if (status === 'pending') pending++;
    else if (status === 'sent') sent++;
    const phase = String(r.phase ?? r.employee_phase ?? '');
    if (phase === 'preboarding') preboarding++;
    else onboarding++;
    if (Array.isArray(r.items)) {
      for (const it of r.items) {
        const exp = it?.expiresAt ? new Date(it.expiresAt) : null;
        if (exp && !isNaN(exp.getTime()) && exp >= now && exp <= in14) {
          expiring++;
          break;
        }
      }
    }
  }
  return {
    total: rows.length,
    pending,
    sent,
    expiringSoon: expiring,
    byPhase: { onboarding, preboarding },
  };
}

export interface HrCompensationBandKpis {
  total: number;
  distinctLevels: number;
  avgMinSalary: number;
  avgMaxSalary: number;
  bandsDueReview: number;
  byLevel: Array<{ level: string; count: number }>;
}

export async function getCompensationBandKpis(): Promise<HrCompensationBandKpis> {
  const empty: HrCompensationBandKpis = {
    total: 0,
    distinctLevels: 0,
    avgMinSalary: 0,
    avgMaxSalary: 0,
    bandsDueReview: 0,
    byLevel: [],
  };
  const rows = await hrList<any>('hr_compensation_bands');
  if (!rows || rows.length === 0) return empty;
  const now = new Date();
  const dueCutoff = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
  const levelMap = new Map<string, number>();
  let minSum = 0;
  let minCount = 0;
  let maxSum = 0;
  let maxCount = 0;
  let due = 0;
  for (const r of rows as any[]) {
    const level = String(r.level ?? '').trim();
    if (level) levelMap.set(level, (levelMap.get(level) ?? 0) + 1);
    const minS = Number(r.min_salary ?? r.minSalary);
    const maxS = Number(r.max_salary ?? r.maxSalary);
    if (Number.isFinite(minS) && minS > 0) {
      minSum += minS;
      minCount++;
    }
    if (Number.isFinite(maxS) && maxS > 0) {
      maxSum += maxS;
      maxCount++;
    }
    const last = r.lastReviewedAt ? new Date(r.lastReviewedAt) : (r.updatedAt ? new Date(r.updatedAt) : null);
    if (last && !isNaN(last.getTime()) && last < dueCutoff) due++;
  }
  return {
    total: rows.length,
    distinctLevels: levelMap.size,
    avgMinSalary: minCount > 0 ? Math.round(minSum / minCount) : 0,
    avgMaxSalary: maxCount > 0 ? Math.round(maxSum / maxCount) : 0,
    bandsDueReview: due,
    byLevel: Array.from(levelMap.entries())
      .map(([level, count]) => ({ level, count }))
      .sort((a, b) => b.count - a.count),
  };
}

export interface HrExpenseClaimKpis {
  total: number;
  pending: number;
  approvedThisMonth: number;
  rejected: number;
  totalClaimed: number;
  approvedAmount: number;
}

export async function getExpenseClaimKpis(): Promise<HrExpenseClaimKpis> {
  const empty: HrExpenseClaimKpis = {
    total: 0,
    pending: 0,
    approvedThisMonth: 0,
    rejected: 0,
    totalClaimed: 0,
    approvedAmount: 0,
  };
  const rows = await hrList<any>('hr_expense_claims');
  if (!rows) return empty;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  let pending = 0;
  let approvedThisMonth = 0;
  let rejected = 0;
  let totalClaimed = 0;
  let approvedAmount = 0;
  for (const r of rows as any[]) {
    const amt = Number(r.amount) || 0;
    totalClaimed += amt;
    const status = String(r.status ?? 'pending');
    if (status === 'pending') pending++;
    else if (status === 'rejected') rejected++;
    else if (status === 'approved' || status === 'reimbursed') {
      approvedAmount += amt;
      const when = r.approvedAt
        ? new Date(r.approvedAt)
        : r.updatedAt
          ? new Date(r.updatedAt)
          : null;
      if (when && !isNaN(when.getTime()) && when >= monthStart && when < monthEnd) {
        approvedThisMonth++;
      }
    }
  }
  return {
    total: rows.length,
    pending,
    approvedThisMonth,
    rejected,
    totalClaimed,
    approvedAmount,
  };
}

export interface HrTravelRequestKpis {
  total: number;
  pendingApproval: number;
  totalSpendMtd: number;
  approved: number;
  topDestination: { destination: string; count: number } | null;
}

export async function getTravelRequestKpis(): Promise<HrTravelRequestKpis> {
  const empty: HrTravelRequestKpis = {
    total: 0,
    pendingApproval: 0,
    totalSpendMtd: 0,
    approved: 0,
    topDestination: null,
  };
  const rows = await hrList<any>('hr_travel_requests');
  if (!rows) return empty;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  let pendingApproval = 0;
  let approved = 0;
  let totalSpendMtd = 0;
  const destCount = new Map<string, number>();
  for (const r of rows as any[]) {
    const status = String(r.status ?? 'pending');
    if (status === 'pending') pendingApproval++;
    if (status === 'approved' || status === 'completed') approved++;
    const from = r.fromDate ? new Date(r.fromDate) : null;
    if (from && !isNaN(from.getTime()) && from >= monthStart && from < monthEnd) {
      totalSpendMtd += Number(r.estimatedCost) || 0;
    }
    const dest = String(r.destination ?? '').trim();
    if (dest) destCount.set(dest, (destCount.get(dest) ?? 0) + 1);
  }
  let top: { destination: string; count: number } | null = null;
  for (const [destination, count] of destCount.entries()) {
    if (!top || count > top.count) top = { destination, count };
  }
  return {
    total: rows.length,
    pendingApproval,
    totalSpendMtd,
    approved,
    topDestination: top,
  };
}

/* ═══════════════════════════════════════════════════════════════════
 *  Certifications — KPIs + bulk (§1D Deep template)
 * ══════════════════════════════════════════════════════════════════ */

export interface HrCertificationKpis {
  totalAwarded: number;
  expiring30: number;
  expired: number;
  topCert?: { name: string; count: number };
}

/**
 * Aggregate top-line KPIs for certifications: total · expiring next 30
 * days · already expired · the most-common certification by name.
 *
 * "Total awarded" counts every issued credential row regardless of
 * expiry. "Top cert" returns `undefined` when there are no rows.
 */
export async function getCertificationKpis(): Promise<HrCertificationKpis> {
  const empty: HrCertificationKpis = {
    totalAwarded: 0,
    expiring30: 0,
    expired: 0,
  };
  const rows = await hrList<any>('hr_certifications');
  if (!rows) return empty;
  const now = Date.now();
  const window30 = 30 * 24 * 60 * 60 * 1000;
  let expiring30 = 0;
  let expired = 0;
  const nameCount = new Map<string, number>();
  for (const r of rows as any[]) {
    const doesNotExpire = String(r.doesNotExpire ?? '').toLowerCase() === 'yes';
    if (!doesNotExpire && r.expiresAt) {
      const exp = new Date(r.expiresAt).getTime();
      if (Number.isFinite(exp)) {
        if (exp < now) expired += 1;
        else if (exp - now <= window30) expiring30 += 1;
      }
    }
    const nm = String(r.name ?? '').trim();
    if (nm) nameCount.set(nm, (nameCount.get(nm) ?? 0) + 1);
  }
  let topCert: { name: string; count: number } | undefined;
  for (const [name, count] of nameCount.entries()) {
    if (!topCert || count > topCert.count) topCert = { name, count };
  }
  return { totalAwarded: rows.length, expiring30, expired, topCert };
}

/* ═══════════════════════════════════════════════════════════════════
 *  Careers Page — job-posting KPIs (§1D Deep template)
 * ══════════════════════════════════════════════════════════════════ */

export interface HrCareersPageKpis {
  publishedPosts: number;
  applicants: number;
  openPositions: number;
  avgTimeToFillDays?: number;
}

/**
 * Aggregate KPIs for the careers-page surface — derived from
 * `hr_job_postings` (published & open) and `hr_candidates` (applicants
 * total + hired-stage rows for time-to-fill).
 *
 * Time-to-fill averages the days between `postedAt` (on the linked job)
 * and `updatedAt` (when stage flipped to `hired`). When no hires exist,
 * `avgTimeToFillDays` is left undefined so the KPI strip can show "—".
 */
export async function getCareersPageKpis(): Promise<HrCareersPageKpis> {
  const empty: HrCareersPageKpis = {
    publishedPosts: 0,
    applicants: 0,
    openPositions: 0,
  };
  const session = await getSession();
  if (!session?.user) return empty;

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id as string);

    const jobs = (await db
      .collection('hr_job_postings')
      .find({ userId })
      .project({ status: 1, postedAt: 1 })
      .limit(2000)
      .toArray()) as Array<{
      _id: ObjectId;
      status?: string;
      postedAt?: Date | string;
    }>;

    let publishedPosts = 0;
    let openPositions = 0;
    const postedAtByJob = new Map<string, number>();
    for (const j of jobs) {
      const s = String(j.status ?? '');
      if (s === 'open') {
        publishedPosts += 1;
        openPositions += 1;
      } else if (s === 'on-hold' || s === 'closed' || s === 'draft') {
        if (s !== 'draft') publishedPosts += 1;
      }
      if (j.postedAt) {
        const t = new Date(j.postedAt).getTime();
        if (Number.isFinite(t)) postedAtByJob.set(String(j._id), t);
      }
    }

    const candidates = (await db
      .collection('hr_candidates')
      .find({ userId })
      .project({ stage: 1, jobId: 1, updatedAt: 1, createdAt: 1 })
      .limit(5000)
      .toArray()) as Array<{
      stage?: string;
      jobId?: ObjectId | string;
      updatedAt?: Date | string;
      createdAt?: Date | string;
    }>;

    const applicants = candidates.length;
    const fillDays: number[] = [];
    for (const c of candidates) {
      if (String(c.stage ?? '') !== 'hired') continue;
      const job = c.jobId ? postedAtByJob.get(String(c.jobId)) : undefined;
      const hiredAt = c.updatedAt
        ? new Date(c.updatedAt).getTime()
        : c.createdAt
          ? new Date(c.createdAt).getTime()
          : NaN;
      if (Number.isFinite(job) && Number.isFinite(hiredAt) && (hiredAt as number) > (job as number)) {
        const days = ((hiredAt as number) - (job as number)) / (1000 * 60 * 60 * 24);
        if (days >= 0 && days < 365) fillDays.push(days);
      }
    }
    const avgTimeToFillDays =
      fillDays.length > 0
        ? Math.round(fillDays.reduce((a, b) => a + b, 0) / fillDays.length)
        : undefined;

    return { publishedPosts, applicants, openPositions, avgTimeToFillDays };
  } catch (e) {
    console.error('[getCareersPageKpis] failed:', e);
    return empty;
  }
}

/* ═══════════════════════════════════════════════════════════════════
 *  Generic HR bulk action (§1D Deep template)
 *
 *  Used by every HR list page that needs delete / archive / publish /
 *  unpublish across a set of selected rows. Resolves to a uniform
 *  `{ success, affected, error? }` shape regardless of branch taken.
 * ══════════════════════════════════════════════════════════════════ */

export type HrBulkOp = 'delete' | 'archive' | 'publish' | 'unpublish';

export interface HrBulkResult {
  success: boolean;
  affected: number;
  error?: string;
}

export async function bulkHrAction(
  collection: string,
  ids: string[],
  op: HrBulkOp,
  revalidate?: string,
): Promise<HrBulkResult> {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { success: true, affected: 0 };
  }

  let result: { success: boolean; affected: number; error?: string };
  if (op === 'delete') {
    const r = await hrBulkDelete(collection, ids);
    result = { success: r.success, affected: r.deleted, error: r.error };
  } else if (op === 'archive') {
    const r = await hrBulkArchive(collection, ids);
    result = { success: r.success, affected: r.archived, error: r.error };
  } else if (op === 'publish') {
    const r = await hrBulkUpdateStatus(collection, ids, 'published', {
      isPublished: true,
    });
    result = { success: r.success, affected: r.updated, error: r.error };
  } else {
    const r = await hrBulkUpdateStatus(collection, ids, 'draft', {
      isPublished: false,
    });
    result = { success: r.success, affected: r.updated, error: r.error };
  }

  if (revalidate) revalidatePath(revalidate);
  return result;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Bulk actions — recruitment (candidates · interviews · offers)
 *
 *  All are multi-tenant via hrBulk* which requires session internally.
 *  Revalidate both crm + hrm twin paths.
 * ══════════════════════════════════════════════════════════════════ */

/* ── Candidates ───────────────────────────────────────────────── */

export async function bulkShortlistCandidates(ids: string[]) {
  const r = await hrBulkUpdateStatus('hr_candidates', ids, 'screening', {
    shortlistedAt: new Date(),
  });
  revalidatePair('candidates');
  return r;
}
export async function bulkRejectCandidates(ids: string[]) {
  const r = await hrBulkUpdateStatus('hr_candidates', ids, 'rejected', {
    rejectedAt: new Date(),
  });
  revalidatePair('candidates');
  return r;
}
export async function bulkDeleteCandidates(ids: string[]) {
  const r = await hrBulkDelete('hr_candidates', ids);
  revalidatePair('candidates');
  return r;
}

/* ── Interviews ───────────────────────────────────────────────── */

export async function bulkCancelInterviews(ids: string[]) {
  const r = await hrBulkUpdateStatus('hr_interviews', ids, 'cancelled', {
    cancelledAt: new Date(),
  });
  revalidatePair('interviews');
  return r;
}
export async function bulkRescheduleInterviews(ids: string[]) {
  // Mark as rescheduled — caller sets new slot via edit form.
  const r = await hrBulkUpdateStatus('hr_interviews', ids, 'rescheduled');
  revalidatePair('interviews');
  return r;
}
export async function bulkDeleteInterviews(ids: string[]) {
  const r = await hrBulkDelete('hr_interviews', ids);
  revalidatePair('interviews');
  return r;
}

/* ── Offers ───────────────────────────────────────────────────── */

export async function bulkSendOffers(ids: string[]) {
  const r = await hrBulkUpdateStatus('crm_offers', ids, 'sent', {
    sentAt: new Date(),
  });
  revalidatePair('offers');
  return r;
}
export async function bulkRevokeOffers(ids: string[]) {
  const r = await hrBulkUpdateStatus('crm_offers', ids, 'withdrawn', {
    withdrawnAt: new Date(),
  });
  revalidatePair('offers');
  return r;
}
export async function bulkDeleteOffers(ids: string[]) {
  const r = await hrBulkDelete('crm_offers', ids);
  revalidatePair('offers');
  return r;
}

/* ═══════════════════════════════════════════════════════════════════
 *  Bulk actions — weekly timesheets
 * ══════════════════════════════════════════════════════════════════ */

export async function bulkApproveTimesheets(ids: string[]) {
  const r = await hrBulkUpdateStatus('crm_timesheets', ids, 'approved', {
    approvedAt: new Date(),
  });
  revalidatePair('timesheets');
  return r;
}
export async function bulkRejectTimesheets(ids: string[]) {
  const r = await hrBulkUpdateStatus('crm_timesheets', ids, 'rejected', {
    rejectedAt: new Date(),
  });
  revalidatePair('timesheets');
  return r;
}
export async function bulkDeleteTimesheets(ids: string[]) {
  const r = await hrBulkDelete('crm_timesheets', ids);
  revalidatePair('timesheets');
  return r;
}

/* ── Timesheet KPIs ──────────────────────────────────────────── */

export interface HrTimesheetKpis {
  total: number;
  submitted: number;
  approved: number;
  rejected: number;
}

export async function getTimesheetKpis(): Promise<HrTimesheetKpis> {
  const empty: HrTimesheetKpis = { total: 0, submitted: 0, approved: 0, rejected: 0 };
  const rows = await hrList<HrTimesheet>('crm_timesheets');
  if (!rows) return empty;
  let submitted = 0;
  let approved = 0;
  let rejected = 0;
  for (const r of rows as any[]) {
    const s = String(r.status ?? 'draft');
    if (s === 'submitted') submitted++;
    else if (s === 'approved') approved++;
    else if (s === 'rejected') rejected++;
  }
  return { total: rows.length, submitted, approved, rejected };
}

/* ═══════════════════════════════════════════════════════════════════
 *  Bulk actions + KPIs — disciplinary cases
 * ══════════════════════════════════════════════════════════════════ */

export interface HrDisciplinaryCase {
  _id: string;
  caseNo?: string;
  employeeId?: string;
  employeeName?: string;
  severity?: string;
  type?: string;
  raisedById?: string;
  raisedByName?: string;
  decision?: string;
  status?: string;
  createdAt?: string;
  resolvedAt?: string;
}

/* export async function getDisciplinaryCases(): Promise<HrDisciplinaryCase[]> {
  const session = await getSession();
  if (!session?.user?._id) return [];
  try {
    const { db } = await connectToDatabase();
    const docs = await db
      .collection('crm_disciplinary_cases')
      .find({ userId: new ObjectId(session.user._id as string) })
      .sort({ createdAt: -1 })
      .limit(500)
      .toArray();
    return JSON.parse(JSON.stringify(docs)) as HrDisciplinaryCase[];
  } catch {
    return [];
  }
} */

export async function bulkCloseDisciplinaryCases(ids: string[]) {
  const r = await hrBulkUpdateStatus('crm_disciplinary_cases', ids, 'closed', {
    resolvedAt: new Date(),
  });
  revalidatePair('disciplinary');
  return r;
}
export async function bulkArchiveDisciplinaryCases(ids: string[]) {
  const r = await hrBulkArchive('crm_disciplinary_cases', ids);
  revalidatePair('disciplinary');
  return r;
}
export async function bulkDeleteDisciplinaryCases(ids: string[]) {
  const r = await hrBulkDelete('crm_disciplinary_cases', ids);
  revalidatePair('disciplinary');
  return r;
}

export interface HrDisciplinaryKpis {
  total: number;
  open: number;
  resolved: number;
  warningsIssued: number;
}

export async function getDisciplinaryKpis(): Promise<HrDisciplinaryKpis> {
  const empty: HrDisciplinaryKpis = { total: 0, open: 0, resolved: 0, warningsIssued: 0 };
  const rows = await hrList<any>('crm_disciplinary_cases');
  if (!rows) return empty;
  let open = 0;
  let resolved = 0;
  let warnings = 0;
  for (const r of rows as any[]) {
    const s = String(r.status ?? 'open').toLowerCase();
    if (s === 'open' || s === 'under_review') open++;
    else if (s === 'resolved' || s === 'dismissed' || s === 'closed') resolved++;
    const t = String(r.type ?? '').toLowerCase();
    if (t === 'warning' || t === 'written_warning' || t === 'verbal_warning') warnings++;
  }
  return { total: rows.length, open, resolved, warningsIssued: warnings };
}

/* ═══════════════════════════════════════════════════════════════════
 *  KPIs — recruitment (candidates · jobs · interviews · offers)
 *
 *  Re-exports forbidden in a `'use server'` file, so we call-forward via
 *  async wrappers. Pages that need the TYPES must import them directly
 *  from `@/app/actions/hr-recruitment-kpis.actions`.
 * ══════════════════════════════════════════════════════════════════ */

import {
  getCandidateKpis as _getCandidateKpis,
  getJobKpis as _getJobKpis,
  getInterviewKpis as _getInterviewKpis,
  getOfferKpis as _getOfferKpis,
} from './hr-recruitment-kpis.actions';

export async function getCandidateKpis() { return _getCandidateKpis(); }
export async function getJobKpis() { return _getJobKpis(); }
export async function getInterviewKpis() { return _getInterviewKpis(); }
export async function getOfferKpis() { return _getOfferKpis(); }
