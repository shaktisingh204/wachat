'use server';

/**
 * HR recruitment KPI server actions — P1.1B Wave 6 (§1D.1).
 *
 * Wave-6 spec calls out four KPI aggregates that drive the recruitment
 * list-page strips:
 *
 *   • getCandidateKpis()  → New applications · In screening · In
 *                            interview · Offered · Hired
 *   • getJobKpis()        → Open · Closed · Total applicants ·
 *                            Avg time-to-fill (days) · Cost-per-hire
 *   • getInterviewKpis()  → Today · This week · Scheduled · Completed ·
 *                            No-shows
 *   • getOfferKpis()      → Sent · Accepted · Declined · Pending ·
 *                            Avg negotiation time (hours)
 *
 * All of these are tenant-scoped via `requireSession()` — no
 * cross-tenant reads possible. Each returns a flat `{ counts, ts }`
 * shape so list-views can render the strip without further reshaping.
 *
 * Implementation note: §1D.1 wants stats over the whole tenant window
 * (not just the current page), but rebuilding KPIs on every render is
 * cheap on small tenants. We do an in-process aggregation over the
 * Mongo collection. When tenants pass ~10k rows we'll switch to a
 * `$facet`-based aggregation pipeline (TODO 1D.1).
 */

import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { requireSession } from '@/lib/hr-crud';

interface CandidateKpis {
  newApplications: number;
  inScreening: number;
  inInterview: number;
  offered: number;
  hired: number;
  total: number;
}

interface JobKpis {
  open: number;
  closed: number;
  totalApplicants: number;
  /** Average days from job createdAt → first hired candidate. */
  avgTimeToFillDays: number;
  /** Reserved — Wave-6 spec calls this out but ledger ties land in a
   *  later sweep (TODO 1D.1: wire recruitment cost ledger). */
  costPerHire: number;
}

interface InterviewKpis {
  today: number;
  thisWeek: number;
  scheduled: number;
  completed: number;
  noShows: number;
  total: number;
}

interface OfferKpis {
  sent: number;
  accepted: number;
  declined: number;
  pendingResponse: number;
  /** Average hours from sentAt → respondedAt. */
  avgNegotiationHours: number;
  total: number;
}

const emptyCandidate: CandidateKpis = {
  newApplications: 0,
  inScreening: 0,
  inInterview: 0,
  offered: 0,
  hired: 0,
  total: 0,
};
const emptyJob: JobKpis = {
  open: 0,
  closed: 0,
  totalApplicants: 0,
  avgTimeToFillDays: 0,
  costPerHire: 0,
};
const emptyInterview: InterviewKpis = {
  today: 0,
  thisWeek: 0,
  scheduled: 0,
  completed: 0,
  noShows: 0,
  total: 0,
};
const emptyOffer: OfferKpis = {
  sent: 0,
  accepted: 0,
  declined: 0,
  pendingResponse: 0,
  avgNegotiationHours: 0,
  total: 0,
};

export async function getCandidateKpis(): Promise<CandidateKpis> {
  const user = await requireSession();
  if (!user) return emptyCandidate;
  try {
    const { db } = await connectToDatabase();
    const docs = await db
      .collection('hr_candidates')
      .find(
        { userId: new ObjectId(user._id) },
        { projection: { stage: 1, status: 1 } },
      )
      .toArray();
    const out = { ...emptyCandidate };
    out.total = docs.length;
    for (const d of docs) {
      const stage = String((d as any).stage ?? '');
      const status = String((d as any).status ?? '');
      if (stage === 'applied') out.newApplications += 1;
      if (stage === 'screening') out.inScreening += 1;
      if (stage === 'interview') out.inInterview += 1;
      if (stage === 'offer' || status === 'offered') out.offered += 1;
      if (stage === 'hired' || status === 'hired') out.hired += 1;
    }
    return out;
  } catch {
    return emptyCandidate;
  }
}

