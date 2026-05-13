import { notFound } from 'next/navigation';
import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { ZoruButton, ZoruCard, ZoruCardContent } from '@/components/zoruui';
import { getCrmExitById } from '@/app/actions/crm-exits.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function ExitDetailPage({ params }: PageProps) {
    const { id } = await params;
    const exit = await getCrmExitById(id);
    if (!exit) notFound();

    const e = exit as any;

    return (
        <EntityDetailShell
            title={e.employeeName || `Exit: ${e.employeeId}`}
            eyebrow="EXIT"
            back={{ href: '/dashboard/hrm/hr/exits', label: 'All exits' }}
            actions={
                <Link href={`/dashboard/hrm/hr/exits/${id}/edit`}>
                    <ZoruButton size="sm">Edit</ZoruButton>
                </Link>
            }
            audit={{ entityKind: 'exit', entityId: id }}
        >
            <ZoruCard>
                <ZoruCardContent className="space-y-3 p-6 text-sm">
                    <Row label="Type" value={e.type} />
                    <Row label="Notice start" value={e.noticeStartDate} />
                    <Row label="Last working day" value={e.lastWorkingDay} />
                    <Row label="F&F status" value={e.fnfStatus} />
                    <Row label="NOC status" value={e.nocStatus} />
                    <Row label="Asset return" value={e.assetReturnStatus} />
                    <Row label="Exit interview notes" value={e.exitInterviewNotes} />
                    <Row label="Knowledge transfer" value={e.knowledgeTransfer} />
                </ZoruCardContent>
            </ZoruCard>
        </EntityDetailShell>
    );
}

function Row({ label, value }: { label: string; value?: string | null }) {
    return (
        <div className="flex items-baseline gap-3">
            <span className="w-44 shrink-0 text-zoru-ink-muted">{label}</span>
            <span className="text-zoru-ink whitespace-pre-wrap">{value || '—'}</span>
        </div>
    );
}
