
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Zap, GitFork, Plus, LoaderCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useEffect, useState, useTransition } from "react";
import { getSabFlows, deleteSabFlow } from "@/app/actions/sabflow.actions";
import type { WithId, SabFlow } from "@/lib/definitions";
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
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function DeleteFlowButton({ flow, onDeleted }: { flow: WithId<SabFlow>, onDeleted: () => void }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const handleDelete = () => {
        startTransition(async () => {
            const result = await deleteSabFlow(flow._id.toString());
            if (result.message) {
                toast({ title: "Success", description: result.message });
                onDeleted();
            } else {
                toast({ title: "Error", description: result.error, variant: 'destructive' });
            }
        });
    };

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" disabled={isPending}>
                    {isPending ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4 text-destructive"/>}
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Flow?</AlertDialogTitle>
                    <AlertDialogDescription>Are you sure you want to delete the "{flow.name}" flow?</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

export default function SabFlowBuilderPage() {
    const [flows, setFlows] = useState<WithId<SabFlow>[]>([]);
    const [isLoading, startTransition] = useTransition();

    const fetchData = () => {
        startTransition(async () => {
            const data = await getSabFlows();
            setFlows(data);
        });
    };

    useEffect(() => {
        fetchData();
    }, []);

    if (isLoading && flows.length === 0) {
        return <div className="text-center p-8"><LoaderCircle className="h-8 w-8 animate-spin mx-auto"/></div>
    }

    if (flows.length === 0) {
        return (
            <div className="flex justify-center items-center h-full p-4">
                <Card className="text-center max-w-2xl animate-fade-in-up">
                    <CardHeader>
                        <div className="mx-auto bg-muted p-4 rounded-full w-fit">
                             <GitFork className="h-12 w-12 text-primary" />
                        </div>
                        <CardTitle className="mt-4 text-2xl">Create Your First SabFlow</CardTitle>
                        <CardDescription>
                            Automate tasks by connecting your favorite apps.
                        </CardDescription>
                    </CardHeader>
                     <CardContent>
                        <p className="text-muted-foreground">
                            Start by creating a new workflow.
                        </p>
                    </CardContent>
                    <CardFooter className="justify-center">
                         <Button asChild>
                            <Link href="/dashboard/sabflow/flow-builder/new">
                                <Plus className="mr-2 h-4 w-4" />
                                Create New Flow
                            </Link>
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Your Flows</h2>
                <Button asChild>
                    <Link href="/dashboard/sabflow/flow-builder/new">
                        <Plus className="mr-2 h-4 w-4" />
                        New Flow
                    </Link>
                </Button>
            </div>
             <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Flow Name</TableHead>
                            <TableHead>Trigger</TableHead>
                            <TableHead>Last Updated</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {flows.map(flow => (
                            <TableRow key={flow._id.toString()}>
                                <TableCell className="font-medium">{flow.name}</TableCell>
                                <TableCell>{flow.trigger?.type || 'Manual'}</TableCell>
                                <TableCell>{format(new Date(flow.updatedAt), 'PPP')}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" asChild>
                                        <Link href={`/dashboard/sabflow/flow-builder/${flow._id.toString()}`}>Edit</Link>
                                    </Button>
                                    <DeleteFlowButton flow={flow} onDeleted={fetchData} />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
