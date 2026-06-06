/**
 * Onboarding detail — §1D.2 rebuild.
 *
 * Header action group (6): Edit · Mark complete · Send welcome kit ·
 *   Email · Print · Activity.
 * Body cards: Task · Template checklist · Notes.
 * Right rail: linked employee · chain transition to probation.
 *
 * Server component — uses the action getOnboardingTemplates() to load
 * the full collection then locates the requested doc by id (the HR
 * actions module doesn't yet expose a single-get for onboarding tasks).
 *
 * TODO 1D.2: replace the in-memory lookup with a dedicated
 *   `getOnboardingById` server action when the collection ships one.
 */

import * as React from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  Pencil,
  CheckCircle2,
  Gift,
  Mail,
  Printer,
  Activity,
} from 'lucide-react';

import { getOnboardingById } from '@/app/actions/crm-onboarding.actions';
import { fmtDate } from '@/lib/utils';
import {
  markOnboardingComplete,
  sendOnboardingWelcomeKit,
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

export const dynamic = 'force-dynamic';

async function OnboardingDetailContainer({ id }: { id: string }) {
  const o = await getOnboardingById(id);
  if (!o) notFound();

  const status = o.status || 'pending';
  const tone = statusToTone(status);

  return (
    <RecruitmentDetailShell
      title={o.employeeName || 'Onboarding'}
      eyebrow="ONBOARDING"
      status={{ label: status, tone: tone as any }}
      back={{ href: '/dashboard/hrm/hr/onboarding', label: 'All onboarding' }}
      actions={[
        {
          key: 'edit',
          label: 'Edit',
          icon: <Pencil className="h-3.5 w-3.5" />,
          href: `/dashboard/hrm/hr/onboarding/${id}/edit`,
          variant: 'outline',
        },
        {
          key: 'email',
          label: 'Email',
          icon: <Mail className="h-3.5 w-3.5" />,
        },
        {
          key: 'print',
          label: 'Print',
          icon: <Printer className="h-3.5 w-3.5" />,
          href: `/dashboard/hrm/hr/onboarding/${id}?print=1`,
        },
        {
          key: 'activity',
          label: 'Activity',
          icon: <Activity className="h-3.5 w-3.5" />,
          href: `/dashboard/hrm/hr/onboarding/${id}/activity`,
        },
      ]}
      actionsSlot={
        <HrActionButtons
          className="flex flex-wrap items-center gap-1"
          actions={[
            {
              key: 'complete',
              kind: 'action',
              label: 'Mark complete',
              icon: <CheckCircle2 className="h-3.5 w-3.5" />,
              onRun: () => markOnboardingComplete(id),
            },
            {
              key: 'welcomeKit',
              kind: 'action',
              label: 'Send welcome kit',
              icon: <Gift className="h-3.5 w-3.5" />,
              onRun: () => sendOnboardingWelcomeKit(id),
            },
          ]}
        />
      }
      rightRail={
        <>
          <RailCard title="Employee">
            {o.employeeId ? (
              <RailLink
                href={`/dashboard/hrm/hr/directory/${o.employeeId}`}
                label="Linked employee"
                hint={String(o.employeeId)}
              />
            ) : (
              <p className="px-2 py-1.5 text-[var(--st-text-secondary)]">No employee.</p>
            )}
          </RailCard>
          <RailCard title="Chain — next step">
            <RailLink
              href={`/dashboard/hrm/hr/probation/new?fromKind=onboarding&fromId=${id}${
                o.employeeId ? `&employeeId=${o.employeeId}` : ''
              }`}
              label="Start probation"
              hint="Move to probation"
            />
          </RailCard>
          {Array.isArray(o.checklist) && o.checklist.length > 0 ? (
            <RailCard title="Checklist">
              <p className="text-[var(--st-text-secondary)]">
                {o.checklist.length} item{o.checklist.length === 1 ? '' : 's'}
              </p>
              <ul className="space-y-1 text-[var(--st-text)]">
                {o.checklist.slice(0, 6).map((t: any, i: number) => (
                  <li key={i}>• {t.title}</li>
                ))}
              </ul>
            </RailCard>
          ) : null}
        </>
      }
      audit={<EntityAuditTimeline entityKind="onboarding" entityId={id} />}
    >
      <DetailCard
        title="Employee Information"
        rows={[
          { label: 'Name', value: o.employeeName },
          {
            label: 'Employee ID',
            value: o.employeeId ? (
              <Link
                href={`/dashboard/hrm/hr/directory/${o.employeeId}`}
                className="text-[var(--st-text)] hover:underline"
              >
                {String(o.employeeId)}
              </Link>
            ) : (
              '—'
            ),
          },
          { label: 'Job ID', value: o.jobId },
          { label: 'Joining date', value: fmtDate(o.joiningDate) },
          {
            label: 'Status',
            value: <StatusPill label={status} tone={tone} />,
          },
          { label: 'Department', value: o.departmentId },
        ]}
      />
      {o.description ? (
        <DetailCard title="Description">
          <p className="whitespace-pre-wrap">{o.description}</p>
        </DetailCard>
      ) : null}
      {Array.isArray(o.checklist) && o.checklist.length > 0 ? (
        <DetailCard title="Checklist">
          <ul className="space-y-1.5">
            {o.checklist.map((t: any, i: number) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-2"
              >
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-[var(--st-text-secondary)]" />
                <span className="flex min-w-0 flex-col">
                  <span className="text-[var(--st-text)]">{t.title}</span>
                  <span className="text-[11.5px] text-[var(--st-text-secondary)]">
                    {t.dueDate ? `Due ${fmtDate(t.dueDate)}` : '—'}
                    {t.assigneeId ? ` · ${t.assigneeId}` : ''}
                    {t.category ? ` · ${t.category}` : ''}
                  </span>
                </span>
              </li>
            ))}
          </ul>
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

export default async function OnboardingDetailPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <React.Suspense fallback={<div className="p-4">Loading onboarding...</div>}>
      <OnboardingDetailContainer id={id} />
    </React.Suspense>
  );
}
