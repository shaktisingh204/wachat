/**
 * SabBigin — unified Activities module.
 *
 * One surface for every touch-point (calls, emails, tasks, meetings, notes).
 * The legacy `/calls` and `/emails` routes now redirect here with a `?type=`
 * pre-filter; `?view=list|kanban|calendar` chooses the renderer.
 *
 * Reads the shared `crm_activities` collection via `listCrmActivities` and the
 * KPI strip via `getCrmActivityPageKpis` (both in `crm-activity.actions.ts`),
 * so the SabBigin module and the full CRM stay in sync. Writes (log / complete
 * / delete) go through `sabbigin-activities.actions.ts` + the existing bulk
 * actions.
 */

import { Activity, CircleCheck, TriangleAlert } from 'lucide-react';

import {
  StatCard,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
} from '@/components/sabcrm/20ui';
import {
  listCrmActivities,
  getCrmActivityPageKpis,
} from '@/app/actions/crm-activity.actions';
import type { SabActivityRow } from '@/components/sabbigin/lib/types';
import { LogActivityButton } from '@/components/sabbigin/activities/log-activity-button';

import { ActivitiesClient } from './_components/activities-client';

export const dynamic = 'force-dynamic';

type ActivitiesView = 'list' | 'kanban' | 'calendar';
type TypeFilter = 'all' | 'call' | 'email' | 'task' | 'meeting';

const VIEWS: ActivitiesView[] = ['list', 'kanban', 'calendar'];
const TYPE_FILTERS: TypeFilter[] = ['all', 'call', 'email', 'task', 'meeting'];

interface SearchParams {
  view?: string;
  type?: string;
}

interface PageProps {
  searchParams: Promise<SearchParams>;
}

/** A loose view of the stored doc — `listCrmActivities` widens to `unknown` at runtime. */
interface RawActivityDoc {
  _id?: unknown;
  type?: string;
  typeLabel?: string;
  subject?: string;
  title?: string;
  status?: string;
  direction?: string;
  dueDate?: string;
  contactId?: unknown;
  contactName?: string;
  dealId?: unknown;
  notes?: string;
  outcome?: string;
  createdAt?: string;
}

function toRow(doc: RawActivityDoc): SabActivityRow {
  return {
    _id: String(doc._id ?? ''),
    type: String(doc.type ?? doc.typeLabel ?? 'task'),
    title: doc.title ?? doc.subject ?? null,
    status: doc.status ?? 'open',
    direction: doc.direction ?? null,
    dueDate: doc.dueDate ?? null,
    contactId: doc.contactId != null ? String(doc.contactId) : null,
    contactName: doc.contactName ?? null,
    dealId: doc.dealId != null ? String(doc.dealId) : null,
    notes: doc.notes ?? null,
    outcome: doc.outcome ?? null,
    createdAt: doc.createdAt ?? null,
  };
}

export default async function SabbiginActivitiesPage({ searchParams }: PageProps) {
  const sp = await searchParams;

  const view: ActivitiesView = VIEWS.includes(sp.view as ActivitiesView)
    ? (sp.view as ActivitiesView)
    : 'list';
  const type: TypeFilter = TYPE_FILTERS.includes(sp.type as TypeFilter)
    ? (sp.type as TypeFilter)
    : 'all';

  // Fetch a generous page of activities + the KPI strip in parallel. The client
  // filters by type locally so view/type toggles never refetch.
  const [list, kpis] = await Promise.all([
    listCrmActivities({
      type: type === 'all' ? undefined : type,
      pageSize: 200,
    }),
    getCrmActivityPageKpis(),
  ]);

  const activities = (list.items as RawActivityDoc[]).map(toRow);

  // Seed the header "Log activity" modal with the active type filter.
  const defaultType =
    type === 'email'
      ? 'Email'
      : type === 'task'
        ? 'Task'
        : type === 'meeting'
          ? 'Meeting'
          : 'Call';

  return (
    <div className="20ui flex w-full flex-col gap-5">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabBigin</PageEyebrow>
          <PageTitle>Activities</PageTitle>
          <PageDescription>
            Every call, email, task, and meeting on one timeline. Log a
            touch-point and watch it flow through your pipeline.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <LogActivityButton defaultType={defaultType} />
        </PageActions>
      </PageHeader>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          label="Open activities"
          value={kpis.openActivities}
          icon={Activity}
          accent="#3b7af5"
        />
        <StatCard
          label="Completed this week"
          value={kpis.completedThisWeek}
          icon={CircleCheck}
          accent="#1f9d55"
        />
        <StatCard
          label="Overdue"
          value={kpis.overdueActivities}
          icon={TriangleAlert}
          accent="#dc2626"
        />
      </div>

      <ActivitiesClient
        activities={activities}
        initialView={view}
        initialType={type}
      />
    </div>
  );
}
