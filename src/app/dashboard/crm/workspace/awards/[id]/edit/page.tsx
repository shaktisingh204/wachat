import { notFound } from 'next/navigation';

import { getAwardById, getAppreciationsByAward } from '@/app/actions/worksuite/knowledge.actions';
import { AwardsForm } from '../../_components/awards-form';
import type { WsAward, WsAppreciation } from '@/lib/worksuite/knowledge-types';
import {
    Card,
    ZoruCardContent,
    ZoruCardHeader,
    ZoruCardTitle,
    ZoruCardDescription,
    StatCard,
} from '@/components/zoruui';
import { Users, Award } from 'lucide-react';

export const dynamic = 'force-dynamic';

type ExtendedAward = WsAward & { _id: string; criteria?: string; prize?: string };

function mapAwardForForm(award: WsAward | null | undefined): ExtendedAward | null {
    if (!award) return null;
    const typedAward = award as ExtendedAward;
    return {
        ...typedAward,
        _id: typedAward._id?.toString() || '',
        criteria: typedAward.criteria || '',
        prize: typedAward.prize || '',
    };
}

export default async function EditAwardPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const [awardRaw, appreciations] = await Promise.all([
        getAwardById(id),
        getAppreciationsByAward(id),
    ]);

    if (!awardRaw) notFound();

    const award = mapAwardForForm(awardRaw);

    const totalGiven = appreciations.length;
    const uniqueRecipients = new Set(appreciations.map((a) => a.given_to_user_id)).size;
    const recentAppreciations = appreciations.slice(0, 5);

    return (
        <div className="flex w-full flex-col gap-6 p-4 md:p-6">
             <div className="grid gap-4 grid-cols-1 lg:grid-cols-3 items-start">
                 <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:col-span-2">
                     <StatCard
                        label="Total Awarded"
                        value={totalGiven}
                        icon={<Award />}
                     />
                     <StatCard
                        label="Unique Recipients"
                        value={uniqueRecipients}
                        icon={<Users />}
                     />
                 </div>
                 
                 <Card className="lg:col-span-1">
                    <ZoruCardHeader>
                        <ZoruCardTitle>Recent Recipients</ZoruCardTitle>
                        <ZoruCardDescription>Latest users to receive this award</ZoruCardDescription>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        {recentAppreciations.length > 0 ? (
                            <ul className="space-y-4 text-sm">
                                {recentAppreciations.map((appreciation) => (
                                    <li key={appreciation._id?.toString() || Math.random().toString()} className="flex justify-between items-start gap-2">
                                        <div className="flex flex-col overflow-hidden">
                                            <span className="font-medium text-zoru-ink truncate">{appreciation.given_to_user_name || 'Unknown User'}</span>
                                            {appreciation.summary ? <span className="text-xs text-zoru-ink-muted line-clamp-2">{appreciation.summary}</span> : null}
                                        </div>
                                        <span className="text-xs text-zoru-ink-subtle whitespace-nowrap pt-1">
                                            {new Date(appreciation.given_on as string).toISOString().slice(0, 10)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-6 text-center">
                                <span className="text-zoru-ink-muted text-sm">No one has received this award yet.</span>
                            </div>
                        )}
                    </ZoruCardContent>
                </Card>
             </div>

            <AwardsForm mode="edit" award={award} />
        </div>
    );
}
