import { fmtDate } from '@/lib/utils';
import { Suspense } from 'react';
import { Button } from '@/components/sabcrm/20ui';
import {
  notFound } from 'next/navigation';
import Link from 'next/link';
import {
  Pencil,
  Send,
  CalendarPlus,
  XCircle,
  Mail,
  StickyNote,
  Activity,
  ArrowRight,
  } from 'lucide-react';

import { getCandidateById } from '@/app/actions/hr.actions';
import {
  RecruitmentDetailShell,
  DetailCard,
  RailCard,
  RailLink,
  } from '../../_components/recruitment-detail-shell';
import { StatusPill,
  statusToTone } from '@/components/crm/status-pill';

/**
 * Candidate detail — §1D.2 rebuild.
 *
 * Header action group (8): Edit · Move stage · Schedule interview · Send
 * offer · Reject · Email · Add note · Activity.
 * Body cards: Contact · Pipeline · Current role · Expected role · Skills
 *   · Documents · Notes.
 * Right rail: Job · Interviews · Offers · Rating · Audit summary.
 *
 * TODO 1D.2: notes composer and tag picker inline editors (need a
 *   notes mutation action — placeholder shown).
 */

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { InlineNoteComposer } from '../_components/inline-note-composer';
import { ParseResumeButton } from '../_components/parse-resume-button';
import { CalendlySchedulingCard } from '../_components/calendly-scheduling-card';
import { ScorecardCreator } from '../_components/scorecard-creator';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function CandidateDetailPageContainer({ params }: PageProps) {
  const { id } = await params;
  const raw = await getCandidateById(id);
  if (!raw) notFound();
  const c = raw as any;

  const stage = c.stage || 'applied';
  const tone = statusToTone(stage);

  return (
    <RecruitmentDetailShell
      title={c.name || c.firstName || 'Candidate'}
      eyebrow="CANDIDATE"
      status={{ label: stage, tone: tone as any }}
      back={{ href: '/dashboard/hrm/hr/candidates', label: 'All candidates' }}
      actions={[
        {
          key: 'edit',
          label: 'Edit',
          icon: <Pencil className="h-3.5 w-3.5" />,
          href: `/dashboard/hrm/hr/candidates/${id}/edit`,
          variant: 'outline',
        },
        {
          key: 'move',
          label: 'Move stage',
          icon: <ArrowRight className="h-3.5 w-3.5" />,
          href: `/dashboard/hrm/hr/candidates/${id}/edit`,
        },
        {
          key: 'schedule',
          label: 'Schedule interview',
          icon: <CalendarPlus className="h-3.5 w-3.5" />,
          href: `/dashboard/hrm/hr/interviews/new?fromKind=candidate&fromId=${id}&candidateId=${id}`,
        },
        {
          key: 'offer',
          label: 'Send offer',
          icon: <Send className="h-3.5 w-3.5" />,
          href: `/dashboard/hrm/hr/offers/new?fromKind=candidate&fromId=${id}&candidateId=${id}`,
        },
        {
          key: 'reject',
          label: 'Reject',
          icon: <XCircle className="h-3.5 w-3.5" />,
          variant: 'destructive',
        },
        {
          key: 'email',
          label: 'Email',
          icon: <Mail className="h-3.5 w-3.5" />,
          href: `mailto:${c.email || ''}`,
        },
        {
          key: 'note',
          label: 'Add note',
          icon: <StickyNote className="h-3.5 w-3.5" />,
        },
        {
          key: 'activity',
          label: 'Activity',
          icon: <Activity className="h-3.5 w-3.5" />,
          href: `/dashboard/hrm/hr/candidates/${id}/activity`,
        },
      ]}
      rightRail={
        <>
          <RailCard title="Related">
            {c.jobId ? (
              <RailLink
                href={`/dashboard/hrm/hr/jobs/${c.jobId}`}
                label="Linked job"
                hint={String(c.jobId)}
              />
            ) : (
              <p className="px-2 py-1.5 text-[var(--st-text-secondary)]">No linked job.</p>
            )}
            <RailLink
              href={`/dashboard/hrm/hr/interviews?candidateId=${id}`}
              label="Interviews"
            />
            <RailLink
              href={`/dashboard/hrm/hr/offers?candidateId=${id}`}
              label="Offers"
            />
          </RailCard>
          <RailCard title="Quick stats">
            <p>
              <span className="text-[var(--st-text-secondary)]">Rating: </span>
              <span className="text-[var(--st-text)]">
                {c.rating != null ? `${c.rating}/5` : '—'}
              </span>
            </p>
            <p>
              <span className="text-[var(--st-text-secondary)]">Applied: </span>
              <span className="text-[var(--st-text)]">
                {c.applied_at
                  ? fmtDate(c.applied_at)
                  : '—'}
              </span>
            </p>
            <p>
              <span className="text-[var(--st-text-secondary)]">Source: </span>
              <span className="text-[var(--st-text)]">{c.source || '—'}</span>
            </p>
          </RailCard>
          <CalendlySchedulingCard
            candidateName={c.name || c.firstName || 'Candidate'}
            candidateEmail={c.email || ''}
          />
        </>
      }
      audit={<EntityAuditTimeline entityKind="candidate" entityId={id} />}
    >
      <DetailCard
        title="Contact"
        rows={[
          { label: 'Name', value: c.name },
          { label: 'Email', value: c.email },
          { label: 'Phone', value: c.phone },
          { label: 'LinkedIn', value: c.linkedIn },
          { label: 'Website', value: c.website },
          { label: 'Address', value: c.address },
          { label: 'Date of birth', value: fmtDate(c.dob) },
          { label: 'Gender', value: c.gender },
        ]}
      />
      <DetailCard
        title="Pipeline"
        rows={[
          { label: 'Job', value: c.jobId ? <code>{c.jobId}</code> : '—' },
          { label: 'Source', value: c.source },
          { label: 'Source (other)', value: c.sourceOther },
          {
            label: 'Stage',
            value: <StatusPill label={stage} tone={tone} />,
          },
          { label: 'Applied at', value: fmtDate(c.applied_at) },
          { label: 'Rating', value: c.rating != null ? `${c.rating}/5` : '—' },
        ]}
      />
      <DetailCard
        title="Current role"
        rows={[
          { label: 'Company', value: c.currentCompany },
          { label: 'Designation', value: c.currentDesignation },
          { label: 'Current CTC', value: fmtCurrency(c.currentCtc, c.currency) },
          { label: 'Experience', value: c.experienceYears ? `${c.experienceYears} yrs` : '—' },
          { label: 'Notice period', value: c.noticePeriod },
        ]}
      />
      <DetailCard
        title="Expected role"
        rows={[
          { label: 'Expected CTC', value: fmtCurrency(c.expectedCtc, c.currency) },
          { label: 'Currency', value: c.currency },
          { label: 'Location', value: c.location },
          { label: 'Country', value: c.country },
          { label: 'Willing to relocate', value: c.willingToRelocate },
        ]}
      />
      <DetailCard title="Skills & documents">
        <p>
          <span className="text-[var(--st-text-secondary)]">Skills: </span>
          <span className="text-[var(--st-text)]">
            {Array.isArray(c.skills) ? c.skills.join(', ') : c.skills || '—'}
          </span>
        </p>
        <p>
          <span className="text-[var(--st-text-secondary)]">Resume: </span>
          {c.resumeUrl ? (
            <div className="inline-flex items-center">
              <Link
                href={c.resumeUrl}
                className="text-[var(--st-text)] underline-offset-2 hover:underline"
                target="_blank"
              >
                Open resume
              </Link>
              <ParseResumeButton candidateId={id} resumeUrl={c.resumeUrl} />
            </div>
          ) : (
            <span className="text-[var(--st-text)]">—</span>
          )}
        </p>
        {c.coverLetter ? (
          <div>
            <p className="text-[var(--st-text-secondary)]">Cover letter</p>
            <p className="whitespace-pre-wrap text-[var(--st-text)]">{c.coverLetter}</p>
          </div>
        ) : null}
      </DetailCard>
      {c.notes ? (
        <DetailCard title="Notes">
          <p className="whitespace-pre-wrap">{c.notes}</p>
        </DetailCard>
      ) : null}
      {/* Scorecard Creator */}
      <DetailCard title="Scorecard">
        <ScorecardCreator candidateId={id} />
      </DetailCard>

      {/* Inline notes composer */}
      <DetailCard title="Add note">
        <InlineNoteComposer candidateId={id} />
      </DetailCard>
    </RecruitmentDetailShell>
  );
}



function fmtCurrency(v: any, curr: any) {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return `${n.toLocaleString()} ${curr || ''}`.trim();
}

export default function CandidateDetailPage({ params }: PageProps) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CandidateDetailPageContainer params={params} />
    </Suspense>
  );
}
