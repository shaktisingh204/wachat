'use client';

/**
 * Project Activity — timeline feed (§1D).
 * KPI (events today / week / top actor / top action), search + actor +
 * entity-kind + date-range filters, bulk-delete + CSV/XLSX export.
 *
 * Activity is rendered as a vertical timeline (not a regular table) so
 * the user can scan who-did-what across all their projects.
 */

import { ActivityTimelinePage } from '../_components/activity-timeline-page';
import {
  getWsProjectActivities,
  bulkDeleteWsProjectActivities,
} from '@/app/actions/worksuite/projects.actions';
import type { WsProjectActivity } from '@/lib/worksuite/project-types';

type Row = WsProjectActivity & { _id: string };

export default function ProjectActivityPage() {
  return (
    <ActivityTimelinePage
      getList={() => getWsProjectActivities() as unknown as Promise<Row[]>}
      bulkDelete={bulkDeleteWsProjectActivities}
    />
  );
}
