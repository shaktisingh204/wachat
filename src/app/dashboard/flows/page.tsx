

'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { getMetaFlows, deleteMetaFlow } from '@/app/actions/meta-flow.actions';
import type { MetaFlow } from '@/lib/definitions';
import type { WithId } from 'mongodb';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, PlusCircle, ServerCog, Trash2, LoaderCircle, BookOpen, Edit, Send } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { SyncMetaFlowsButton } from '@/components/wabasimplify/sync-meta-flows-button';
import { MetaFlowToTemplateDialog } from '@/components/wabasimplify/meta-flow-to-template-dialog';
import { cn } from '@/lib/utils';


function MetaFlowCard({ flow, onDelete }: { flow: WithId<MetaFlow>, onDelete: (flowId: string, metaId: string) => void }) {
    const [isDeleting, startDeleteTransition] = useTransition();
    
    const handleDelete = () => {
        startDeleteTransition(() => {
            onDelete(flow._id.toString(), flow.metaId);
        });
    }
    
    const getStatusVariant = (status: string) => {
        if (!status) return 'secondary';
        const lowerStatus = status.toLowerCase();
        if (lowerStatus === 'published') return 'default';
        if (lowerStatus === 'draft') return 'secondary';
        return 'destructive';
    };

    return (
        <Card className={cn("flex flex-col transition-transform hover:-translate-y-1")}>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <CardTitle className="text-base">{flow.name}</CardTitle>
                    <Badge variant={getStatusVariant(flow.status)} className="capitalize">{flow.status || 'UNKNOWN'}</Badge>
                </div>
                <CardDescription>
                    {flow.categories?.map(cat => <Badge key={cat} variant="outline" className="mr-1 mt-1">{cat}</Badge>)}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
                <p className="text-xs text-muted-foreground font-mono break-all">Meta ID: {flow.metaId}</p>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
                <MetaFlowToTemplateDialog flow={flow} />
                <Button asChild variant="outline" size="sm">
                    <Link href={`/dashboard/flows/create?flowId=${flow._id.toString()}`}>
                        <Edit className="h-4 w-4"/>
                    </Link>
                </Button>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" disabled={isDeleting}>
                            {isDeleting ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4"/>}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>This will delete the flow from both Wachat and Meta. This action cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardFooter>
        </Card>
    );
}

export default function MetaFlowsPage() {
    const [flows, setFlows] = useState<WithId<MetaFlow>[]>([]);
    const [isLoading, startLoadingTransition] = useTransition();
    const [projectId, setProjectId] = useState<string | null>(null);
    const { toast } = useToast();

    const fetchFlows = useCallback(() => {
        if (!projectId) return;
        startLoadingTransition(async () => {
            const data = await getMetaFlows(projectId);
            setFlows(data);
        });
    }, [projectId]);

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
    }, []);

    useEffect(() => {
        if (projectId) {
            fetchFlows();
        }
    }, [projectId, fetchFlows]);
    
    const handleDelete = async (flowId: string, metaId: string) => {
        const result = await deleteMetaFlow(flowId, metaId);
        if (result.error) {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        } else {
            toast({ title: 'Success', description: result.message });
            fetchFlows();
        }
    }

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Meta Flows</h1>
                    <p className="text-muted-foreground">Manage your interactive Meta WhatsApp Flows.</p>
                </div>
                <div className="flex items-center gap-2">
                    <SyncMetaFlowsButton projectId={projectId} onSyncComplete={fetchFlows}/>
                    <Button asChild variant="outline">
                        <Link href="/dashboard/flows/docs">
                            <BookOpen className="mr-2 h-4 w-4"/>
                            API Docs
                        </Link>
                    </Button>
                    <Button asChild>
                        <Link href="/dashboard/flows/create">
                            <PlusCircle className="mr-2 h-4 w-4"/>
                            Create New Meta Flow
                        </Link>
                    </Button>
                </div>
            </div>

            {!projectId ? (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Project Selected</AlertTitle>
                    <AlertDescription>Please select a project from the main dashboard to manage Meta Flows.</AlertDescription>
                </Alert>
            ) : isLoading ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
                </div>
            ) : flows.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {flows.map(flow => <MetaFlowCard key={flow._id.toString()} flow={flow} onDelete={handleDelete}/>)}
                </div>
            ) : (
                <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                    <ServerCog className="mx-auto h-12 w-12" />
                    <h3 className="mt-4 text-lg font-semibold">No Meta Flows Found</h3>
                    <p className="mt-1 text-sm">Click "Create New Meta Flow" to get started.</p>
                </div>
            )}
        </div>
    );
}
