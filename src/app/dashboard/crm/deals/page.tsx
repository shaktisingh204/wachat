'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getCrmDeals, updateCrmDealStage } from '@/app/actions/crm-deals.actions';
import { getCrmContacts } from '@/app/actions/crm.actions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import { getSession } from '@/app/actions/user.actions';
import type { WithId, CrmDeal, CrmContact, CrmAccount, User, Plan, CrmPipeline } from '@/lib/definitions';
import { Handshake, Plus, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { CreateDealDialog } from '@/components/wabasimplify/crm-create-deal-dialog';
import { DragDropContext, Droppable } from 'react-beautiful-dnd';
import { CrmDealCard } from '@/components/wabasimplify/crm-deal-card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { getCrmTasks } from '@/app/actions/crm-tasks.actions';
import { getDealStagesForIndustry } from '@/lib/crm-industry-stages';
import { KanbanColumn } from '@/components/wabasimplify/kanban-column';
import { getCrmPipelines } from '@/app/actions/crm-pipelines.actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function DealsPageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <div><Skeleton className="h-8 w-64" /><Skeleton className="h-4 w-96 mt-2" /></div>
            <div className="flex gap-4">
                <Skeleton className="h-[60vh] w-80" />
                <Skeleton className="h-[60vh] w-80" />
                <Skeleton className="h-[60vh] w-80" />
            </div>
        </div>
    );
}

export default function DealsPage() {
    const [deals, setDeals] = useState<WithId<CrmDeal>[]>([]);
    const [contacts, setContacts] = useState<WithId<CrmContact>[]>([]);
    const [accounts, setAccounts] = useState<WithId<CrmAccount>[]>([]);
    const [tasks, setTasks] = useState<WithId<any>[]>([]);
    const [pipelines, setPipelines] = useState<CrmPipeline[]>([]);
    const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
    const [user, setUser] = useState<(Omit<User, 'password'> & { plan?: WithId<Plan> | null }) | null>(null);
    const [isLoading, startLoading] = useTransition();
    const { toast } = useToast();
    const router = useRouter();

    const fetchData = () => {
        startLoading(async () => {
            const [sessionData, dealsData, contactsData, accountsData, tasksData, pipelinesData] = await Promise.all([
                getSession(),
                getCrmDeals(),
                getCrmContacts(1, 1000),
                getCrmAccounts(1, 1000),
                getCrmTasks(),
                getCrmPipelines()
            ]);
            setUser(sessionData?.user as any || null);
            setDeals(dealsData.deals || []);
            setContacts(contactsData.contacts);
            setAccounts(accountsData.accounts);
            setTasks(tasksData);
            setPipelines(pipelinesData);
            if (pipelinesData.length > 0 && !selectedPipelineId) {
                setSelectedPipelineId(pipelinesData[0].id);
            }
        });
    };

    useEffect(() => {
        fetchData();
    }, []);

    const defaultStages = getDealStagesForIndustry(user?.crmIndustry);

    // Determine current stages based on selected pipeline or fallback to industry defaults
    const currentStages = pipelines.find(p => p.id === selectedPipelineId)?.stages.map(s => s.name) || defaultStages || [];

    const onDragEnd = (result: any) => {
        const { destination, source, draggableId } = result;
        if (!destination || (destination.droppableId === source.droppableId)) return;

        const dealToMove = deals.find(d => d._id.toString() === draggableId);
        if (!dealToMove) return;

        const newDeals = deals.map(d => d._id.toString() === draggableId ? { ...d, stage: destination.droppableId as any } : d);
        setDeals(newDeals);

        startLoading(async () => {
            const updateResult = await updateCrmDealStage(draggableId, destination.droppableId);
            if (!updateResult.success) {
                toast({ title: "Error", description: "Failed to update deal stage.", variant: "destructive" });
                setDeals(deals);
            } else {
                toast({ title: "Success", description: "Deal stage updated." });
            }
        });
    };

    if (isLoading && deals.length === 0) {
        return <DealsPageSkeleton />;
    }

    if (!user) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Not Logged In</AlertTitle>
                <AlertDescription>Please log in to manage your deals.</AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="flex flex-col gap-8 h-full">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Handshake /> Deals</h1>
                        <p className="text-muted-foreground">Manage your sales pipeline and track deals.</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {pipelines.length > 0 && (
                        <div className="w-[200px]">
                            <Select value={selectedPipelineId} onValueChange={setSelectedPipelineId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Pipeline" />
                                </SelectTrigger>
                                <SelectContent>
                                    {pipelines.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    <CreateDealDialog
                        contacts={contacts}
                        accounts={accounts}
                        onDealCreated={fetchData}
                        dealStages={currentStages}
                    />
                </div>
            </div>

            <DragDropContext onDragEnd={onDragEnd}>
                <ScrollArea className="flex-1 w-full">
                    <div className="flex h-full w-max p-1 gap-4">
                        {currentStages.map(stage => (
                            <Droppable key={stage} droppableId={stage}>
                                {(provided, snapshot) => (
                                    <KanbanColumn
                                        title={stage}
                                        innerRef={provided.innerRef}
                                        droppableProps={provided.droppableProps}
                                        isDraggingOver={snapshot.isDraggingOver}
                                        count={deals.filter(d => d.stage === stage).length}
                                    >
                                        {deals.filter(d => d.stage === stage).map((deal, index) => (
                                            <CrmDealCard
                                                key={deal._id.toString()}
                                                deal={deal}
                                                index={index}
                                                contact={contacts.find(c => deal.contactIds?.map(id => id.toString()).includes(c._id.toString()))}
                                                account={accounts.find(a => a._id.toString() === deal.accountId?.toString())}
                                                taskCount={tasks.filter(t => t.dealId?.toString() === deal._id.toString()).length}
                                            />
                                        ))}
                                        {provided.placeholder}
                                    </KanbanColumn>
                                )}
                            </Droppable>
                        ))}
                    </div>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </DragDropContext>
        </div>
    );
}
