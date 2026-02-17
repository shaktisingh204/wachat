'use client';

import { useEffect, useState, useTransition, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getFlowsForProject, deleteFlow } from '@/app/actions/flow.actions';
import type { Flow } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import { format } from 'date-fns';
import { useProject } from '@/context/project-context';

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
import { AlertCircle, PlusCircle, ServerCog, Trash2, Edit, MoreHorizontal, Search, RefreshCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { SmartCombobox } from '@/components/wabasimplify/smart-combobox';

export default function FlowBuilderListPage() {
    const router = useRouter();
    const [flows, setFlows] = useState<WithId<Flow>[]>([]);
    const [isLoading, startLoadingTransition] = useTransition();
    const { activeProjectId } = useProject();
    const { toast } = useToast();

    const fetchFlows = useCallback(() => {
        if (!activeProjectId) return;
        startLoadingTransition(async () => {
            const data = await getFlowsForProject(activeProjectId);
            setFlows(data);
        });
    }, [activeProjectId]);

    useEffect(() => {
        if (activeProjectId) {
            fetchFlows();
        }
    }, [activeProjectId, fetchFlows]);

    const handleDelete = async (flowId: string) => {
        if (!confirm("Are you sure you want to delete this flow? This cannot be undone.")) return;

        const result = await deleteFlow(flowId);
        if (result.error) {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        } else {
            toast({ title: 'Success', description: result.message });
            fetchFlows();
        }
    }

    return (
        <div className="flex flex-col gap-8 h-full p-4 md:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Bot Flows</h1>
                    <p className="text-muted-foreground">Manage your automated chatbot flows.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button asChild>
                        <Link href="/dashboard/flow-builder/new">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Create New Flow
                        </Link>
                    </Button>
                </div>
            </div>

            {!activeProjectId ? (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Project Selected</AlertTitle>
                    <AlertDescription>Please select a project from the main dashboard to manage Flows.</AlertDescription>
                </Alert>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="w-full max-w-sm">
                            <SmartCombobox
                                placeholder="Search and select flow..."
                                searchPlaceholder="Search flows..."
                                options={flows.map(f => ({ label: f.name, value: f._id.toString() }))}
                                onSelect={(id) => router.push(`/dashboard/flow-builder/${id}`)}
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
                                    <TableHead>Status</TableHead>
                                    <TableHead>Trigger Keywords</TableHead>
                                    <TableHead>Last Updated</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    [...Array(5)].map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                            <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : flows.length > 0 ? (
                                    flows.map((flow) => (
                                        <TableRow key={flow._id.toString()}>
                                            <TableCell className="font-medium">
                                                <Link href={`/dashboard/flow-builder/${flow._id.toString()}`} className="hover:underline">
                                                    {flow.name}
                                                </Link>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={(flow.status === 'PAUSED') ? 'outline' : 'default'} className={(flow.status === 'PAUSED') ? 'text-amber-500 border-amber-500' : 'bg-green-500 hover:bg-green-600'}>
                                                    {flow.status || 'ACTIVE'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1">
                                                    {(flow.triggerKeywords || []).map((k, i) => (
                                                        <Badge key={i} variant="secondary" className="text-xs">{k}</Badge>
                                                    ))}
                                                    {(!flow.triggerKeywords || flow.triggerKeywords.length === 0) && <span className="text-muted-foreground text-sm italic">No triggers</span>}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {flow.updatedAt ? format(new Date(flow.updatedAt), 'MMM d, yyyy HH:mm') : 'N/A'}
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
                                                            <Link href={`/dashboard/flow-builder/${flow._id.toString()}`} className="cursor-pointer">
                                                                <Edit className="mr-2 h-4 w-4" /> Edit Flow
                                                            </Link>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            className="text-destructive focus:text-destructive cursor-pointer"
                                                            onClick={() => handleDelete(flow._id.toString())}
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
                                        <TableCell colSpan={4} className="h-24 text-center">
                                            <div className="flex flex-col items-center justify-center text-muted-foreground py-8">
                                                <ServerCog className="h-10 w-10 mb-2 opacity-20" />
                                                <p>No Bot Flows found.</p>
                                                <Button variant="link" asChild className="mt-2">
                                                    <Link href="/dashboard/flow-builder/new">Create your first flow</Link>
                                                </Button>
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
