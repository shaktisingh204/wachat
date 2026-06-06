'use client';

/**
 * SabCRM — record detail tabs.
 *
 * Client shell that frames a single record's detail surface in three tabs:
 *
 *   1. **Details**  — the metadata-driven {@link RecordDetail} read panel
 *      (header + per-type field rows + system footer), inline-editable through
 *      the gated `updateRecordAction` the host wires up.
 *   2. **Related**  — one {@link RelatedPanel} per RELATION field, listing the
 *      records that point at (or are pointed at by) this record. The related
 *      records are resolved on the server and handed in as a serialisable map.
 *   3. **Activity** — a named placeholder slot (`activitySlot`) that P3 fills
 *      with the timeline; rendered as an empty-state until then.
 *
 * The tab strip uses ZoruUI's `Tabs` primitives (Radix-backed, hence this
 * client boundary). The page (`/sabcrm/[objectSlug]/[recordId]`) stays a server
 * component: it runs the auth/RBAC/plan-gated actions, resolves the object +
 * record + related map, and hands them here for rendering.
 *
 * Relation values are resolved once on the server, so this component renders
 * relation labels synchronously via {@link relationLabelMap}; it performs no
 * data fetching of its own.
 */

import * as React from 'react';
import Link from 'next/link';
import { ArrowUpRight, Link2 } from 'lucide-react';

import { Tabs, TabsList, TabsTrigger, TabsContent, Card, CardBody, CardHeader, CardTitle, Badge, EmptyState, Separator, cn } from '@/components/sabcrm/20ui';
import type {
  CrmRecordWithLabel,
  FieldMetadata,
  ObjectMetadata,
} from '@/lib/sabcrm/types';

import { RecordDetail } from './record-detail';

/** Tab identifiers used as `Tabs` values + content keys. */
const TAB_DETAILS = 'details';
const TAB_RELATED = 'related';
const TAB_ACTIVITY = 'activity';

export interface RecordDetailTabsProps {
  /** Object metadata (field schema driving the detail + related panels). */
  object: ObjectMetadata;
  /** The record being viewed (with its resolved display label). */
  record: CrmRecordWithLabel;
  /**
   * RELATION field key → the related records resolved on the server. Missing /
   * empty keys render an empty panel. Mirrors `listRelatedRecordsAction`'s
   * `Record<string, CrmRecordWithLabel[]>` return shape.
   */
  related?: Record<string, CrmRecordWithLabel[]>;
  /** Active project override forwarded to {@link RecordDetail}'s actions. */
  projectId?: string;
  /** Whether the current user may edit (gates the Edit affordance). */
  canEdit?: boolean;
  /** Whether the current user may delete (gates the Delete affordance). */
  canDelete?: boolean;
  /** Host-supplied edit handler (opens the shared record form dialog). */
  onEdit?: (record: CrmRecordWithLabel) => void;
  /** Host-supplied post-delete handler (navigate away). */
  onDeleted?: (id: string) => void;
  /**
   * Timeline slot for the Activity tab. P3 renders the record's activity feed
   * here; until then the tab shows an empty state.
   */
  activitySlot?: React.ReactNode;
  /** Tab selected on first render. Defaults to "Details". */
  defaultTab?: 'details' | 'related' | 'activity';
  className?: string;
}

/**
 * Builds a flat `relatedRecordId → label` lookup across every resolved relation
 * so {@link RecordDetail}'s RELATION rows can show human labels instead of ids.
 */
function relationLabelMap(
  related: Record<string, CrmRecordWithLabel[]> | undefined,
): Map<string, string> {
  const map = new Map<string, string>();
  if (!related) return map;
  for (const records of Object.values(related)) {
    for (const r of records) map.set(r._id, r.label);
  }
  return map;
}

/** The object's RELATION fields, in declaration order. */
function relationFields(object: ObjectMetadata): FieldMetadata[] {
  return object.fields.filter((f) => f.type === 'RELATION' && !!f.relation);
}

/** One related-records panel for a single RELATION field. */
function RelatedPanel({
  field,
  records,
}: {
  field: FieldMetadata;
  records: CrmRecordWithLabel[];
}): React.ReactElement {
  const targetSlug = field.relation?.targetObject ?? '';
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 py-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Link2 className="h-4 w-4 text-[var(--st-text-secondary)]" />
          {field.label}
        </CardTitle>
        <Badge variant="outline">{records.length}</Badge>
      </CardHeader>
      <Separator />
      <CardBody className="p-0">
        {records.length === 0 ? (
          <div className="px-5 py-6">
            <EmptyState
              title={`No related ${field.label.toLowerCase()}`}
              description="Linked records will appear here."
            />
          </div>
        ) : (
          <ul className="divide-y divide-[var(--st-border)]">
            {records.map((r) => (
              <li key={r._id}>
                <Link
                  href={`/sabcrm/${targetSlug}/${r._id}`}
                  className="flex items-center justify-between gap-3 px-5 py-3 text-sm transition-colors hover:bg-[var(--st-bg-muted)]"
                >
                  <span className="min-w-0 truncate font-medium">{r.label}</span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--st-text-secondary)]" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

/**
 * Tabbed detail surface for a single SabCRM record: Details / Related /
 * Activity. See the module docstring for the contract.
 */
export function RecordDetailTabs({
  object,
  record,
  related,
  projectId,
  canEdit = true,
  canDelete = true,
  onEdit,
  onDeleted,
  activitySlot,
  defaultTab = 'details',
  className,
}: RecordDetailTabsProps): React.ReactElement {
  const relations = React.useMemo(() => relationFields(object), [object]);

  const labels = React.useMemo(() => relationLabelMap(related), [related]);
  const resolveRelationLabel = React.useCallback(
    (id: string): string | undefined => labels.get(id),
    [labels],
  );

  const relatedTotal = React.useMemo(
    () =>
      relations.reduce((sum, f) => sum + (related?.[f.key]?.length ?? 0), 0),
    [relations, related],
  );

  return (
    <Tabs
      defaultValue={defaultTab}
      className={cn('flex w-full flex-col gap-4', className)}
    >
      <TabsList>
        <TabsTrigger value={TAB_DETAILS}>Details</TabsTrigger>
        <TabsTrigger value={TAB_RELATED}>
          Related
          {relatedTotal > 0 && (
            <Badge variant="outline" className="ml-2">
              {relatedTotal}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value={TAB_ACTIVITY}>Activity</TabsTrigger>
      </TabsList>

      <TabsContent value={TAB_DETAILS}>
        <RecordDetail
          object={object}
          record={record}
          projectId={projectId}
          canEdit={canEdit}
          canDelete={canDelete}
          onEdit={onEdit}
          onDeleted={onDeleted}
          resolveRelationLabel={resolveRelationLabel}
        />
      </TabsContent>

      <TabsContent value={TAB_RELATED}>
        {relations.length === 0 ? (
          <Card>
            <CardBody className="py-10">
              <EmptyState
                title="No related records"
                description={`${object.labelSingular} has no relationships to other objects.`}
              />
            </CardBody>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {relations.map((field) => (
              <RelatedPanel
                key={field.key}
                field={field}
                records={related?.[field.key] ?? []}
              />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value={TAB_ACTIVITY}>
        {activitySlot ?? (
          <Card>
            <CardBody className="py-10">
              <EmptyState
                title="No activity yet"
                description="The activity timeline for this record will appear here."
              />
            </CardBody>
          </Card>
        )}
      </TabsContent>
    </Tabs>
  );
}
