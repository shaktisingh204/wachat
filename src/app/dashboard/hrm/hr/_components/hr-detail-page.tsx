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
import { Pencil } from 'lucide-react';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { statusToTone, type StatusTone } from '@/components/crm/status-pill';
import {
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
} from '@/components/zoruui';

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
   * Footer activity slot — pass `<EntityAuditTimeline />` here from a
   * server-side caller. The previous `auditKind` string prop was
   * removed because every existing caller is a `'use client'` page and
   * cannot render an async server child; converting those pages to
   * server is the proper place to wire audit back in.
   */
  audit?: React.ReactNode;
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
      <ZoruButton asChild variant="outline" size="sm">
        <Link href={editHref}>
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Link>
      </ZoruButton>
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

  return (
    <EntityDetailShell
      title={title}
      eyebrow={eyebrow}
      status={status ? { label: status.label, tone: resolvedTone } : undefined}
      actions={actions}
      back={{ href: listHref, label: listLabel }}
      rightRail={rightRail}
      audit={audit}
    >
      {sections.map((sec) => (
        <ZoruCard key={sec.title}>
          <ZoruCardHeader>
            <ZoruCardTitle>{sec.title}</ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent>
            <dl className="grid gap-4 md:grid-cols-2">
              {sec.fields.map((f, i) => (
                <div
                  key={`${sec.title}-${i}`}
                  className={f.fullWidth ? 'md:col-span-2' : ''}
                >
                  <dt className="text-xs uppercase tracking-wide text-zoru-ink-muted">
                    {f.label}
                  </dt>
                  <dd className="mt-1 text-sm text-zoru-ink">
                    {f.value === undefined || f.value === null || f.value === ''
                      ? <span className="text-zoru-ink-muted">—</span>
                      : f.value}
                  </dd>
                </div>
              ))}
            </dl>
          </ZoruCardContent>
        </ZoruCard>
      ))}
    </EntityDetailShell>
  );
}
