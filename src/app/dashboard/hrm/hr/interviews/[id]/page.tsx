import { fmtDate } from '@/lib/utils';
export const dynamic = 'force-dynamic';
/**
 * Interview detail — §1D.2 rebuild.
 *
 * Header action group (7): Edit · Reschedule · Cancel · Submit
 *   feedback · Email candidate · Print · Activity.
 * Body cards: Interview · Interviewer · Outcome.
 * Right rail: linked candidate chip · related interviews by candidate.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  Pencil,
  CalendarClock,
  XCircle,
  ClipboardCheck,
  Mail,
  Printer,
  Activity,
} from 'lucide-react';

import { getInterviewById, getCandidateById } from '@/app/actions/hr.actions';
import { HrInterview, HrCandidate } from '@/lib/hr-types';
import {
  RecruitmentDetailShell,
  DetailCard,
  RailCard,
  RailLink,
} from '../../_components/recruitment-detail-shell';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function InterviewDetailPage({ params }: PageProps) {
  const { id } = await params;
  const raw = await getInterviewById(id);
  if (!raw) notFound();
  const i = raw as unknown as HrInterview & { _id: string };

  let candidate: (HrCandidate & { _id: string }) | null = null;
  if (i.candidateId) {
    try {
      candidate = (await getCandidateById(String(i.candidateId))) as unknown as (HrCandidate & { _id: string }) | null;
    } catch {
      candidate = null;
    }
  }

  const status = i.result || 'pending';
  const tone = statusToTone(status);

  return (
    <RecruitmentDetailShell
      title={`Interview · R${i.roundNumber ?? '?'} · ${i.roundName || i.type || ''}`}
      eyebrow="INTERVIEW"
      status={{ label: status, tone: tone as any }}
      back={{ href: '/dashboard/hrm/hr/interviews', label: 'All interviews' }}
      actions={[
        {
          key: 'edit',
          label: 'Edit',
          icon: <Pencil className="h-3.5 w-3.5" />,
          href: `/dashboard/hrm/hr/interviews/${id}/edit`,
          variant: 'outline',
        },
        {
          key: 'reschedule',
          label: 'Reschedule',
          icon: <CalendarClock className="h-3.5 w-3.5" />,
          href: `/dashboard/hrm/hr/interviews/${id}/edit`,
        },
        {
          key: 'cancel',
          label: 'Cancel',
          icon: <XCircle className="h-3.5 w-3.5" />,
          variant: 'destructive',
        },
        {
          key: 'feedback',
          label: 'Submit feedback',
          icon: <ClipboardCheck className="h-3.5 w-3.5" />,
          href: `/dashboard/hrm/hr/interviews/${id}/edit`,
        },
        {
          key: 'email',
          label: 'Email candidate',
          icon: <Mail className="h-3.5 w-3.5" />,
          href: candidate?.email ? `mailto:${candidate.email}` : '#',
        },
        {
          key: 'print',
          label: 'Print',
          icon: <Printer className="h-3.5 w-3.5" />,
          href: `/dashboard/hrm/hr/interviews/${id}?print=1`,
        },
        {
          key: 'activity',
          label: 'Activity',
          icon: <Activity className="h-3.5 w-3.5" />,
          href: `/dashboard/hrm/hr/interviews/${id}/activity`,
        },
      ]}
      rightRail={
        <>
          <RailCard title="Candidate">
            {candidate ? (
              <RailLink
                href={`/dashboard/hrm/hr/candidates/${candidate._id}`}
                label={candidate.name || '—'}
                hint={candidate.email || ''}
              />
            ) : (
              <p className="px-2 py-1.5 text-[var(--st-text-secondary)]">
                No linked candidate.
              </p>
            )}
          </RailCard>
          <RailCard title="Quick stats">
            <p>
              <span className="text-[var(--st-text-secondary)]">Round: </span>
              <span className="text-[var(--st-text)]">R{i.roundNumber ?? '?'}</span>
            </p>
            <p>
              <span className="text-[var(--st-text-secondary)]">Type: </span>
              <span className="text-[var(--st-text)]">{i.type || '—'}</span>
            </p>
            <p>
              <span className="text-[var(--st-text-secondary)]">Duration: </span>
              <span className="text-[var(--st-text)]">
                {i.durationMinutes ? `${i.durationMinutes} min` : '—'}
              </span>
            </p>
            <p>
              <span className="text-[var(--st-text-secondary)]">Rating: </span>
              <span className="text-[var(--st-text)]">
                {i.rating != null ? `${i.rating}/5` : '—'}
              </span>
            </p>
          </RailCard>
        </>
      }
      audit={<EntityAuditTimeline entityKind="interview" entityId={id} />}
    >
      <DetailCard
        title="Interview"
        rows={[
          {
            label: 'Candidate',
            value: i.candidateId ? (
              <Link
                href={`/dashboard/hrm/hr/candidates/${i.candidateId}`}
                className="text-[var(--st-text)] hover:underline"
              >
                {candidate?.name || String(i.candidateId)}
              </Link>
            ) : (
              '—'
            ),
          },
          { label: 'Round', value: i.roundNumber },
          { label: 'Round name', value: i.roundName },
          {
            label: 'Scheduled at',
            value: i.scheduledAt
              ? fmtDate(i.scheduledAt, true)
              : '—',
          },
          {
            label: 'Duration',
            value: i.durationMinutes ? `${i.durationMinutes} min` : '—',
          },
          { label: 'Type', value: i.type },
          {
            label: 'Result',
            value: <StatusPill label={status} tone={tone} />,
          },
        ]}
      />
      <DetailCard
        title="Interviewer"
        rows={[
          { label: 'Name', value: i.interviewerName },
          { label: 'Email', value: i.interviewerEmail },
          { label: 'Phone', value: i.interviewerPhone },
          { label: 'Location', value: i.location },
          {
            label: 'Meeting link',
            value: i.meetingLink ? (
              <Link
                href={i.meetingLink}
                target="_blank"
                className="text-[var(--st-text)] underline-offset-2 hover:underline"
              >
                {i.meetingLink}
              </Link>
            ) : (
              '—'
            ),
          },
        ]}
      />
      <DetailCard
        title="Outcome"
        rows={[
          {
            label: 'Rating',
            value: i.rating != null ? `${i.rating}/5` : '—',
          },
          { label: 'Recommendation', value: i.recommendation },
          { label: 'Strengths', value: i.strengths },
          { label: 'Weaknesses', value: i.weaknesses },
          { label: 'Feedback', value: i.feedback },
        ]}
      />
    </RecruitmentDetailShell>
  );
}
