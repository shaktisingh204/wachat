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

import { getOnboardingTemplates } from '@/app/actions/hr.actions';
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

export default async function OnboardingDetailPage({ params }: PageProps) {
  const { id } = await params;
  const all = (await getOnboardingTemplates()) as any[];
  const o = all.find((x) => String(x._id) === id);
  if (!o) notFound();

  const status = o.status || 'pending';
  const tone = statusToTone(status);

  return (
    <RecruitmentDetailShell
      title={o.task_name || o.name || 'Onboarding'}
      eyebrow="ONBOARDING"
      status={{ label: status, tone: tone as any }}
      back={{ href: '/dashboard/crm/hr/onboarding', label: 'All onboarding' }}
      actions={[
        {
          key: 'edit',
          label: 'Edit',
          icon: <Pencil className="h-3.5 w-3.5" />,
          href: `/dashboard/crm/hr/onboarding/${id}/edit`,
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
          href: `/dashboard/crm/hr/onboarding/${id}?print=1`,
        },
        {
          key: 'activity',
          label: 'Activity',
          icon: <Activity className="h-3.5 w-3.5" />,
          href: `/dashboard/crm/hr/onboarding/${id}/activity`,
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
            {o.employee_id ? (
              <RailLink
                href={`/dashboard/crm/hr/directory/${o.employee_id}`}
                label="Linked employee"
                hint={String(o.employee_id)}
              />
            ) : (
              <p className="px-2 py-1.5 text-zoru-ink-muted">No employee.</p>
            )}
          </RailCard>
          <RailCard title="Chain — next step">
            <RailLink
              href={`/dashboard/crm/hr/probation/new?fromKind=onboarding&fromId=${id}${
                o.employee_id ? `&employeeId=${o.employee_id}` : ''
              }`}
              label="Start probation"
              hint="Move to probation"
            />
          </RailCard>
          {Array.isArray(o.tasks) && o.tasks.length > 0 ? (
            <RailCard title="Checklist">
              <p className="text-zoru-ink-muted">
                {o.tasks.length} item{o.tasks.length === 1 ? '' : 's'}
              </p>
              <ul className="space-y-1 text-zoru-ink">
                {o.tasks.slice(0, 6).map((t: any, i: number) => (
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
        title="Task"
        rows={[
          { label: 'Task name', value: o.task_name },
          {
            label: 'Employee',
            value: o.employee_id ? (
              <Link
                href={`/dashboard/crm/hr/directory/${o.employee_id}`}
                className="text-zoru-ink hover:underline"
              >
                {String(o.employee_id)}
              </Link>
            ) : (
              '—'
            ),
          },
          { label: 'Assigned to', value: o.assigned_to },
          { label: 'Due date', value: fmtDate(o.due_date) },
          {
            label: 'Status',
            value: <StatusPill label={status} tone={tone} />,
          },
          { label: 'Category', value: o.category },
        ]}
      />
      {o.description ? (
        <DetailCard title="Description">
          <p className="whitespace-pre-wrap">{o.description}</p>
        </DetailCard>
      ) : null}
      {Array.isArray(o.tasks) && o.tasks.length > 0 ? (
        <DetailCard title="Checklist">
          <ul className="space-y-1.5">
            {o.tasks.map((t: any, i: number) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-2"
              >
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-zoru-ink-muted" />
                <span className="flex min-w-0 flex-col">
                  <span className="text-zoru-ink">{t.title}</span>
                  <span className="text-[11.5px] text-zoru-ink-muted">
                    {t.dueDays ? `Due in ${t.dueDays} days` : '—'}
                    {t.assignee ? ` · ${t.assignee}` : ''}
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

function fmtDate(d?: string | Date | null) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return '—';
  }
}
