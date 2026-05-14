/**
 * Probation detail — §1D.2 rebuild.
 *
 * Header action group (6): Edit · Confirm · Extend · Reject · Print ·
 *   Activity.
 * Body cards: Probation · Reviewer · Outcome · Notes.
 * Right rail: linked employee · chain transition (confirm → employee).
 *
 * TODO 1D.2: dedicated `getProbationById` server action — currently
 *   we list-then-find.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  Pencil,
  CheckCircle2,
  Clock,
  XCircle,
  Printer,
  Activity,
} from 'lucide-react';

import { getProbations } from '@/app/actions/hr.actions';
import {
  confirmProbation,
  extendProbation,
  terminateProbation,
} from '@/app/actions/hr-status-flow.actions';
import {
  RecruitmentDetailShell,
  DetailCard,
  RailCard,
  RailLink,
} from '../../_components/recruitment-detail-shell';
import { HrActionButtons } from '../../_components/hr-action-buttons';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProbationDetailPage({ params }: PageProps) {
  const { id } = await params;
  const all = (await getProbations()) as any[];
  const p = all.find((x) => String(x._id) === id);
  if (!p) notFound();

  const status = p.status || 'ongoing';
  const tone = statusToTone(status);

  return (
    <RecruitmentDetailShell
      title={`Probation · ${p.employeeId ? String(p.employeeId) : ''}`}
      eyebrow="PROBATION"
      status={{ label: status, tone: tone as any }}
      back={{ href: '/dashboard/hrm/hr/probation', label: 'All probation' }}
      actions={[
        {
          key: 'edit',
          label: 'Edit',
          icon: <Pencil className="h-3.5 w-3.5" />,
          href: `/dashboard/hrm/hr/probation/${id}/edit`,
          variant: 'outline',
        },
        {
          key: 'print',
          label: 'Print',
          icon: <Printer className="h-3.5 w-3.5" />,
          href: `/dashboard/hrm/hr/probation/${id}?print=1`,
        },
        {
          key: 'activity',
          label: 'Activity',
          icon: <Activity className="h-3.5 w-3.5" />,
          href: `/dashboard/hrm/hr/probation/${id}/activity`,
        },
      ]}
      actionsSlot={
        <HrActionButtons
          className="flex flex-wrap items-center gap-1"
          actions={[
            {
              key: 'confirm',
              kind: 'action',
              label: 'Confirm',
              icon: <CheckCircle2 className="h-3.5 w-3.5" />,
              onRun: () => confirmProbation(id),
            },
            {
              key: 'extend',
              kind: 'prompt',
              label: 'Extend',
              icon: <Clock className="h-3.5 w-3.5" />,
              promptTitle: 'Extend probation',
              promptDescription: 'Set the new end date for this probation.',
              submitLabel: 'Extend',
              fields: [
                {
                  name: 'newEndDate',
                  label: 'New end date',
                  type: 'date',
                  required: true,
                },
              ],
              onRun: (v) => extendProbation(id, v.newEndDate ?? ''),
            },
            {
              key: 'reject',
              kind: 'prompt',
              label: 'Reject',
              icon: <XCircle className="h-3.5 w-3.5" />,
              variant: 'destructive',
              promptTitle: 'Terminate probation',
              promptDescription:
                'Provide a reason; this will be recorded in the audit log.',
              submitLabel: 'Terminate',
              fields: [
                {
                  name: 'reason',
                  label: 'Reason',
                  type: 'textarea',
                  placeholder: 'Reason for termination',
                  required: true,
                },
              ],
              onRun: (v) => terminateProbation(id, v.reason ?? ''),
            },
          ]}
        />
      }
      rightRail={
        <>
          <RailCard title="Employee">
            {p.employeeId ? (
              <RailLink
                href={`/dashboard/hrm/hr/directory/${p.employeeId}`}
                label="Linked employee"
                hint={String(p.employeeId)}
              />
            ) : (
              <p className="px-2 py-1.5 text-zoru-ink-muted">No employee.</p>
            )}
          </RailCard>
          <RailCard title="Quick stats">
            <p>
              <span className="text-zoru-ink-muted">Start: </span>
              <span className="text-zoru-ink">{fmtDate(p.startDate)}</span>
            </p>
            <p>
              <span className="text-zoru-ink-muted">End: </span>
              <span className="text-zoru-ink">{fmtDate(p.endDate)}</span>
            </p>
            <p>
              <span className="text-zoru-ink-muted">Score: </span>
              <span className="text-zoru-ink">
                {p.performanceScore != null ? `${p.performanceScore}/5` : '—'}
              </span>
            </p>
          </RailCard>
        </>
      }
      audit={{ entityKind: 'probation', entityId: id }}
    >
      <DetailCard
        title="Probation"
        rows={[
          {
            label: 'Employee',
            value: p.employeeId ? (
              <Link
                href={`/dashboard/hrm/hr/directory/${p.employeeId}`}
                className="text-zoru-ink hover:underline"
              >
                {String(p.employeeId)}
              </Link>
            ) : (
              '—'
            ),
          },
          { label: 'Start date', value: fmtDate(p.startDate) },
          { label: 'End date', value: fmtDate(p.endDate) },
          {
            label: 'Status',
            value: <StatusPill label={status} tone={tone} />,
          },
        ]}
      />
      <DetailCard
        title="Reviewer"
        rows={[
          { label: 'Reviewer', value: p.reviewer_id },
          { label: 'Reviewer name', value: p.reviewerName },
          { label: 'Reviewer email', value: p.reviewerEmail },
          { label: 'Mentor', value: p.mentor },
          { label: 'Mid review', value: fmtDate(p.midReviewDate) },
        ]}
      />
      <DetailCard
        title="Outcome"
        rows={[
          {
            label: 'Performance score',
            value: p.performanceScore != null ? `${p.performanceScore}/5` : '—',
          },
          { label: 'Extension date', value: fmtDate(p.extension_date) },
          { label: 'Extended end date', value: fmtDate(p.extendedEndDate) },
        ]}
      >
        {p.review_notes ? (
          <div>
            <p className="text-zoru-ink-muted">Review notes</p>
            <p className="whitespace-pre-wrap text-zoru-ink">{p.review_notes}</p>
          </div>
        ) : null}
        {p.evaluationCriteria ? (
          <div>
            <p className="text-zoru-ink-muted">Evaluation criteria</p>
            <p className="whitespace-pre-wrap text-zoru-ink">
              {p.evaluationCriteria}
            </p>
          </div>
        ) : null}
        {p.feedback ? (
          <div>
            <p className="text-zoru-ink-muted">Feedback</p>
            <p className="whitespace-pre-wrap text-zoru-ink">{p.feedback}</p>
          </div>
        ) : null}
        {p.terminationReason ? (
          <div>
            <p className="text-zoru-ink-muted">Termination reason</p>
            <p className="whitespace-pre-wrap text-zoru-ink">
              {p.terminationReason}
            </p>
          </div>
        ) : null}
      </DetailCard>
      {p.notes ? (
        <DetailCard title="Notes">
          <p className="whitespace-pre-wrap">{p.notes}</p>
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
