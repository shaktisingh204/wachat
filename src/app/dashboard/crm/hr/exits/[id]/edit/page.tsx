import { notFound } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { getExitById } from '@/app/actions/crm-exits.actions';
import { ExitForm } from '../../_components/exit-form';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function ExitEditPage({ params }: PageProps) {
    const { id } = await params;
    const exit = await getExitById(id);
    if (!exit) notFound();

    const e = exit as unknown as Record<string, unknown> & { _id?: unknown };

    return (
        <EntityDetailShell
            title="Edit exit"
            eyebrow="EXIT"
            back={{ href: '/dashboard/crm/hr/exits', label: 'Exits' }}
            rightRail={
                <EntityAuditTimeline
                    entityKind="exit"
                    entityId={String(id)}
                    title="Activity"
                    limit={25}
                />
            }
        >
            <ExitForm
                exit={{
                    ...(exit as unknown as Record<string, unknown>),
                    _id: String(e._id ?? id),
                    reportingManagerId:
                        e.reportingManagerId !== undefined &&
                        e.reportingManagerId !== null
                            ? String(e.reportingManagerId)
                            : undefined,
                    reportingManagerName:
                        e.reportingManagerName !== undefined &&
                        e.reportingManagerName !== null
                            ? String(e.reportingManagerName)
                            : undefined,
                    grossPay:
                        typeof e.grossPay === 'number'
                            ? e.grossPay
                            : e.grossPay != null
                              ? Number(e.grossPay)
                              : undefined,
                    bonuses:
                        typeof e.bonuses === 'number'
                            ? e.bonuses
                            : e.bonuses != null
                              ? Number(e.bonuses)
                              : undefined,
                    deductions:
                        typeof e.deductions === 'number'
                            ? e.deductions
                            : e.deductions != null
                              ? Number(e.deductions)
                              : undefined,
                    documents: Array.isArray(e.documents)
                        ? (e.documents as Record<string, unknown>[]).map((d) => ({
                              id: String(d.id ?? ''),
                              url: String(d.url ?? ''),
                              name: String(d.name ?? ''),
                              mime:
                                  d.mime != null ? String(d.mime) : undefined,
                              size:
                                  typeof d.size === 'number'
                                      ? d.size
                                      : d.size != null
                                        ? Number(d.size)
                                        : undefined,
                          }))
                        : undefined,
                }}
            />
        </EntityDetailShell>
    );
}
