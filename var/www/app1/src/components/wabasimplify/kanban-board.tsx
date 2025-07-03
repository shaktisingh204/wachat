
'use client';

import { useEffect, useState, useTransition } from 'react';
import { getKanbanData, handleUpdateContactStatus, saveKanbanStatuses } from '@/app/actions';
import type { WithId, Contact, Project, KanbanColumnData } from '@/lib/definitions';
import { KanbanColumn } from './kanban-column';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Plus } from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useToast } from '@/hooks/use-toast';

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

export function KanbanBoard() {
    const [project, setProject] = useState<WithId<Project> | null>(null);
    const [boardData, setBoardData] = useState<KanbanColumnData[]>([]);
    const [isLoading, startLoadingTransition] = useTransition();
    const [isClient, setIsClient] = useState(false);
    const { toast } = useToast();

    const fetchData = () => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        if (storedProjectId) {
            startLoadingTransition(async () => {
                const data = await getKanbanData(storedProjectId);
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
        const newBoardData = [...boardData, { name, contacts: [] }];
        setBoardData(newBoardData);

        const allStatusNames = newBoardData.map(col => col.name);
        startLoadingTransition(async () => {
            const result = await saveKanbanStatuses(project._id.toString(), allStatusNames);
            if (!result.success) {
                toast({ title: "Error", description: "Could not save new list.", variant: "destructive" });
                fetchData(); // Revert on failure
            } else {
                 toast({ title: "Success", description: `List "${name}" added.`});
            }
        });
    };

    const handleDrop = async (contactId: string, newStatus: string) => {
        if (!project) return;
        let movedContact: WithId<Contact> | undefined;
        let originalStatus: string | undefined;

        for (const col of boardData) {
            const contact = col.contacts.find(c => c._id.toString() === contactId);
            if (contact) {
                movedContact = { ...contact };
                originalStatus = col.name;
                break;
            }
        }
        
        if (!movedContact || !originalStatus || originalStatus === newStatus) {
            return;
        }

        const newBoardData = boardData.map(col => {
            if (col.name === originalStatus) {
                return { ...col, contacts: col.contacts.filter(c => c._id.toString() !== contactId) };
            }
            if (col.name === newStatus) {
                movedContact!.status = newStatus;
                return { ...col, contacts: [movedContact!, ...col.contacts] };
            }
            return col;
        });
        
        setBoardData(newBoardData);
        
        const result = await handleUpdateContactStatus(contactId, newStatus, movedContact.assignedAgentId || '');
        if (!result.success) {
            toast({ title: "Error", description: "Could not update contact status.", variant: "destructive" });
            fetchData(); // Revert on failure
        }
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
                        Please select a project from the main dashboard page to view the chat kanban board.
                    </AlertDescription>
                </Alert>
             </div>
        );
    }
    
    return (
        <div className="h-full w-full">
            <ScrollArea className="h-full w-full">
                <div className="flex h-full p-4 gap-4">
                    {boardData.map(column => (
                        <KanbanColumn key={column.name} title={column.name} contacts={column.contacts} onDrop={handleDrop} />
                    ))}
                    <AddList onAddList={handleAddList} />
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>
    );
}
