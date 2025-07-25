
'use client';

import { useEffect, useState, useTransition } from 'react';
import { getFacebookKanbanData, handleUpdateFacebookSubscriberStatus, saveFacebookKanbanStatuses } from '@/app/actions/facebook.actions';
import type { WithId, FacebookSubscriber, Project } from '@/lib/definitions';
import { FacebookKanbanColumn } from '@/components/wabasimplify/facebook-kanban-column';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Plus } from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { DragDropContext, Droppable } from 'react-beautiful-dnd';

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
                onClick={() => setIsAdding(true)}
            >
                <Plus className="mr-2 h-4 w-4" /> Add another list
            </Button>
        );
    }

    return (
        <div className="w-72 flex-shrink-0 p-2 bg-muted rounded-lg h-fit">
            <Input
                placeholder="Enter list title..."
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                autoFocus
            />
            <div className="mt-2 flex items-center gap-2">
                <Button onClick={handleAdd}>Add list</Button>
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
                toast({ title: "Error", description: "Could not save new list.", variant: "destructive" });
                fetchData(); // Revert on failure
            } else {
                 toast({ title: "Success", description: `List "${name}" added.`});
            }
        });
    };

    const handleOnDragEnd = (result: any) => {
        if (!result.destination) return;
        
        const { source, destination, draggableId } = result;

        if (source.droppableId === destination.droppableId) return;

        let movedSubscriber: WithId<FacebookSubscriber> | undefined;
        let sourceColumnIndex = boardData.findIndex(col => col.name === source.droppableId);
        let destColumnIndex = boardData.findIndex(col => col.name === destination.droppableId);

        if (sourceColumnIndex === -1 || destColumnIndex === -1) return;

        const sourceColumn = boardData[sourceColumnIndex];
        const destColumn = boardData[destColumnIndex];
        
        const sourceConversations = Array.from(sourceColumn.conversations);
        [movedSubscriber] = sourceConversations.splice(source.index, 1);
        
        const destConversations = Array.from(destColumn.conversations);
        destConversations.splice(destination.index, 0, movedSubscriber);
        
        const newBoardData = [...boardData];
        newBoardData[sourceColumnIndex] = { ...sourceColumn, conversations: sourceConversations };
        newBoardData[destColumnIndex] = { ...destColumn, conversations: destConversations };
        setBoardData(newBoardData);
        
        handleUpdateFacebookSubscriberStatus(draggableId, destination.droppableId);
    };

    if (!isClient || isLoading) {
        return <KanbanPageSkeleton />;
    }

    if (!project) {
        return (
             <div className="p-4">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Project Selected</AlertTitle>
                    <AlertDescription>
                        Please select a project from the main dashboard page to view the Kanban board.
                    </AlertDescription>
                </Alert>
             </div>
        );
    }
    
    return (
        <DragDropContext onDragEnd={handleOnDragEnd}>
            <div className="h-full w-full">
                <ScrollArea className="h-full w-full">
                    <div style={{minWidth: "100%", display: "table", height: '100%'}}>
                        <div className="flex h-full w-max p-4 gap-4">
                            {boardData.map(column => (
                                <Droppable key={column.name} droppableId={column.name}>
                                    {(provided) => (
                                        <div ref={provided.innerRef} {...provided.droppableProps}>
                                            <FacebookKanbanColumn title={column.name} conversations={column.conversations} />
                                            {provided.placeholder}
                                        </div>
                                    )}
                                </Droppable>
                            ))}
                            <AddList onAddList={handleAddList} />
                        </div>
                    </div>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </div>
        </DragDropContext>
    );
}