export async function getJobKpis(): Promise<JobKpis> {
  const user = await requireSession();
  if (!user) return emptyJob;
  try {
    const { db } = await connectToDatabase();
    const [jobs, candidates] = await Promise.all([
      db
        .collection('hr_job_postings')
        .find(
          { userId: new ObjectId(user._id) },
          { projection: { status: 1, createdAt: 1 } },
        )
        .toArray(),
      db
        .collection('hr_candidates')
        .find(
          { userId: new ObjectId(user._id) },
          { projection: { jobId: 1, stage: 1, status: 1, createdAt: 1, hiredAt: 1 } },
        )
        .toArray(),
    ]);
    const out = { ...emptyJob };
    for (const j of jobs) {
      const status = String((j as any).status ?? '');
      if (status === 'open' || status === 'draft' || status === '') out.open += 1;
      if (status === 'closed' || status === 'filled' || status === 'archived')
        out.closed += 1;
    }
    out.totalApplicants = candidates.length;

    // time-to-fill: per job, from createdAt → first hired candidate
    const hires: Array<{ job: string; days: number }> = [];
    const jobCreated = new Map<string, Date>();
    for (const j of jobs) {
      jobCreated.set(String((j as any)._id), new Date((j as any).createdAt || Date.now()));
    }
    for (const c of candidates) {
      const cd = c as any;
      if (cd.stage === 'hired' || cd.status === 'hired') {
        const jobId = String(cd.jobId ?? '');
        const created = jobCreated.get(jobId);
        const hiredAt = cd.hiredAt
          ? new Date(cd.hiredAt)
          : new Date(cd.updatedAt || cd.createdAt || Date.now());
        if (created) {
          const days = Math.max(
            0,
            Math.round((hiredAt.getTime() - created.getTime()) / 86_400_000),
          );
          hires.push({ job: jobId, days });
        }
      }
    }
    if (hires.length > 0) {
      out.avgTimeToFillDays = Math.round(
        hires.reduce((s, h) => s + h.days, 0) / hires.length,
      );
    }
    // costPerHire intentionally left at 0 — TODO 1D.1 (cost ledger).
    return out;
  } catch {
    return emptyJob;
  }
}

export async function getInterviewKpis(): Promise<InterviewKpis> {
  const user = await requireSession();
  if (!user) return emptyInterview;
  try {
    const { db } = await connectToDatabase();
    const docs = await db
      .collection('hr_interviews')
      .find(
        { userId: new ObjectId(user._id) },
        { projection: { scheduledAt: 1, status: 1, result: 1 } },
      )
      .toArray();
    const out = { ...emptyInterview };
    out.total = docs.length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() + 7);

    for (const d of docs) {
      const i = d as any;
      const status = String(i.status ?? '');
      const result = String(i.result ?? '');
      if (i.scheduledAt) {
        const t = new Date(i.scheduledAt);
        if (t >= today && t < tomorrow) out.today += 1;
        if (t >= today && t < weekEnd) out.thisWeek += 1;
      }
      if (status === 'scheduled' || (status === '' && !result)) out.scheduled += 1;
      if (status === 'completed' || result === 'passed' || result === 'failed')
        out.completed += 1;
      if (status === 'no_show') out.noShows += 1;
    }
    return out;
  } catch {
    return emptyInterview;
  }
}

export async function getOfferKpis(): Promise<OfferKpis> {
  const user = await requireSession();
  if (!user) return emptyOffer;
  try {
    const { db } = await connectToDatabase();
    const docs = await db
      .collection('hr_offer_letters')
      .find(
        { userId: new ObjectId(user._id) },
        { projection: { status: 1, sentAt: 1, respondedAt: 1 } },
      )
      .toArray();
    const out = { ...emptyOffer };
    out.total = docs.length;
    const negotiations: number[] = [];

    for (const d of docs) {
      const o = d as any;
      const status = String(o.status ?? '');
      if (status === 'sent' || status === 'pending') out.sent += 1;
      if (status === 'accepted') out.accepted += 1;
      if (status === 'rejected' || status === 'declined') out.declined += 1;
      if ((status === 'sent' || status === 'pending') && !o.respondedAt)
        out.pendingResponse += 1;
      if (o.sentAt && o.respondedAt) {
        const sent = new Date(o.sentAt);
        const responded = new Date(o.respondedAt);
        const hours =
          (responded.getTime() - sent.getTime()) / 3_600_000;
        if (Number.isFinite(hours) && hours >= 0) negotiations.push(hours);
      }
    }
    if (negotiations.length > 0) {
      out.avgNegotiationHours = Math.round(
        negotiations.reduce((s, h) => s + h, 0) / negotiations.length,
      );
    }
    return out;
  } catch {
    return emptyOffer;
  }
}
