import { Suspense } from 'react';
import { Badge, Button, Card } from '@/components/zoruui';
import {
  notFound } from 'next/navigation';
import Link from 'next/link';
import {
    ClipboardList,
  Pencil,
  FilePlus,
  Copy,
  Archive,
  ArrowLeft,
  } from 'lucide-react';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

/**
 * Document template detail page (§1D.2).
 *
 * Loads a single document from `hr_document_templates` and renders an
 * overview card + template body. Actions: Edit · Use template ·
 * Duplicate · Archive (stubs).
 */

import {
    getHrEntityById,
    fmtDate,
    fmtText,
} from '../../_components/hr-detail-loader';
import { HrDetailGrid, HrDetailRow } from '../../_components/hr-detail-grid';
import { HrActionButtons } from '../../_components/hr-action-buttons';
import {
    archiveDocumentTemplate,
    duplicateDocumentTemplate,
} from '@/app/actions/hr-status.actions';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ id: string }>;
}

const BASE = '/dashboard/hrm/hr/document-templates';

async function DocumentTemplateDetailPageContainer({ params }: PageProps) {
    const { id } = await params;
    const doc = await getHrEntityById('hr_document_templates', id);
    if (!doc) notFound();

    const t = doc as Record<string, unknown>;
    const name = (t.name as string) || 'Untitled template';
    const category = String(t.category || 'general');
    const body = (t.body as string) || (t.content as string) || '';
    const placeholders: string[] = Array.isArray(t.placeholders)
        ? (t.placeholders as string[])
        : [];

    return (
        <EntityDetailShell
            title={name}
            eyebrow="HR · TEMPLATE"
            back={{ href: BASE, label: 'All templates' }}
            status={{ label: category, tone: 'neutral' }}
            actions={
                <>
                    <Link href={BASE}>
                        <Button variant="outline" size="sm">
                            <ArrowLeft className="h-4 w-4" /> Back
                        </Button>
                    </Link>
                    <Link href={`${BASE}/${id}/edit`}>
                        <Button size="sm">
                            <Pencil className="h-4 w-4" /> Edit
                        </Button>
                    </Link>
                    <Link href={`/dashboard/hrm/hr/documents/new?templateId=${id}`}>
                        <Button variant="outline" size="sm">
                            <FilePlus className="h-4 w-4" /> Use template
                        </Button>
                    </Link>
                    <HrActionButtons
                        actions={[
                            {
                                key: 'duplicate',
                                kind: 'action',
                                label: 'Duplicate',
                                icon: <Copy className="h-4 w-4" />,
                                onRun: () => duplicateDocumentTemplate(id),
                            },
                            {
                                key: 'archive',
                                kind: 'confirm',
                                label: 'Archive',
                                icon: <Archive className="h-4 w-4" />,
                                variant: 'destructive',
                                confirmTitle: 'Archive this template?',
                                confirmDescription:
                                    'Archived templates are hidden from the active template list but can be restored.',
                                confirmLabel: 'Archive',
                                onRun: () => archiveDocumentTemplate(id),
                            },
                        ]}
                    />
                </>
            }
            audit={<EntityAuditTimeline entityKind="document_template" entityId={id} />}
        >
            <HrDetailGrid title="Overview">
                <HrDetailRow label="Name">{name}</HrDetailRow>
                <HrDetailRow label="Category">{category}</HrDetailRow>
                <HrDetailRow label="Version">{fmtText(t.version)}</HrDetailRow>
                <HrDetailRow label="Last updated">{fmtDate(t.updatedAt || t.createdAt)}</HrDetailRow>
                {t.description ? (
                    <HrDetailRow label="Description" fullWidth>
                        {String(t.description)}
                    </HrDetailRow>
                ) : null}
            </HrDetailGrid>

            {placeholders.length > 0 ? (
                <Card className="p-6">
                    <div className="mb-3 text-[15px] font-medium text-zoru-ink">
                        Merge tokens
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {placeholders.map((p, i) => (
                            <Badge key={i} variant="ghost">{`{{${p}}}`}</Badge>
                        ))}
                    </div>
                    <p className="mt-3 text-[11.5px] text-zoru-ink-muted">
                        Use {`{{token}}`} syntax inside the template body. Tokens are replaced when the template is used.
                    </p>
                </Card>
            ) : null}

            <Card className="p-6">
                <div className="mb-3 text-[15px] font-medium text-zoru-ink">Body</div>
                <pre className="whitespace-pre-wrap rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-4 text-[13px] text-zoru-ink font-sans">
                    {body || (
                        <span className="text-zoru-ink-muted">No body content.</span>
                    )}
                </pre>
            </Card>

            <ClipboardList className="hidden" />
        </EntityDetailShell>
    );
}

export default function DocumentTemplateDetailPage({ params }: PageProps) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DocumentTemplateDetailPageContainer params={params} />
    </Suspense>
  );
}
