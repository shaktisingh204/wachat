
'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getCrmDeals, updateCrmDealStage } from '@/app/actions/crm-deals.actions';
import { getCrmContacts } from '@/app/actions/crm.actions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import type { WithId, CrmDeal, CrmContact, CrmAccount } from '@/lib/definitions';
import { Handshake, Plus, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { CreateDealDialog } from '@/components/wabasimplify/crm-create-deal-dialog';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { CrmDealCard } from '@/components/wabasimplify/crm-deal-card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { getCrmTasks } from '@/app/actions/crm-tasks.actions';

const defaultStages = ['New', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won', 'Lost'];

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
    const [isLoading, startLoading] = useTransition();
    const [projectId, setProjectId] = useState<string | null>(null);
    const { toast } = useToast();
    const router = useRouter();

    const fetchData = () => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        if (storedProjectId) {
            setProjectId(storedProjectId);
            startLoading(async () => {
                const [dealsData, contactsData, accountsData, tasksData] = await Promise.all([
                    getCrmDeals(storedProjectId),
                    getCrmContacts(storedProjectId, 1, 1000), // Fetch all for dialog
                    getCrmAccounts(storedProjectId, 1, 1000),
                    getCrmTasks(storedProjectId)
                ]);
                setDeals(dealsData);
                setContacts(contactsData.contacts);
                setAccounts(accountsData.accounts);
                setTasks(tasksData);
            });
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

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
                toast({ title: "Success", description: "Deal stage updated."});
            }
        });
    };

    if (isLoading && deals.length === 0) {
        return <DealsPageSkeleton />;
    }
    
    if (!projectId) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>Please select a project to manage its deals.</AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="flex flex-col gap-8 h-full">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Handshake /> Deals</h1>
                    <p className="text-muted-foreground">Manage your sales pipeline and track deals.</p>
                </div>
                <CreateDealDialog projectId={projectId} contacts={contacts} accounts={accounts} onDealCreated={fetchData} />
            </div>
            
            <DragDropContext onDragEnd={onDragEnd}>
                <ScrollArea className="flex-1 w-full">
                    <div className="flex h-full w-max p-1 gap-4">
                        {defaultStages.map(stage => (
                            <Droppable key={stage} droppableId={stage}>
                                {(provided, snapshot) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className={`w-80 flex-shrink-0 flex flex-col rounded-lg p-2 ${snapshot.isDraggingOver ? 'bg-primary/10' : 'bg-muted/50'}`}
                                    >
                                        <h3 className="font-semibold px-2 py-1">{stage}</h3>
                                        <ScrollArea className="flex-1">
                                            <div className="space-y-3 p-1">
                                                {deals.filter(d => d.stage === stage).map((deal, index) => (
                                                     <Draggable key={deal._id.toString()} draggableId={deal._id.toString()} index={index}>
                                                        {(provided) => (
                                                            <div
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                {...provided.dragHandleProps}
                                                                onClick={() => router.push(`/dashboard/crm/deals/${deal._id.toString()}`)}
                                                            >
                                                                <CrmDealCard 
                                                                    deal={deal} 
                                                                    contact={contacts.find(c => deal.contactIds?.map(id => id.toString()).includes(c._id.toString()))} 
                                                                    account={accounts.find(a => a._id.toString() === deal.accountId?.toString())} 
                                                                    taskCount={tasks.filter(t => t.dealId?.toString() === deal._id.toString()).length}
                                                                />
                                                            </div>
                                                        )}
                                                     </Draggable>
                                                ))}
                                                {provided.placeholder}
                                            </div>
                                        </ScrollArea>
                                    </div>
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
