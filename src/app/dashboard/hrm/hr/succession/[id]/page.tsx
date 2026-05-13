import { notFound } from 'next/navigation';
import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { ZoruButton, ZoruCard, ZoruCardContent } from '@/components/zoruui';
import { getCrmSuccessionPlanById } from '@/app/actions/crm-succession.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function SuccessionDetailPage({ params }: PageProps) {
    const { id } = await params;
    const plan = await getCrmSuccessionPlanById(id);
    if (!plan) notFound();

    const p = plan as any;

    return (
        <EntityDetailShell
            title={p.role || 'Succession plan'}
            eyebrow="SUCCESSION"
            back={{ href: '/dashboard/hrm/hr/succession', label: 'All plans' }}
            actions={
                <Link href={`/dashboard/hrm/hr/succession/${id}/edit`}>
                    <ZoruButton size="sm">Edit</ZoruButton>
                </Link>
            }
            audit={{ entityKind: 'succession', entityId: id }}
        >
            <ZoruCard>
                <ZoruCardContent className="space-y-4 p-6 text-sm">
                    <Row label="Role" value={p.role} />
                    <Row label="Incumbent" value={p.incumbentEmployeeId} />
                    <Row label="Department" value={p.department} />
                    <Row label="Review date" value={p.reviewDate} />
                    <Row label="Notes" value={p.notes} />
                    {Array.isArray(p.candidates) && p.candidates.length > 0 ? (
                        <div>
                            <div className="mb-1 text-zoru-ink-muted">Candidates</div>
                            <ul className="list-disc space-y-1 pl-5">
                                {p.candidates.map((c: any, i: number) => (
                                    <li key={i}>
                                        {typeof c === 'string'
                                            ? c
                                            : `${c.employeeId ?? '—'} · ${c.readiness ?? '—'}${c.notes ? ' · ' + c.notes : ''}`}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : null}
                </ZoruCardContent>
            </ZoruCard>
        </EntityDetailShell>
    );
}

function Row({ label, value }: { label: string; value?: string | null }) {
    return (
        <div className="flex items-baseline gap-3">
            <span className="w-40 shrink-0 text-zoru-ink-muted">{label}</span>
            <span className="text-zoru-ink whitespace-pre-wrap">{value || '—'}</span>
        </div>
    );
}
