'use client';

import React, { useEffect, useState, useTransition, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { getMetaFlows, deleteMetaFlow } from '@/app/actions/meta-flow.actions';
import type { MetaFlow } from '@/lib/definitions';
import type { WithId } from 'mongodb';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, PlusCircle, ServerCog, Trash2, LoaderCircle, BookOpen, Edit, MoreHorizontal, Search, RefreshCcw } from 'lucide-react';
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

export default function MetaFlowsPage() {
    const [flows, setFlows] = useState<WithId<MetaFlow>[]>([]);
    const [isLoading, startLoadingTransition] = useTransition();
    const [projectId, setProjectId] = useState<string | null>(null);
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState('');

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
        if (!confirm("Are you sure you want to delete this flow? This cannot be undone.")) return;

        const result = await deleteMetaFlow(flowId, metaId);
        if (result.error) {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        } else {
            toast({ title: 'Success', description: result.message });
            fetchFlows();
        }
    }

    const filteredFlows = useMemo(() => {
        return flows.filter(flow =>
            flow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            flow.metaId.includes(searchQuery)
        );
    }, [flows, searchQuery]);

    const getStatusVariant = (status: string) => {
        if (!status) return 'secondary';
        const lowerStatus = status.toLowerCase();
        if (lowerStatus === 'published') return 'default';
        if (lowerStatus === 'draft') return 'secondary';
        return 'destructive';
    };

    return (
        <div className="flex flex-col gap-8 h-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Meta Flows</h1>
                    <p className="text-muted-foreground">Manage your interactive Meta WhatsApp Flows.</p>
                </div>
                <div className="flex items-center gap-2">
                    <SyncMetaFlowsButton projectId={projectId} onSyncComplete={fetchFlows} />
                    <Button asChild variant="outline">
                        <Link href="/dashboard/flows/docs">
                            <BookOpen className="mr-2 h-4 w-4" />
                            API Docs
                        </Link>
                    </Button>
                    <Button asChild>
                        <Link href="/dashboard/flows/create">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Create New Flow
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
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="relative w-full max-w-sm">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search flows..."
                                className="pl-8"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Button variant="ghost" size="sm" onClick={fetchFlows} disabled={isLoading}>
                            <RefreshCcw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
                            Refresh
                        </Button>
                    </div>

                    <div className="rounded-md border bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[300px]">Flow Name</TableHead>
                                    <TableHead>Meta ID</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    [...Array(5)].map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                            <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : filteredFlows.length > 0 ? (
                                    filteredFlows.map((flow) => (
                                        <TableRow key={flow._id.toString()}>
                                            <TableCell className="font-medium">
                                                <div className="flex flex-col">
                                                    <span>{flow.name}</span>
                                                    <span className="text-xs text-muted-foreground hidden sm:inline-block">Updated recently</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground">{flow.metaId}</TableCell>
                                            <TableCell>
                                                <div className="flex gap-1 flex-wrap">
                                                    {flow.categories?.map(cat => (
                                                        <Badge key={cat} variant="outline" className="text-xs font-normal">{cat}</Badge>
                                                    ))}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={getStatusVariant(flow.status)} className="capitalize">{flow.status || 'Draft'}</Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <span className="sr-only">Open menu</span>
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                        <DropdownMenuItem asChild>
                                                            <Link href={`/dashboard/flows/create?flowId=${flow._id.toString()}`} className="cursor-pointer">
                                                                <Edit className="mr-2 h-4 w-4" /> Edit Flow
                                                            </Link>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            className="text-destructive focus:text-destructive cursor-pointer"
                                                            onClick={() => handleDelete(flow._id.toString(), flow.metaId)}
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            <div className="flex flex-col items-center justify-center text-muted-foreground py-8">
                                                {searchQuery ? (
                                                    <p>No flows found matching "{searchQuery}"</p>
                                                ) : (
                                                    <>
                                                        <ServerCog className="h-10 w-10 mb-2 opacity-20" />
                                                        <p>No Meta Flows found.</p>
                                                        <Button variant="link" asChild className="mt-2">
                                                            <Link href="/dashboard/flows/create">Create your first flow</Link>
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}
        </div>
    );
}
