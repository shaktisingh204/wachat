/**
 * Community, Partners & GTM types.
 *
 * Multi-tenant: every entity carries the tenant id of the workspace that owns
 * it (or, for global registries like the public roadmap, the tenant that
 * voted/submitted). Plan-gated and RBAC-guarded operations live in the
 * sibling modules; this file only describes shapes.
 */

import 'server-only';

// ── Partners ─────────────────────────────────────────────────────────────────

export type PartnerTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export type PartnerSpecialty =
  | 'whatsapp'
  | 'crm'
  | 'seo'
  | 'automation'
  | 'commerce'
  | 'ai'
  | 'integrations';

export type PartnerStatus = 'pending' | 'active' | 'suspended' | 'churned';

export interface Partner {
  _id?: string;
  /** Tenant id of the partner workspace. */
  tenantId: string;
  /** Public display name (company / agency). */
  name: string;
  /** URL-safe slug used in the public directory. */
  slug: string;
  description?: string;
  websiteUrl?: string;
  logoUrl?: string;
  /** ISO-3166-1 alpha-2 region/country codes the partner serves. */
  regions: string[];
  specialties: PartnerSpecialty[];
  tier: PartnerTier;
  status: PartnerStatus;
  /** Number of employees who passed at least one certification. */
  certifiedEmployees: number;
  /** Number of currently-active downstream tenants the partner manages. */
  activeTenants: number;
  /** Lifetime referred-ARR in the smallest unit of `currency`. */
  referredArr: number;
  /** ISO-4217 currency code for `referredArr`. */
  currency: string;
  contactEmail?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Certifications ───────────────────────────────────────────────────────────

export type CertificationLevel = 'foundation' | 'professional' | 'expert';

export interface CertificationExamQuestion {
  /** Stable id for grading. */
  id: string;
  prompt: string;
  options: string[];
  /** Index into `options` of the correct answer. */
  correctIndex: number;
}

export interface CertificationExam {
  _id?: string;
  examId: string;
  certificationId: string;
  title: string;
  level: CertificationLevel;
  /** Total time allowed, seconds. */
  durationSec: number;
  /** Minimum % required to pass (0–100). */
  passingScore: number;
  questions: CertificationExamQuestion[];
}

export type CertificationStatus = 'issued' | 'expired' | 'revoked';

export interface Certification {
  _id?: string;
  certificationId: string;
  userId: string;
  tenantId: string;
  examId: string;
  title: string;
  level: CertificationLevel;
  /** % score, 0–100. */
  score: number;
  status: CertificationStatus;
  issuedAt: Date;
  expiresAt?: Date;
  revokedAt?: Date;
  revokedReason?: string;
  /** Public verification URL slug. */
  certificateNumber: string;
}

export interface ExamAttempt {
  _id?: string;
  attemptId: string;
  examId: string;
  userId: string;
  startedAt: Date;
  submittedAt?: Date;
  /** Map of questionId → chosen option index. */
  answers: Record<string, number>;
  score?: number;
  passed?: boolean;
}

// ── Referrals ────────────────────────────────────────────────────────────────

export type ReferralStatus = 'pending' | 'qualified' | 'converted' | 'rejected';

export interface Referral {
  _id?: string;
  referralId: string;
  /** Partner / tenant that owns the referral link. */
  partnerTenantId: string;
  /** Tracking code embedded in the referral URL. */
  code: string;
  /** Referee identification (email, tenant id once converted). */
  refereeEmail?: string;
  refereeTenantId?: string;
  /** Referee plan id once converted. */
  planId?: string;
  /** Referee MRR in smallest currency unit. */
  monthlyRevenue?: number;
  currency?: string;
  status: ReferralStatus;
  /** Commission paid out to the partner so far. */
  commissionPaid: number;
  /** Reward given back to the referee (double-sided). */
  refereeReward: number;
  createdAt: Date;
  convertedAt?: Date;
}

// ── Public Roadmap ───────────────────────────────────────────────────────────

export type RoadmapStatus = 'submitted' | 'planned' | 'in_progress' | 'shipped' | 'declined';

export interface RoadmapItem {
  _id?: string;
  itemId: string;
  title: string;
  description: string;
  category: string;
  status: RoadmapStatus;
  /** Sum of vote weights. */
  votes: number;
  /** Count of distinct tenants that voted. */
  voterCount: number;
  /** Submitter tenant. */
  submittedByTenantId?: string;
  createdAt: Date;
  updatedAt: Date;
  shippedAt?: Date;
}

export interface RoadmapVote {
  _id?: string;
  itemId: string;
  tenantId: string;
  userId: string;
  /** Plan-weighted vote weight. */
  weight: number;
  votedAt: Date;
}

// ── Community / Ambassadors ──────────────────────────────────────────────────

export type CommunityRole = 'member' | 'contributor' | 'moderator' | 'ambassador';

export interface CommunityMember {
  _id?: string;
  userId: string;
  tenantId: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  /** Discourse / forum username, set after SSO link. */
  forumUsername?: string;
  role: CommunityRole;
  /** Karma / points accumulated through forum activity. */
  points: number;
  joinedAt: Date;
}

export interface Ambassador {
  _id?: string;
  ambassadorId: string;
  userId: string;
  tenantId: string;
  /** Public profile slug. */
  slug: string;
  displayName: string;
  region: string;
  bio: string;
  avatarUrl?: string;
  socials: Partial<Record<'twitter' | 'linkedin' | 'youtube' | 'github', string>>;
  /** Yearly cohort (e.g. "2026"). */
  cohort: string;
  active: boolean;
  joinedAt: Date;
}

// ── Webinars / Events ────────────────────────────────────────────────────────

export type WebinarStatus = 'scheduled' | 'live' | 'ended' | 'cancelled';

export interface Webinar {
  _id?: string;
  webinarId: string;
  title: string;
  description: string;
  hostName: string;
  /** Room / meeting URL once the session is live. */
  roomUrl?: string;
  /** Recording playback URL once available. */
  recordingUrl?: string;
  startsAt: Date;
  durationMin: number;
  status: WebinarStatus;
  registrants: WebinarRegistrant[];
  /** Tenant id that scheduled the webinar (typically the SabNode workspace). */
  hostTenantId: string;
}

export interface WebinarRegistrant {
  email: string;
  name: string;
  tenantId?: string;
  registeredAt: Date;
  attended?: boolean;
  /** Captured for marketing follow-up. */
  utmSource?: string;
}

export interface MeetupEvent {
  _id?: string;
  eventId: string;
  title: string;
  description: string;
  city: string;
  region: string;
  venue?: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  rsvps: { userId: string; tenantId?: string; rsvpedAt: Date }[];
  organizerUserId: string;
}

// ── Case Studies ─────────────────────────────────────────────────────────────

export type CaseStudyStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'published';

export interface CaseStudy {
  _id?: string;
  caseStudyId: string;
  tenantId: string;
  title: string;
  customer: string;
  industry: string;
  summary: string;
  body: string;
  metrics: { label: string; value: string }[];
  heroImageUrl?: string;
  status: CaseStudyStatus;
  submittedByUserId: string;
  reviewedByUserId?: string;
  reviewedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
}

// ── Newsletter ───────────────────────────────────────────────────────────────

export type NewsletterStatus = 'active' | 'unsubscribed' | 'bounced';

export interface NewsletterSubscriber {
  _id?: string;
  email: string;
  tenantId?: string;
  status: NewsletterStatus;
  /** Marketing tags / segments. */
  tags: string[];
  subscribedAt: Date;
  unsubscribedAt?: Date;
}

export interface Newsletter {
  _id?: string;
  newsletterId: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  /** Tag filter — empty array means everyone. */
  segments: string[];
  status: 'draft' | 'scheduled' | 'sending' | 'sent';
  scheduledFor?: Date;
  sentAt?: Date;
  /** Aggregated send metrics. */
  metrics: { sent: number; opened: number; clicked: number; bounced: number };
  createdAt: Date;
  createdByUserId: string;
}
