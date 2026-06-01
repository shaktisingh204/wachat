export const dynamic = 'force-dynamic';

/**
 * SabCRM record DETAIL page — `/sabcrm/[objectSlug]/[recordId]`.
 *
 * Server component. Auth / onboarding / RBAC / project context are already
 * enforced by the `/sabcrm` layout (which wraps every child in `RBACGuard` +
 * `ProjectProvider` inside the `.zoruui` scope), and the SabCRM server actions
 * themselves re-run the full session → project → RBAC → plan gate on every
 * call — so this page does NOT re-implement that pipeline. It simply:
 *
 *   1. resolves the object metadata (the field schema that drives the panel)
 *      via {@link listObjectsAction}, filtered to the route's `objectSlug`,
 *   2. loads the single record via {@link getRecordAction},
 *   3. resolves the record's RELATION fields via
 *      {@link listRelatedRecordsAction} (server-side, gated), and
 *   4. hands all three to the `RecordDetailTabs` client component, which frames
 *      them in ZoruUI tabs: **Details** (the per-type field panel, inline-edited
 *      through `updateRecordAction`), **Related** (one panel per relation) and
 *      **Activity** — the timeline + composer surface, mounted here via the
 *      `RecordActivity` client component into `RecordDetailTabs`'s `activitySlot`.
 *      `RecordActivity` owns its own gated data fetching (list/create/update/
 *      delete activities) so the tab loads lazily and refreshes after each
 *      mutation without a full page reload.
 *
 * Any gate failure or missing object/record resolves to a 404 — the actions
 * never throw, returning a typed `{ ok: false, error }` instead. The related
 * map is best-effort: if relation resolution fails the page still renders with
 * an empty Related tab rather than 404-ing.
 */

import { notFound } from 'next/navigation';

import {
  getRecordAction,
  listObjectsAction,
  listRelatedRecordsAction,
} from '@/app/actions/sabcrm.actions';
import { RecordActivity } from '@/components/sabcrm/record-activity';
import { RecordDetailTabs } from '@/components/sabcrm/record-detail-tabs';
import type { CrmRecordWithLabel, ObjectMetadata } from '@/lib/sabcrm/types';

interface RecordDetailPageProps {
  /** Next.js async route params. */
  params: Promise<{ objectSlug: string; recordId: string }>;
}

export default async function RecordDetailPage({ params }: RecordDetailPageProps) {
  const { objectSlug, recordId } = await params;

  // Resolve object metadata — this is the field schema the detail panel renders
  // by. The action runs the full auth/RBAC/plan gate internally.
  const objectsResult = await listObjectsAction();
  if (!objectsResult.ok) {
    notFound();
  }
  const object: ObjectMetadata | undefined = objectsResult.data.find(
    (o) => o.slug === objectSlug,
  );
  if (!object) {
    notFound();
  }

  // Load the single record (with its resolved display label). Scoping to the
  // active project + tenant happens inside the action.
  const recordResult = await getRecordAction(recordId);
  if (!recordResult.ok) {
    notFound();
  }
  const record: CrmRecordWithLabel = recordResult.data;

  // Guard against a record that belongs to a different object than the URL.
  if (record.object !== object.slug) {
    notFound();
  }

  // Resolve the record's RELATION fields for the "Related" tab. Best-effort:
  // a failure (or an object with no relations) leaves the map empty so the
  // page still renders. The action runs the same gated pipeline internally.
  const relatedResult = await listRelatedRecordsAction(record._id);
  const related: Record<string, CrmRecordWithLabel[]> = relatedResult.ok
    ? relatedResult.data
    : {};

  return (
    <RecordDetailTabs
      object={object}
      record={record}
      related={related}
      activitySlot={<RecordActivity object={object} record={record} />}
    />
  );
}
