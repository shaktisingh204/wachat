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
  const i = raw as any;

  let candidate: any = null;
  if (i.candidateId) {
    try {
      candidate = await getCandidateById(String(i.candidateId));
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
      back={{ href: '/dashboard/crm/hr/interviews', label: 'All interviews' }}
      actions={[
        {
          key: 'edit',
          label: 'Edit',
          icon: <Pencil className="h-3.5 w-3.5" />,
          href: `/dashboard/crm/hr/interviews/${id}/edit`,
          variant: 'outline',
        },
        {
          key: 'reschedule',
          label: 'Reschedule',
          icon: <CalendarClock className="h-3.5 w-3.5" />,
          href: `/dashboard/crm/hr/interviews/${id}/edit`,
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
          href: `/dashboard/crm/hr/interviews/${id}/edit`,
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
          href: `/dashboard/crm/hr/interviews/${id}?print=1`,
        },
        {
          key: 'activity',
          label: 'Activity',
          icon: <Activity className="h-3.5 w-3.5" />,
          href: `/dashboard/crm/hr/interviews/${id}/activity`,
        },
      ]}
      rightRail={
        <>
          <RailCard title="Candidate">
            {candidate ? (
              <RailLink
                href={`/dashboard/crm/hr/candidates/${candidate._id}`}
                label={candidate.name || '—'}
                hint={candidate.email || ''}
              />
            ) : (
              <p className="px-2 py-1.5 text-zoru-ink-muted">
                No linked candidate.
              </p>
            )}
          </RailCard>
          <RailCard title="Quick stats">
            <p>
              <span className="text-zoru-ink-muted">Round: </span>
              <span className="text-zoru-ink">R{i.roundNumber ?? '?'}</span>
            </p>
            <p>
              <span className="text-zoru-ink-muted">Type: </span>
              <span className="text-zoru-ink">{i.type || '—'}</span>
            </p>
            <p>
              <span className="text-zoru-ink-muted">Duration: </span>
              <span className="text-zoru-ink">
                {i.durationMinutes ? `${i.durationMinutes} min` : '—'}
              </span>
            </p>
            <p>
              <span className="text-zoru-ink-muted">Rating: </span>
              <span className="text-zoru-ink">
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
                href={`/dashboard/crm/hr/candidates/${i.candidateId}`}
                className="text-zoru-ink hover:underline"
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
              ? new Date(i.scheduledAt).toLocaleString()
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
                className="text-zoru-ink underline-offset-2 hover:underline"
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
