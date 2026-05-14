'use client';

/**
 * HrDetailPage — §1D.2-compliant detail layout for HR / performance
 * entities. Composes <EntityDetailShell> with a header action group
 * (Edit / Delete / Back), an Overview card listing every field, and
 * an optional Activity audit footer.
 *
 * Each entity passes:
 *   - title / eyebrow / status pill
 *   - sections of fields { label, value }
 *   - related rails (right-rail cards) — optional
 *   - editHref, listHref
 *   - deleteAction
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { statusToTone, type StatusTone } from '@/components/crm/status-pill';
import {
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  useZoruToast,
} from '@/components/zoruui';

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
  /** Audit timeline binding. */
  auditKind?: string;
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
  auditKind,
  extraActions,
}: HrDetailPageProps): React.JSX.Element {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [deleting, setDeleting] = React.useState(false);

  const handleConfirmDelete = React.useCallback(async () => {
    const res = await deleteAction(entityId);
    if (res.success) {
      toast({ title: 'Deleted' });
      router.push(listHref);
      router.refresh();
    } else {
      toast({
        title: 'Delete failed',
        description: res.error,
        variant: 'destructive',
      });
    }
  }, [deleteAction, entityId, listHref, router, toast]);

  const actions = (
    <>
      {extraActions}
      <ZoruButton asChild variant="outline" size="sm">
        <Link href={editHref}>
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Link>
      </ZoruButton>
      <ZoruButton
        variant="destructive"
        size="sm"
        onClick={() => setDeleting(true)}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete
      </ZoruButton>
    </>
  );

  // EntityDetailShell renders the status pill internally — we just pass
  // it through. Tone falls back to a statusToTone heuristic.
  const resolvedTone = status?.tone ?? (status ? statusToTone(status.label) : undefined);

  return (
    <>
      <EntityDetailShell
        title={title}
        eyebrow={eyebrow}
        status={status ? { label: status.label, tone: resolvedTone } : undefined}
        actions={actions}
        back={{ href: listHref, label: listLabel }}
        rightRail={rightRail}
        audit={auditKind ? { entityKind: auditKind, entityId } : undefined}
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

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete this entry?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
