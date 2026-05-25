import type { ObjectId } from 'mongodb';

/**
 * HR types for the dedicated HR module (distinct from the older
 * hr-payroll module, which focuses on attendance/salary/tax).
 * Every entity carries `userId` for tenant isolation and optional
 * `createdAt`/`updatedAt` timestamps.
 */

type Owned = {
  _id: ObjectId;
  userId: ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};

/* ── Recruitment & Hiring ─────────────────────────────────────── */

export type HrJobPosting = Owned & {
  title: string;
  department?: string;
  location?: string;
  employmentType: 'full-time' | 'part-time' | 'contract' | 'internship';
  status: 'draft' | 'open' | 'on-hold' | 'closed';
  description?: string;
  responsibilities?: string;
  requirements?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  applyUrl?: string;
  postedAt?: Date;
};

export type HrCandidate = Owned & {
  jobId?: ObjectId;
  name: string;
  email?: string;
  phone?: string;
  resumeUrl?: string;
  source?: string;
  stage:
    | 'new'
    | 'screening'
    | 'interview'
    | 'offer'
    | 'hired'
    | 'rejected';
  rating?: number;
  notes?: string;
};

export type HrInterview = Owned & {
  candidateId: ObjectId;
  roundNumber: number;
  roundName?: string;
  interviewerName?: string;
  interviewerEmail?: string;
  interviewerPhone?: string;
  scheduledAt: Date;
  durationMinutes?: number;
  type?: string;
  location?: string;
  meetingLink?: string;
  mode: 'in-person' | 'phone' | 'video';
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show';
  result?: string;
  rating?: number;
  strengths?: string;
  weaknesses?: string;
  feedback?: string;
  recommendation?: 'strong-hire' | 'hire' | 'no-hire' | 'strong-no-hire';
};

export type HrOfferLetter = Owned & {
  candidateId: ObjectId;
  jobTitle: string;
  ctc: number;
  currency: string;
  joiningDate: Date;
  status: 'draft' | 'sent' | 'accepted' | 'declined' | 'withdrawn';
  sentAt?: Date;
  respondedAt?: Date;
  notes?: string;
};

export type HrCareersPageConfig = Owned & {
  headline?: string;
  intro?: string;
  logoUrl?: string;
  primaryColor?: string;
  ctaLabel?: string;
  slug?: string;
  isPublished?: boolean;
};

/* ── Onboarding ───────────────────────────────────────────────── */

export type HrOnboardingTemplate = Owned & {
  name: string;
  description?: string;
  tasks: { title: string; dueDays?: number; assignee?: string }[];
};

export type HrWelcomeKit = Owned & {
  name: string;
  description?: string;
  items: { label: string; note?: string }[];
};

export type HrProbation = Owned & {
  employeeId: ObjectId;
  startDate: Date;
  endDate: Date;
  status: 'active' | 'passed' | 'extended' | 'terminated';
  reviewerName?: string;
  notes?: string;
};

/* ── Employee Services ────────────────────────────────────────── */

export type HrAnnouncement = Owned & {
  title: string;
  body: string;
  audience: 'all' | 'department' | 'team';
  departmentId?: ObjectId;
  pinned?: boolean;
  publishAt?: Date;
};

export type HrPolicy = Owned & {
  title: string;
  category?: string;
  body: string;
  version?: string;
  effectiveDate?: Date;
  status?: 'draft' | 'active' | 'archived';
  appliesTo?: string;
  attachmentUrl?: string;
};

/* ── Documents ────────────────────────────────────────────────── */

export type HrDocument = Owned & {
  employeeId?: ObjectId;
  name: string;
  category?: string;
  url?: string;
  expiresAt?: Date;
  isConfidential?: boolean;
  notes?: string;
};

export type HrDocumentTemplate = Owned & {
  name: string;
  category?: string;
  body: string;
  placeholders?: string[];
};

/* ── Training & Development ───────────────────────────────────── */

export type HrTrainingProgram = Owned & {
  name: string;
  description?: string;
  duration?: string;
  trainer?: string;
  startDate?: Date;
  endDate?: Date;
  status: 'draft' | 'scheduled' | 'running' | 'completed';
};

export type HrCertification = Owned & {
  employeeId: ObjectId;
  name: string;
  issuer?: string;
  issuedAt?: Date;
  expiresAt?: Date;
  credentialId?: string;
};

export type HrLearningPath = Owned & {
  name: string;
  description?: string;
  steps: { title: string; link?: string }[];
};

/* ── Performance ──────────────────────────────────────────────── */

export type HrOkr = Owned & {
  employeeId?: ObjectId;
  quarter: string;
  objective: string;
  keyResults: { description: string; progress?: number }[];
  status: 'draft' | 'in-progress' | 'achieved' | 'missed';
};

export type HrFeedback360 = Owned & {
  employeeId: ObjectId;
  reviewerName: string;
  reviewerType: 'peer' | 'manager' | 'report' | 'self';
  strengths?: string;
  improvements?: string;
  rating?: number;
  submittedAt?: Date;
};

export type HrOneOnOne = Owned & {
  employeeId: ObjectId;
  managerName?: string;
  scheduledAt: Date;
  agenda?: string;
  notes?: string;
  actionItems?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
};

/* ── Time & Expense ───────────────────────────────────────────── */

export type HrTimesheet = Owned & {
  employeeId: ObjectId;
  weekStart: Date;
  totalHours: number;
  entries: { day: string; hours: number; project?: string; notes?: string }[];
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
};

