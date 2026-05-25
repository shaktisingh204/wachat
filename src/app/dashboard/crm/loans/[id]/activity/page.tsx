import { notFound } from 'next/navigation';
import { ObjectId } from 'mongodb';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getLoanById } from '@/app/actions/crm-loans.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { LoanActivityClient } from './_components/loan-activity-client';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function LoanActivityPage({ params }: PageProps) {
    const { id } = await params;
    const loan = await getLoanById(id);
    if (!loan) notFound();

    const session = await getSession();
    if (!session?.user?._id) {
        return (
            <EntityDetailShell
                title="Activity"
                eyebrow="LOAN ACTIVITY"
                back={{
                    href: `/dashboard/crm/loans/${id}`,
                    label: 'Back to loan',
                }}
            >
                <div className="p-4 text-sm text-zinc-500">Login required to view activity.</div>
            </EntityDetailShell>
        );
    }

    const userId = String(session.user._id);
    let entries: any[] = [];

    if (ObjectId.isValid(userId)) {
        try {
            const { db } = await connectToDatabase();
            const docs = await db
                .collection('crm_audit_log')
                .find({
                    userId: new ObjectId(userId),
                    entityKind: 'loan',
                    entityId: id,
                } as any)
                .sort({ createdAt: -1 })
                .limit(200)
                .toArray();
            entries = JSON.parse(JSON.stringify(docs));
        } catch (e) {
            console.error('[LoanActivityPage] read failed:', e);
        }
    }

    const title = (loan.borrowerName as string) || 'Loan';

    return (
        <EntityDetailShell
            title={`${title} — Activity`}
            eyebrow="LOAN ACTIVITY"
            back={{
                href: `/dashboard/crm/loans/${id}`,
                label: 'Back to loan',
            }}
        >
            <LoanActivityClient 
                entries={entries} 
                loanId={id} 
                currentUserId={userId} 
            />
        </EntityDetailShell>
    );
}
