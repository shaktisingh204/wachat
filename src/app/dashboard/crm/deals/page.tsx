'use client';

import { useEffect, useState, useTransition } from 'react';
import { Handshake, AlertCircle } from 'lucide-react';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';

import { getCrmDeals, updateCrmDealStage } from '@/app/actions/crm-deals.actions';
import { getCrmContacts } from '@/app/actions/crm.actions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import { getSession } from '@/app/actions/user.actions';
import { getCrmTasks } from '@/app/actions/crm-tasks.actions';
import { getCrmPipelines } from '@/app/actions/crm-pipelines.actions';
import type {
  WithId,
  CrmDeal,
  CrmContact,
  CrmAccount,
  User,
  Plan,
  CrmPipeline,
} from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { getDealStagesForIndustry } from '@/lib/crm-industry-stages';
import { KanbanColumn } from '@/components/wabasimplify/kanban-column';
import { CrmDealCard } from '@/components/wabasimplify/crm-deal-card';
import { CreateDealDialog } from '@/components/wabasimplify/crm-create-deal-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

import { CrmPageHeader } from '../_components/crm-page-header';

function DealsPageSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-2 h-4 w-96" />
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-[60vh] w-80 rounded-xl" />
        <Skeleton className="h-[60vh] w-80 rounded-xl" />
        <Skeleton className="h-[60vh] w-80 rounded-xl" />
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
  const [user, setUser] = useState<
    (Omit<User, 'password'> & { plan?: WithId<Plan> | null }) | null
  >(null);
  const [isLoading, startLoading] = useTransition();
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const fetchData = () => {
    startLoading(async () => {
      const [sessionData, dealsData, contactsData, accountsData, tasksData, pipelinesData] =
        await Promise.all([
          getSession(),
          getCrmDeals(),
          getCrmContacts(1, 1000),
          getCrmAccounts(1, 1000),
          getCrmTasks(),
          getCrmPipelines(),
        ]);
      setUser((sessionData?.user as any) || null);
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
  const currentStages =
    pipelines.find((p) => p.id === selectedPipelineId)?.stages.map((s) => s.name) ||
    defaultStages ||
    [];

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const draggableId = active.id as string;
    const destinationStage = over.id as string;

    const dealToMove = deals.find((d) => d._id.toString() === draggableId);
    if (!dealToMove) return;
    if (dealToMove.stage === destinationStage) return;

    const newDeals = deals.map((d) =>
      d._id.toString() === draggableId ? { ...d, stage: destinationStage as any } : d,
    );
    setDeals(newDeals);

    startLoading(async () => {
      const updateResult = await updateCrmDealStage(draggableId, destinationStage);
      if (!updateResult.success) {
        toast({
          title: 'Error',
          description: 'Failed to update deal stage.',
          variant: 'destructive',
        });
        setDeals(deals);
      } else {
        toast({ title: 'Success', description: 'Deal stage updated.' });
      }
    });
  };

  if (isLoading && deals.length === 0) return <DealsPageSkeleton />;

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
    <div className="flex h-full w-full flex-col gap-6">
      <CrmPageHeader
        title="Deals"
        subtitle="Manage your sales pipeline and track deals."
        icon={Handshake}
        actions={
          <>
            {pipelines.length > 0 && (
              <div className="w-[200px]">
                <Select value={selectedPipelineId} onValueChange={setSelectedPipelineId}>
                  <SelectTrigger className="h-9 rounded-full border-border bg-card text-[13px]">
                    <SelectValue placeholder="Select Pipeline" />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelines.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
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
          </>
        }
      />

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
        <ScrollArea className="w-full flex-1">
          <div className="flex h-full w-max gap-4 p-1">
            {currentStages.map((stage) => (
              <KanbanColumn
                key={stage}
                columnId={stage}
                title={stage}
                count={deals.filter((d) => d.stage === stage).length}
              >
                {deals
                  .filter((d) => d.stage === stage)
                  .map((deal, index) => (
                    <CrmDealCard
                      key={deal._id.toString()}
                      deal={deal}
                      index={index}
                      contact={contacts.find((c) =>
                        deal.contactIds?.map((id) => id.toString()).includes(c._id.toString()),
                      )}
                      account={accounts.find(
                        (a) => a._id.toString() === deal.accountId?.toString(),
                      )}
                      taskCount={
                        tasks.filter((t) => t.dealId?.toString() === deal._id.toString()).length
                      }
                    />
                  ))}
              </KanbanColumn>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </DndContext>
    </div>
  );
}