export type HrTravelRequest = Owned & {
  employeeId: ObjectId;
  destination: string;
  purpose?: string;
  fromDate: Date;
  toDate: Date;
  estimatedCost?: number;
  currency?: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
};

export type HrExpenseClaim = Owned & {
  employeeId: ObjectId;
  title: string;
  amount: number;
  currency: string;
  category?: string;
  receiptUrl?: string;
  incurredAt: Date;
  status: 'pending' | 'approved' | 'rejected' | 'reimbursed';
};

/* ── Assets ───────────────────────────────────────────────────── */

export type HrAsset = Owned & {
  name: string;
  category?: string;
  serialNumber?: string;
  assetTag?: string;
  location?: string;
  purchaseDate?: Date;
  purchaseCost?: number;
  currency?: string;
  warrantyExpiresAt?: Date;
  condition?: 'new' | 'good' | 'fair' | 'poor' | 'retired';
  notes?: string;
};

export type HrAssetAssignment = Owned & {
  assetId: ObjectId;
  employeeId: ObjectId;
  assignedAt: Date;
  returnedAt?: Date;
  status: 'assigned' | 'returned';
  notes?: string;
};

/* ── Engagement ───────────────────────────────────────────────── */

export type HrRecognition = Owned & {
  employeeId: ObjectId;
  fromName?: string;
  type: 'kudos' | 'spot-award' | 'performance' | 'values';
  category?: string;
  message: string;
  points?: number;
  visibility?: 'public' | 'private' | 'team';
  givenAt: Date;
};

export type HrSurvey = Owned & {
  title: string;
  description?: string;
  questions: { prompt: string; type: 'rating' | 'text' | 'yes-no' }[];
  status: 'draft' | 'open' | 'closed';
  responsesCount?: number;
};

/* ── Compensation ─────────────────────────────────────────────── */

export type HrCompensationBand = Owned & {
  title: string;
  level: string;
  minSalary: number;
  maxSalary: number;
  currency: string;
  notes?: string;
};

/* ── Exit & Succession ───────────────────────────────────────── */

export type HrExit = Owned & {
  employeeId: ObjectId;
  exitType: 'resignation' | 'termination' | 'retirement' | 'contract-end';
  resignationDate?: Date;
  lastWorkingDate: Date;
  reason?: string;
  interviewNotes?: string;
  fnfAmount?: number;
  fnfStatus?: 'pending' | 'cleared';
};

export type HrSuccessionPlan = Owned & {
  roleTitle: string;
  incumbentName?: string;
  successors: { name: string; readiness: 'ready' | '6-12m' | '1-3y' }[];
  notes?: string;
};

/* ── Services Module: Projects, Contracts, Tickets ────────────── */

export type HrProject = Owned & {
  name: string;
  clientId?: ObjectId;
  clientName?: string;
  description?: string;
  status: 'planning' | 'active' | 'on-hold' | 'completed' | 'cancelled';
  startDate?: Date;
  endDate?: Date;
  progress?: number;
  budget?: number;
  currency?: string;
  managerName?: string;
};

export type HrProjectTask = Owned & {
  projectId: ObjectId;
  title: string;
  description?: string;
  assigneeName?: string;
  status: 'todo' | 'in-progress' | 'review' | 'done';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  startDate?: Date;
  dueDate?: Date;
  estimatedHours?: number;
  actualHours?: number;
};

/**
 * Per-signer record inside `HrContract.signers[]`.
 *
 * Signed via the public `/sign/[contractId]/[signerToken]` flow.
 * `token` is single-use — set to a 64-char hex on send and zeroed in
 * `tokenUsedAt` after the signer completes.
 */
export type HrContractSigner = {
  name?: string;
  email: string;
  role?: string;
  /** Position in the signing order (0 = first). */
  order?: number;
  /** Single-use magic-link token. */
  token?: string;
  tokenIssuedAt?: Date;
  tokenUsedAt?: Date | null;
  signedAt?: Date;
  signatureMethod?: 'typed' | 'drawn' | 'uploaded';
  /** Typed name (typed) · data:URL (drawn) · SabFiles node id (uploaded). */
  signatureData?: string;
  signedFromIp?: string;
  signedFromUserAgent?: string;
  signedFromGeo?: { country?: string; city?: string };
};

export type HrContract = Owned & {
  title: string;
  clientId?: ObjectId;
  clientName?: string;
  value?: number;
  currency?: string;
  startDate?: Date;
  endDate?: Date;
  status:
    | 'draft'
    | 'sent'
    | 'partially_signed'
    | 'signed'
    | 'completed'
    | 'expired'
    | 'terminated'
    | 'voided';
  body?: string;
  signedAt?: Date;
  signedByName?: string;
  signedByEmail?: string;
  signatureDataUrl?: string;
  /** Counter-party recipients of the public sign flow. */
  signers?: HrContractSigner[];
  /** Choice of e-sign delivery; defaults to `internal`. */
  esignProvider?: 'internal' | 'digio' | 'docusign' | 'aadhaar' | 'none';
};

export type HrTicket = Owned & {
  subject: string;
  description?: string;
  clientId?: ObjectId;
  clientName?: string;
  requesterEmail?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in-progress' | 'waiting' | 'resolved' | 'closed';
  assigneeId?: ObjectId;
  assigneeName?: string;
  categoryId?: ObjectId;
  category?: string;
  firstResponseAt?: Date;
  resolvedAt?: Date;
};
