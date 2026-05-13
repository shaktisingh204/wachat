import { notFound } from 'next/navigation';
import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { ZoruButton, ZoruCard, ZoruCardContent } from '@/components/zoruui';
import { getCandidateById } from '@/app/actions/hr.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function CandidateDetailPage({ params }: PageProps) {
    const { id } = await params;
    const candidate = await getCandidateById(id);
    if (!candidate) notFound();

    const c = candidate as any;

    return (
        <EntityDetailShell
            title={c.name || c.firstName || 'Candidate'}
            eyebrow="CANDIDATE"
            back={{ href: '/dashboard/hrm/hr/candidates', label: 'All candidates' }}
            actions={
                <Link href={`/dashboard/hrm/hr/candidates/${id}/edit`}>
                    <ZoruButton size="sm">Edit</ZoruButton>
                </Link>
            }
            audit={{ entityKind: 'candidate', entityId: id }}
        >
            <ZoruCard>
                <ZoruCardContent className="space-y-3 p-6 text-sm">
                    <Row label="Email" value={c.email} />
                    <Row label="Phone" value={c.phone} />
                    <Row label="Position" value={c.position ?? c.jobTitle} />
                    <Row label="Source" value={c.source} />
                    <Row label="Stage" value={c.stage} />
                    <Row label="Skills" value={Array.isArray(c.skills) ? c.skills.join(', ') : c.skills} />
                    <Row label="Resume" value={c.resumeUrl} />
                    <Row label="Rating" value={String(c.rating ?? '—')} />
                    <Row label="Notes" value={c.notes} />
                </ZoruCardContent>
            </ZoruCard>
        </EntityDetailShell>
    );
}

function Row({ label, value }: { label: string; value?: string | null }) {
    return (
        <div className="flex items-baseline gap-3">
            <span className="w-32 shrink-0 text-zoru-ink-muted">{label}</span>
            <span className="text-zoru-ink">{value || '—'}</span>
        </div>
    );
}
