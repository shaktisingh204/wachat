
'use client';

import { useEffect, useState, useTransition } from 'react';
import { getKanbanData, handleUpdateContactStatus } from '@/app/actions';
import type { WithId, Contact, Project, KanbanData } from '@/lib/definitions';
import { KanbanColumn } from './kanban-column';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

function KanbanPageSkeleton() {
    return (
        <div className="flex-1 flex h-full overflow-x-auto p-4 gap-4">
            <div className="w-80 flex-shrink-0"><Skeleton className="h-full w-full" /></div>
            <div className="w-80 flex-shrink-0"><Skeleton className="h-full w-full" /></div>
            <div className="w-80 flex-shrink-0"><Skeleton className="h-full w-full" /></div>
        </div>
    );
}

export function KanbanBoard() {
    const [project, setProject] = useState<WithId<Project> | null>(null);
    const [boardData, setBoardData] = useState<KanbanData>({ new: [], open: [], resolved: [] });
    const [isLoading, startLoadingTransition] = useTransition();
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (isClient) {
            const storedProjectId = localStorage.getItem('activeProjectId');
            if (storedProjectId) {
                startLoadingTransition(async () => {
                    const data = await getKanbanData(storedProjectId);
                    if (data.project) setProject(data.project);
                    if (data.contacts) setBoardData(data.contacts);
                });
            }
        }
    }, [isClient]);

    const handleDrop = async (contactId: string, newStatus: 'new' | 'open' | 'resolved') => {
        let movedContact: WithId<Contact> | undefined;
        let originalStatus: keyof KanbanData | undefined;

        for (const key in boardData) {
            const statusKey = key as keyof KanbanData;
            const contact = boardData[statusKey].find(c => c._id.toString() === contactId);
            if (contact) {
                movedContact = { ...contact }; // Create a copy
                originalStatus = statusKey;
                break;
            }
        }
        
        if (!movedContact || !originalStatus || originalStatus === newStatus) {
            return;
        }

        // Optimistic UI update
        const newBoardData = { ...boardData };
        newBoardData[originalStatus] = newBoardData[originalStatus].filter(c => c._id.toString() !== contactId);
        movedContact.status = newStatus;
        newBoardData[newStatus] = [movedContact, ...newBoardData[newStatus]];
        setBoardData(newBoardData);
        
        const result = await handleUpdateContactStatus(contactId, newStatus, movedContact.assignedAgentId || '');
        if (!result.success) {
            const revertedData = { ...boardData };
            setBoardData(revertedData);
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
        <ScrollArea className="h-full w-full">
            <div className="flex h-full p-4 gap-4">
                <KanbanColumn title="New" contacts={boardData.new} onDrop={handleDrop} />
                <KanbanColumn title="Open" contacts={boardData.open} onDrop={handleDrop} />
                <KanbanColumn title="Resolved" contacts={boardData.resolved} onDrop={handleDrop} />
            </div>
            <ScrollBar orientation="horizontal" />
        </ScrollArea>
    );
}
