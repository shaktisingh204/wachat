'use server';

import { revalidatePath } from 'next/cache';
import { hrList, hrGetById, hrSave, hrDelete, formToObject } from '@/lib/hr-crud';
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
  } = {},
): Promise<FormState> {
  try {
    const data = formToObject(formData, options.numericKeys || []);
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
    numericKeys: ['ctc'],
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
export async function saveOnboardingTemplate(_prev: any, formData: FormData) {
  return genericSave(
    'hr_onboarding_templates',
    '/dashboard/hrm/hr/onboarding',
    formData,
    { jsonKeys: ['tasks'] },
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
      dateFields: ['assignedAt', 'returnedAt'],
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
    { numericKeys: ['minSalary', 'maxSalary'] },
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
