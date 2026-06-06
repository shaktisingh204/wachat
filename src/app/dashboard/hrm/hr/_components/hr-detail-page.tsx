import { Button, Card, CardBody, CardHeader, CardTitle } from '@/components/sabcrm/20ui/compat';
import {
  Pencil } from 'lucide-react';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { statusToTone,
  type StatusTone } from '@/components/crm/status-pill';

/**
 * HrDetailPage — §1D.2-compliant detail layout for HR / performance
 * entities. Composes <EntityDetailShell> with a header action group
 * (Edit / Delete / Back), an Overview card listing every field, and
 * an optional Activity audit footer.
 *
 * Server component — interactive delete UI lives in `<HrDeleteButton>`
 * (a tiny client island) so the shell itself stays server-side and
 * keeps mongodb / server-only deps out of the client bundle.
 */

import * as React from 'react';
import Link from 'next/link';

import { HrDeleteButton } from './hr-delete-button';

export interface HrDetailField {
  label: string;
  value: React.ReactNode;
  fullWidth?: boolean;
}

export interface HrDetailSection {
  title: string;
  fields: HrDetailField[];
}

export interface HrDetailPageProps {
  title: string;
  eyebrow?: string;
  status?: { label: string; tone?: StatusTone };
  listHref: string;
  listLabel?: string;
  editHref: string;
  /** Server delete action returning `{ success, error? }`. */
  deleteAction: (id: string) => Promise<{ success: boolean; error?: string }>;
  entityId: string;
  sections: HrDetailSection[];
  /** Optional right-rail content. */
  rightRail?: React.ReactNode;
  /**
   * Footer activity slot. Either pass an object
   * `{ entityKind, entityId }` (the shell renders
   * `<EntityAuditTimeline>` for you — the common case) or pass any
   * `ReactNode` (escape hatch when a custom footer is needed).
   * Mirrors the union shape of `EntityDetailShell['audit']`.
   */
  audit?:
    | { entityKind: string; entityId: string }
    | React.ReactNode;
  /** Extra action buttons rendered before Edit/Delete. */
  extraActions?: React.ReactNode;
}

export function HrDetailPage({
  title,
  eyebrow,
  status,
  listHref,
  listLabel = 'Back to list',
  editHref,
  deleteAction,
  entityId,
  sections,
  rightRail,
  audit,
  extraActions,
}: HrDetailPageProps): React.JSX.Element {
  const actions = (
    <>
      {extraActions}
      <Button asChild variant="outline" size="sm">
        <Link href={editHref}>
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Link>
      </Button>
      <HrDeleteButton
        entityId={entityId}
        listHref={listHref}
        deleteAction={deleteAction}
      />
    </>
  );

  // EntityDetailShell renders the status pill internally — we just pass
  // it through. Tone falls back to a statusToTone heuristic.
  const resolvedTone = status?.tone ?? (status ? statusToTone(status.label) : undefined);

  // Resolve the audit prop locally so the object form renders the
  // shared `<EntityAuditTimeline>` and ReactNode forms pass through
  // for back-compat. Mirrors `EntityDetailShell`'s own handling.
  const auditNode: React.ReactNode = isAuditDescriptor(audit)
    ? (
        <EntityAuditTimeline
          entityKind={audit.entityKind}
          entityId={audit.entityId}
        />
      )
    : (audit as React.ReactNode);

  return (
    <EntityDetailShell
      title={title}
      eyebrow={eyebrow}
      status={status ? { label: status.label, tone: resolvedTone } : undefined}
      actions={actions}
      back={{ href: listHref, label: listLabel }}
      rightRail={rightRail}
      audit={auditNode}
    >
      {sections.map((sec) => (
        <Card key={sec.title}>
          <CardHeader>
            <CardTitle>{sec.title}</CardTitle>
          </CardHeader>
          <CardBody>
            <dl className="grid gap-4 md:grid-cols-2">
              {sec.fields.map((f, i) => (
                <div
                  key={`${sec.title}-${i}`}
                  className={f.fullWidth ? 'md:col-span-2' : ''}
                >
                  <dt className="text-xs uppercase tracking-wide text-[var(--st-text-secondary)]">
                    {f.label}
                  </dt>
                  <dd className="mt-1 text-sm text-[var(--st-text)]">
                    {f.value === undefined || f.value === null || f.value === ''
                      ? <span className="text-[var(--st-text-secondary)]">—</span>
                      : f.value}
                  </dd>
                </div>
              ))}
            </dl>
          </CardBody>
        </Card>
      ))}
    </EntityDetailShell>
  );
}

function isAuditDescriptor(
  value: unknown,
): value is { entityKind: string; entityId: string } {
  if (!value || typeof value !== 'object') return false;
  if (React.isValidElement(value)) return false;
  const v = value as { entityKind?: unknown; entityId?: unknown };
  return typeof v.entityKind === 'string' && typeof v.entityId === 'string';
}
