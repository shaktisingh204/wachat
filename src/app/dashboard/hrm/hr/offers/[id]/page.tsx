/**
 * Offer detail — §1D.2 rebuild.
 *
 * Header action group (8): Edit · Send · Withdraw · Mark Accepted ·
 *   Print · Email · Duplicate · Activity.
 * Body cards: Role · Compensation · Status & validity · Terms.
 * Right rail: linked candidate · onboarding-link (chain transition).
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  Pencil,
  Send,
  Undo2,
  CheckCircle2,
  Printer,
  Mail,
  Copy,
  Activity,
  UserCheck,
} from 'lucide-react';

import {
  getOfferLetterById,
  getCandidateById,
} from '@/app/actions/hr.actions';
import {
  sendOfferLetter,
  withdrawOfferLetter,
  markOfferAccepted,
} from '@/app/actions/hr-status-flow.actions';
import {
  RecruitmentDetailShell,
  DetailCard,
  RailCard,
  RailLink,
} from '../../_components/recruitment-detail-shell';
import { HrActionButtons } from '../../_components/hr-action-buttons';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OfferDetailPage({ params }: PageProps) {
  const { id } = await params;
  const raw = await getOfferLetterById(id);
  if (!raw) notFound();
  const o = raw as any;

  let candidate: any = null;
  if (o.candidateId) {
    try {
      candidate = await getCandidateById(String(o.candidateId));
    } catch {
      candidate = null;
    }
  }

  const status = o.status || 'pending';
  const tone = statusToTone(status);

  return (
    <RecruitmentDetailShell
      title={`Offer · ${candidate?.name || o.designation || 'Letter'}`}
      eyebrow="OFFER LETTER"
      status={{ label: status, tone: tone as any }}
      back={{ href: '/dashboard/hrm/hr/offers', label: 'All offers' }}
      actions={[
        {
          key: 'edit',
          label: 'Edit',
          icon: <Pencil className="h-3.5 w-3.5" />,
          href: `/dashboard/hrm/hr/offers/${id}/edit`,
          variant: 'outline',
        },
        {
          key: 'print',
          label: 'Print',
          icon: <Printer className="h-3.5 w-3.5" />,
          href: `/dashboard/hrm/hr/offers/${id}?print=1`,
        },
        {
          key: 'email',
          label: 'Email',
          icon: <Mail className="h-3.5 w-3.5" />,
          href: candidate?.email ? `mailto:${candidate.email}` : '#',
        },
        {
          key: 'duplicate',
          label: 'Duplicate',
          icon: <Copy className="h-3.5 w-3.5" />,
        },
        {
          key: 'activity',
          label: 'Activity',
          icon: <Activity className="h-3.5 w-3.5" />,
          href: `/dashboard/hrm/hr/offers/${id}/activity`,
        },
      ]}
      actionsSlot={
        <HrActionButtons
          className="flex flex-wrap items-center gap-1"
          actions={[
            {
              key: 'send',
              kind: 'action',
              label: 'Send',
              icon: <Send className="h-3.5 w-3.5" />,
              onRun: () => sendOfferLetter(id),
            },
            {
              key: 'accepted',
              kind: 'action',
              label: 'Mark accepted',
              icon: <CheckCircle2 className="h-3.5 w-3.5" />,
              onRun: () => markOfferAccepted(id),
            },
            {
              key: 'withdraw',
              kind: 'prompt',
              label: 'Withdraw',
              icon: <Undo2 className="h-3.5 w-3.5" />,
              variant: 'destructive',
              promptTitle: 'Withdraw offer letter',
              promptDescription:
                'Provide a reason; this will be recorded in the audit log.',
              submitLabel: 'Withdraw',
              fields: [
                {
                  name: 'reason',
                  label: 'Reason',
                  type: 'textarea',
                  placeholder: 'Reason for withdrawal',
                  required: true,
                },
              ],
              onRun: (v) => withdrawOfferLetter(id, v.reason ?? ''),
            },
          ]}
        />
      }
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
              <p className="px-2 py-1.5 text-zoru-ink-muted">No candidate.</p>
            )}
          </RailCard>
          <RailCard title="Chain — next step">
            <RailLink
              href={`/dashboard/hrm/hr/onboarding/new?fromKind=offer&fromId=${id}${
                candidate?._id ? `&employeeId=${candidate._id}` : ''
              }`}
              label="Start onboarding"
              hint="Move to onboarding"
            />
          </RailCard>
          <RailCard title="Quick stats">
            <p>
              <span className="text-zoru-ink-muted">CTC: </span>
              <span className="text-zoru-ink">
                {o.ctc != null || o.salary != null
                  ? `${Number(o.ctc ?? o.salary).toLocaleString()} ${o.currency || ''}`.trim()
                  : '—'}
              </span>
            </p>
            <p>
              <span className="text-zoru-ink-muted">Joining: </span>
              <span className="text-zoru-ink">
                {o.joining_date
                  ? new Date(o.joining_date).toLocaleDateString()
                  : '—'}
              </span>
            </p>
            <p>
              <span className="text-zoru-ink-muted">Validity: </span>
              <span className="text-zoru-ink">
                {o.valid_till
                  ? new Date(o.valid_till).toLocaleDateString()
                  : '—'}
              </span>
            </p>
          </RailCard>
        </>
      }
      audit={<EntityAuditTimeline entityKind="offerLetter" entityId={id} />}
    >
      <DetailCard
        title="Role"
        rows={[
          {
            label: 'Candidate',
            value: o.candidateId ? (
              <Link
                href={`/dashboard/hrm/hr/candidates/${o.candidateId}`}
                className="text-zoru-ink hover:underline"
              >
                {candidate?.name || String(o.candidateId)}
              </Link>
            ) : (
              '—'
            ),
          },
          { label: 'Designation', value: o.designation },
          { label: 'Department', value: o.department },
          { label: 'Reports to', value: o.reportsTo },
          { label: 'Work mode', value: o.workMode },
          { label: 'Joining date', value: fmtDate(o.joining_date) },
        ]}
      />
      <DetailCard
        title="Compensation"
        rows={[
          { label: 'Salary', value: fmtMoney(o.salary, o.currency) },
          { label: 'Total CTC', value: fmtMoney(o.ctc, o.currency) },
          { label: 'Fixed', value: fmtMoney(o.fixedComponent, o.currency) },
          { label: 'Variable', value: fmtMoney(o.variableComponent, o.currency) },
          { label: 'Joining bonus', value: fmtMoney(o.joiningBonus, o.currency) },
          { label: 'Stock options', value: o.stockOptions },
          {
            label: 'Probation',
            value: o.probationMonths ? `${o.probationMonths} months` : '—',
          },
        ]}
      />
      <DetailCard
        title="Status & validity"
        rows={[
          {
            label: 'Status',
            value: <StatusPill label={status} tone={tone} />,
          },
          { label: 'Sent at', value: fmtDate(o.sentAt) },
          { label: 'Responded at', value: fmtDate(o.respondedAt) },
          { label: 'Valid till', value: fmtDate(o.valid_till) },
        ]}
      />
      {o.terms ? (
        <DetailCard title="Terms">
          <p className="whitespace-pre-wrap">{o.terms}</p>
        </DetailCard>
      ) : null}
      {o.notes ? (
        <DetailCard title="Notes">
          <p className="whitespace-pre-wrap">{o.notes}</p>
        </DetailCard>
      ) : null}
    </RecruitmentDetailShell>
  );
}


function fmtMoney(v: any, curr: any) {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return `${n.toLocaleString()} ${curr || ''}`.trim();
}
