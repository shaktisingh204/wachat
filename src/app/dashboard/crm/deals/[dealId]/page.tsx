
'use client';

import { useEffect, useState, useTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCrmDealById } from '@/app/actions/crm-deals.actions';
import { getCrmContactById } from '@/app/actions/crm.actions';
import { getCrmAccountById } from '@/app/actions/crm-accounts.actions';
import type { CrmDeal, CrmContact, CrmAccount, WithId, CrmTask } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Building, DollarSign, Users, Calendar, Handshake, Info } from 'lucide-react';
import { CrmNotes } from '@/components/wabasimplify/crm-notes';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CrmTaskList } from '@/components/wabasimplify/crm-task-list';
import { getCrmTasks } from '@/app/actions/crm-tasks.actions';
import { CreateTaskDialog } from '@/components/wabasimplify/crm-create-task-dialog';

function DealDetailPageSkeleton() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-8 w-48" />
            <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-1 space-y-4">
                    <Skeleton className="h-48 w-full" />
                </div>
                <div className="md:col-span-2 space-y-4">
                    <Skeleton className="h-96 w-full" />
                </div>
            </div>
        </div>
    );
}

export default function CrmDealDetailPage() {
    const params = useParams();
    const router = useRouter();
    const dealId = params.dealId as string;
    
    const [deal, setDeal] = useState<WithId<CrmDeal> | null>(null);
    const [account, setAccount] = useState<WithId<CrmAccount> | null>(null);
    const [contacts, setContacts] = useState<WithId<CrmContact>[]>([]);
    const [tasks, setTasks] = useState<WithId<CrmTask>[]>([]);
    const [isLoading, startTransition] = useTransition();

    const fetchData = () => {
        if (dealId) {
            startTransition(async () => {
                const fetchedDeal = await getCrmDealById(dealId);
                setDeal(fetchedDeal);

                if(fetchedDeal) {
                    const [fetchedAccount, fetchedContacts, fetchedTasks] = await Promise.all([
                        fetchedDeal.accountId ? getCrmAccountById(fetchedDeal.accountId.toString()) : Promise.resolve(null),
                        Promise.all((fetchedDeal.contactIds || []).map(id => getCrmContactById(id.toString()))),
                        getCrmTasks(fetchedDeal.projectId.toString())
                    ]);
                    setAccount(fetchedAccount);
                    setContacts(fetchedContacts.filter(Boolean) as WithId<CrmContact>[]);
                    setTasks(fetchedTasks.filter(t => t.dealId?.toString() === dealId));
                }
            });
        }
    };

    useEffect(() => {
        fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dealId]);

    if (isLoading || !deal) {
        return <DealDetailPageSkeleton />;
    }
    
    const getStageVariant = (stage: string) => {
        const s = stage.toLowerCase();
        if (s === 'won') return 'default';
        if (s === 'lost') return 'destructive';
        return 'secondary';
    }

    return (
        <div className="space-y-6">
             <div>
                <Button variant="ghost" asChild className="mb-2 -ml-4">
                    <Link href="/dashboard/crm/deals"><ArrowLeft className="mr-2 h-4 w-4" />Back to Deals Pipeline</Link>
                </Button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <div className="lg:col-span-1 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>{deal.name}</CardTitle>
                             <CardDescription>
                                <Badge variant={getStageVariant(deal.stage)} className="capitalize">{deal.stage}</Badge>
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                             <div className="flex items-center gap-3"><DollarSign className="h-4 w-4 text-muted-foreground"/><span className="font-semibold text-lg">{new Intl.NumberFormat('en-US', { style: 'currency', currency: deal.currency }).format(deal.value)}</span></div>
                             <div className="flex items-center gap-3"><Calendar className="h-4 w-4 text-muted-foreground"/><span>Close Date: {deal.closeDate ? new Date(deal.closeDate).toLocaleDateString() : 'N/A'}</span></div>
                             {account && <div className="flex items-center gap-3"><Building className="h-4 w-4 text-muted-foreground"/><Link href={`/dashboard/crm/accounts/${account._id.toString()}`} className="text-primary hover:underline">{account.name}</Link></div>}
                             {contacts.length > 0 && <div className="flex items-start gap-3"><Users className="h-4 w-4 text-muted-foreground mt-1"/><div className="flex flex-col">{contacts.map(c => <Link key={c._id.toString()} href={`/dashboard/crm/contacts/${c._id.toString()}`} className="text-primary hover:underline">{c.name}</Link>)}</div></div>}
                        </CardContent>
                    </Card>
                    <CrmNotes recordId={deal._id.toString()} recordType="deal" notes={deal.notes || []} />
                </div>
                 <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="flex items-center gap-2"><Handshake className="h-5 w-5"/>Related Tasks</CardTitle>
                            <CreateTaskDialog projectId={deal.projectId.toString()} onTaskCreated={fetchData} dealId={deal._id.toString()} />
                        </CardHeader>
                        <CardContent>
                            <CrmTaskList tasks={tasks} onTaskUpdated={fetchData} />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
