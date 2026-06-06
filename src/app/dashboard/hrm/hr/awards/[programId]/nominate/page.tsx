import { Button, Card, Input, Label, Textarea, useToast } from '@/components/sabcrm/20ui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getAwardProgramById } from '@/app/actions/crm-awards.actions';
import { getSession } from '@/app/actions/user.actions';
import { redirect } from 'next/navigation';
import { ObjectId } from 'mongodb';
import { NominateForm } from './nominate-form';

export const dynamic = 'force-dynamic';

export default async function NominatePage({
    params,
}: {
    params: Promise<{ programId: string }>;
}) {
    const { programId } = await params;
    const session = await getSession();
    if (!session?.user) redirect('/dashboard/hrm/hr/awards');
    if (!ObjectId.isValid(programId)) redirect('/dashboard/hrm/hr/awards');

    const program = await getAwardProgramById(programId);
    if (!program) redirect('/dashboard/hrm/hr/awards');

    const p = program as Record<string, unknown>;
    const name = (p.name as string) || 'Untitled Program';

    return (
        <EntityListShell
            title={`Nominate for ${name}`}
            subtitle="Submit a peer-to-peer nomination."
        >
            <Card className="p-6 max-w-2xl">
                <NominateForm programId={programId} programName={name} />
            </Card>
        </EntityListShell>
    );
}
