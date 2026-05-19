import { notFound } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { getOnboardingTemplateById } from '@/app/actions/hr.actions';
import {
  OnboardingForm,
  type OnboardingFormInitial,
} from '../../_components/onboarding-form';

/**
 * Edit onboarding template — §3.3.2. Server wrapper renders the deepened
 * multi-phase form with an audit rail in the right column.
 */

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ id: string }>;
}

type Phase = 'pre_joining' | 'day_1' | 'week_1' | 'month_1';

const VALID_PHASES: ReadonlySet<Phase> = new Set<Phase>([
    'pre_joining',
    'day_1',
    'week_1',
    'month_1',
]);

export default async function EditOnboardingTemplatePage({
    params,
}: PageProps) {
    const { id } = await params;
    const doc = (await getOnboardingTemplateById(id)) as
        | (Record<string, unknown> & { _id?: unknown })
        | null;
    if (!doc) notFound();

    const d = doc as Record<string, unknown> & { _id?: unknown };

    const tasksRaw = d.tasks;
    const tasks = Array.isArray(tasksRaw)
        ? (tasksRaw as Record<string, unknown>[]).map((t) => {
              const pStr = t.phase != null ? String(t.phase) : '';
              const phase = VALID_PHASES.has(pStr as Phase)
                  ? (pStr as Phase)
                  : ('pre_joining' as Phase);
              return {
                  id: String(t.id ?? ''),
                  title: String(t.title ?? ''),
                  dueDays:
                      typeof t.dueDays === 'number'
                          ? t.dueDays
                          : t.dueDays != null
                            ? Number(t.dueDays)
                            : undefined,
                  assigneeId:
                      t.assigneeId != null
                          ? String(t.assigneeId)
                          : undefined,
                  assigneeName:
                      t.assigneeName != null
                          ? String(t.assigneeName)
                          : t.assignee != null
                            ? String(t.assignee)
                            : undefined,
                  category:
                      t.category != null ? String(t.category) : undefined,
                  description:
                      t.description != null
                          ? String(t.description)
                          : undefined,
                  phase,
              };
          })
        : [];

    const docsRaw = d.documents;
    const documents = Array.isArray(docsRaw)
        ? (docsRaw as Record<string, unknown>[]).map((dd) => ({
              id: String(dd.id ?? ''),
              url: String(dd.url ?? ''),
              name: String(dd.name ?? ''),
              mime: dd.mime != null ? String(dd.mime) : undefined,
              size:
                  typeof dd.size === 'number'
                      ? dd.size
                      : dd.size != null
                        ? Number(dd.size)
                        : undefined,
          }))
        : [];

    const initial: OnboardingFormInitial = {
        _id: String(d._id ?? id),
        name: (d.name as string | undefined) ?? '',
        department:
            d.department != null ? String(d.department) : undefined,
        estimatedDays:
            typeof d.estimatedDays === 'number'
                ? d.estimatedDays
                : d.estimatedDays != null
                  ? Number(d.estimatedDays)
                  : undefined,
        mentorId:
            d.mentorId != null ? String(d.mentorId) : undefined,
        mentorName:
            d.mentorName != null ? String(d.mentorName) : undefined,
        buddyId: d.buddyId != null ? String(d.buddyId) : undefined,
        buddyName:
            d.buddyName != null ? String(d.buddyName) : undefined,
        tasks,
        documents,
    };

    return (
        <EntityDetailShell
            eyebrow="ONBOARDING"
            title="Edit onboarding template"
            back={{
                href: '/dashboard/crm/hr/onboarding',
                label: 'Templates',
            }}
            rightRail={
                <EntityAuditTimeline
                    entityKind="onboarding_template"
                    entityId={String(id)}
                    title="Activity"
                    limit={25}
                />
            }
        >
            <OnboardingForm initial={initial} />
        </EntityDetailShell>
    );
}
