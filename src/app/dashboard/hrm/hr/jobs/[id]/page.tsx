/**
 * Job detail — §1D.2 rebuild.
 *
 * Header action group (7): Edit · Publish · Pause · Close · Duplicate ·
 *   Print · Activity.
 * Body cards: Role · Dates & openings · Compensation · Description ·
 *   Requirements · Skills.
 * Right rail: Candidates count + linked candidates + linked recruiter +
 *   department/designation chips.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  Pencil,
  Power,
  PowerOff,
  XSquare,
  Copy,
  Printer,
  Activity,
  Users,
} from 'lucide-react';

import {
  getJobPostingById,
  getCandidates,
} from '@/app/actions/hr.actions';
import {
  RecruitmentDetailShell,
  DetailCard,
  RailCard,
  RailLink,
} from '../../_components/recruitment-detail-shell';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function JobDetailPage({ params }: PageProps) {
  const { id } = await params;
  const raw = await getJobPostingById(id);
  if (!raw) notFound();
  const j = raw as any;

  // Best-effort related-candidates count (skip if call fails).
  let candidatesForJob: any[] = [];
  try {
    const all = (await getCandidates()) as any[];
    candidatesForJob = all.filter((c) => String(c.jobId) === id).slice(0, 8);
  } catch {
    candidatesForJob = [];
  }

  const status = j.status || 'draft';
  const tone = statusToTone(status);

  return (
    <RecruitmentDetailShell
      title={j.title || 'Job'}
      eyebrow="JOB POSTING"
      status={{ label: status, tone: tone as any }}
      back={{ href: '/dashboard/hrm/hr/jobs', label: 'All jobs' }}
      actions={[
        {
          key: 'edit',
          label: 'Edit',
          icon: <Pencil className="h-3.5 w-3.5" />,
          href: `/dashboard/hrm/hr/jobs/${id}/edit`,
          variant: 'outline',
        },
        {
          key: 'publish',
          label: 'Publish',
          icon: <Power className="h-3.5 w-3.5" />,
        },
        {
          key: 'pause',
          label: 'Pause',
          icon: <PowerOff className="h-3.5 w-3.5" />,
        },
        {
          key: 'close',
          label: 'Close',
          icon: <XSquare className="h-3.5 w-3.5" />,
          variant: 'destructive',
        },
        {
          key: 'duplicate',
          label: 'Duplicate',
          icon: <Copy className="h-3.5 w-3.5" />,
        },
        {
          key: 'print',
          label: 'Print',
          icon: <Printer className="h-3.5 w-3.5" />,
          href: `/dashboard/hrm/hr/jobs/${id}?print=1`,
        },
        {
          key: 'activity',
          label: 'Activity',
          icon: <Activity className="h-3.5 w-3.5" />,
          href: `/dashboard/hrm/hr/jobs/${id}/activity`,
        },
      ]}
      rightRail={
        <>
          <RailCard title="Pipeline">
            <RailLink
              href={`/dashboard/hrm/hr/candidates/new?fromKind=job&fromId=${id}&jobId=${id}`}
              label="Add candidate"
            />
            <RailLink
              href={`/dashboard/hrm/hr/candidates?jobId=${id}`}
              label="All candidates"
              count={candidatesForJob.length}
            />
          </RailCard>
          {candidatesForJob.length > 0 ? (
            <RailCard title="Recent candidates">
              {candidatesForJob.map((c: any) => (
                <RailLink
                  key={String(c._id)}
                  href={`/dashboard/hrm/hr/candidates/${c._id}`}
                  label={c.name || '—'}
                  hint={c.stage || ''}
                />
              ))}
            </RailCard>
          ) : null}
          <RailCard title="Quick stats">
            <p>
              <span className="text-zoru-ink-muted">Openings: </span>
              <span className="text-zoru-ink">{j.totalOpenings ?? '—'}</span>
            </p>
            <p>
              <span className="text-zoru-ink-muted">Expiry: </span>
              <span className="text-zoru-ink">
                {fmtDate(j.deadline || j.endDate)}
              </span>
            </p>
            <p>
              <span className="text-zoru-ink-muted">Visibility: </span>
              <span className="text-zoru-ink">{j.visibility || '—'}</span>
            </p>
          </RailCard>
        </>
      }
      audit={{ entityKind: 'jobPosting', entityId: id }}
    >
      <DetailCard
        title="Role"
        rows={[
          { label: 'Title', value: j.title },
          { label: 'Department', value: j.departmentId },
          { label: 'Designation', value: j.designationId },
          { label: 'Location', value: j.location },
          { label: 'Type', value: j.employmentType },
          {
            label: 'Status',
            value: <StatusPill label={status} tone={tone} />,
          },
          { label: 'Visibility', value: j.visibility },
        ]}
      />
      <DetailCard
        title="Dates & openings"
        rows={[
          { label: 'Openings', value: j.totalOpenings },
          { label: 'Start date', value: fmtDate(j.startDate) },
          { label: 'End date', value: fmtDate(j.endDate) },
          { label: 'Deadline', value: fmtDate(j.deadline) },
          { label: 'Shift', value: j.shiftId },
          { label: 'Recruiter', value: j.recruiterId },
        ]}
      />
      <DetailCard
        title="Compensation & experience"
        rows={[
          { label: 'Salary from', value: j.salaryMin },
          { label: 'Salary to', value: j.salaryMax },
          { label: 'Currency', value: j.salaryCurrency },
          { label: 'Experience from', value: j.experienceFrom },
          { label: 'Experience to', value: j.experienceTo },
          { label: 'Education', value: j.education },
        ]}
      />
      <DetailCard title="Skills & apply">
        <p>
          <span className="text-zoru-ink-muted">Skills: </span>
          <span className="text-zoru-ink">{j.skillsRequired || '—'}</span>
        </p>
        <p>
          <span className="text-zoru-ink-muted">Apply URL: </span>
          {j.applyUrl ? (
            <Link
              href={j.applyUrl}
              target="_blank"
              className="text-zoru-ink underline-offset-2 hover:underline"
            >
              {j.applyUrl}
            </Link>
          ) : (
            <span className="text-zoru-ink">—</span>
          )}
        </p>
      </DetailCard>
      {j.description ? (
        <DetailCard title="Description">
          <p className="whitespace-pre-wrap">{j.description}</p>
        </DetailCard>
      ) : null}
      {j.responsibilities ? (
        <DetailCard title="Responsibilities">
          <p className="whitespace-pre-wrap">{j.responsibilities}</p>
        </DetailCard>
      ) : null}
      {j.requirements ? (
        <DetailCard title="Requirements">
          <p className="whitespace-pre-wrap">{j.requirements}</p>
        </DetailCard>
      ) : null}
    </RecruitmentDetailShell>
  );
}

function fmtDate(d?: string | Date | null) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return '—';
  }
}
