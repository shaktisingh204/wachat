'use client';

import { Skeleton, Button, Alert, ScrollArea, ScrollBar, Field, Input } from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useTransition } from 'react';
import { getFacebookKanbanData,
  handleUpdateFacebookSubscriberStatus,
  saveFacebookKanbanStatuses } from '@/app/actions/facebook.actions';
import type { WithId,
  FacebookSubscriber,
  Project } from '@/lib/definitions';
import { FacebookKanbanColumn } from '@/components/zoruui-domain/facebook-kanban-column';
import { Plus } from 'lucide-react';

import { useToast } from '@/hooks/use-toast';
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, closestCorners } from '@dnd-kit/core';

type FacebookKanbanColumnData = {
    name: string;
    conversations: WithId<FacebookSubscriber>[];
};

function KanbanPageSkeleton() {
    return (
        <div className="flex-1 flex h-full overflow-x-auto p-4 gap-4">
            <div className="w-80 flex-shrink-0"><Skeleton className="h-full w-full" /></div>
            <div className="w-80 flex-shrink-0"><Skeleton className="h-full w-full" /></div>
            <div className="w-80 flex-shrink-0"><Skeleton className="h-full w-full" /></div>
        </div>
    );
}

function AddList({ onAddList }: { onAddList: (name: string) => void }) {
    const [isAdding, setIsAdding] = useState(false);
    const [listName, setListName] = useState('');

    const handleAdd = () => {
        if (listName.trim()) {
            onAddList(listName.trim());
            setListName('');
            setIsAdding(false);
        }
    };

    if (!isAdding) {
        return (
            <Button
                variant="outline"
                className="w-72 flex-shrink-0 h-12"
                iconLeft={Plus}
                onClick={() => setIsAdding(true)}
            >
                Add another list
            </Button>
        );
    }

    return (
        <div className="w-72 flex-shrink-0 p-2 bg-[var(--st-bg-muted)] rounded-[var(--st-radius)] h-fit">
            <Field label="List title">
                <Input
                    placeholder="Enter list title..."
                    value={listName}
                    onChange={(e) => setListName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    autoFocus
                />
            </Field>
            <div className="mt-2 flex items-center gap-2">
                <Button variant="primary" onClick={handleAdd}>Add list</Button>
                <Button variant="ghost" onClick={() => setIsAdding(false)}>Cancel</Button>
            </div>
        </div>
    );
}

export function FacebookKanbanBoard() {
    const [project, setProject] = useState<WithId<Project> | null>(null);
    const [boardData, setBoardData] = useState<FacebookKanbanColumnData[]>([]);
    const [isLoading, startLoadingTransition] = useTransition();
    const [isClient, setIsClient] = useState(false);
    const { toast } = useToast();

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    );

    const fetchData = () => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        if (storedProjectId) {
            startLoadingTransition(async () => {
                const data = await getFacebookKanbanData(storedProjectId);
                if (data.project) setProject(data.project);
                if (data.columns) setBoardData(data.columns);
            });
        }
    }

    useEffect(() => {
        setIsClient(true);
        fetchData();
    }, []);

    const handleAddList = (name: string) => {
        if (!project) return;
        const newBoardData = [...boardData, { name, conversations: [] }];
        setBoardData(newBoardData);

        const allStatusNames = newBoardData.map(col => col.name);
        startLoadingTransition(async () => {
            const result = await saveFacebookKanbanStatuses(project._id.toString(), allStatusNames);
            if (!result.success) {
                toast({ title: "Error", description: "Could not save new list.", tone: "danger" });
                fetchData(); // Revert on failure
            } else {
                 toast({ title: "Success", description: `List "${name}" added.`, tone: "success" });
            }
        });
    };

    const handleOnDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) return;

        const draggableId = active.id as string;
        const destinationColumnName = over.id as string;

        const sourceColumn = boardData.find(col => col.conversations.some(c => c._id.toString() === draggableId));
        if (!sourceColumn) return;

        if (sourceColumn.name === destinationColumnName) return;

        const sourceColumnIndex = boardData.findIndex(col => col.name === sourceColumn.name);
        const destColumnIndex = boardData.findIndex(col => col.name === destinationColumnName);
        if (sourceColumnIndex === -1 || destColumnIndex === -1) return;

        const destColumn = boardData[destColumnIndex];

        const sourceConversations = Array.from(sourceColumn.conversations);
        const movedIndex = sourceConversations.findIndex(c => c._id.toString() === draggableId);
        const [movedSubscriber] = sourceConversations.splice(movedIndex, 1);

        const destConversations = Array.from(destColumn.conversations);
        destConversations.push(movedSubscriber);

        const newBoardData = [...boardData];
        newBoardData[sourceColumnIndex] = { ...sourceColumn, conversations: sourceConversations };
        newBoardData[destColumnIndex] = { ...destColumn, conversations: destConversations };
        setBoardData(newBoardData);

        handleUpdateFacebookSubscriberStatus(draggableId, destinationColumnName);
    };

    if (!isClient || isLoading) {
        return <KanbanPageSkeleton />;
    }

    if (!project) {
        return (
             <div className="p-4">
                <Alert tone="danger" title="No Project Selected">
                    Please select a project from the main dashboard page to view the chat kanban board.
                </Alert>
             </div>
        );
    }

    return (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleOnDragEnd}>
            <div className="h-full w-full">
                <ScrollArea className="h-full w-full">
                    <div className="table min-w-full h-full">
                        <div className="flex h-full w-max p-4 gap-4">
                            {boardData.map(column => (
                                <FacebookKanbanColumn key={column.name} title={column.name} conversations={column.conversations} />
                            ))}
                            <AddList onAddList={handleAddList} />
                        </div>
                    </div>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </div>
        </DndContext>
    );
}
