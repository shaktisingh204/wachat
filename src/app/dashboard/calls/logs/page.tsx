

'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PhoneCall, PhoneForwarded, PhoneOutgoing, ArrowDown, ArrowUp, X, Check, Clock, LoaderCircle, RefreshCw } from 'lucide-react';
import { useState, useEffect, useTransition, useCallback } from "react";
import { getCallLogs } from "@/app/actions/calling.actions";
import { Skeleton } from "@/components/ui/skeleton";
import { format, formatDistanceToNow } from "date-fns";
import { useProject } from "@/context/project-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from 'lucide-react';

const DirectionIcon = ({ direction }: { direction: string }) => {
    if (direction.includes('inbound')) return <ArrowDown className="h-4 w-4 text-green-500"/>;
    return <ArrowUp className="h-4 w-4 text-blue-500"/>;
}

const StatusBadge = ({ status }: { status: string }) => {
    let variant: "default" | "secondary" | "destructive" | "outline" = "outline";
    let Icon = Clock;
    switch(status) {
        case 'completed': variant = 'default'; Icon = Check; break;
        case 'no-answer': variant = 'secondary'; Icon = X; break;
        case 'failed':
        case 'canceled':
             variant = 'destructive'; Icon = X; break;
    }

    return <Badge variant={variant} className="capitalize"><Icon className="mr-2 h-3 w-3"/>{status}</Badge>
}

function PageSkeleton() {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-4 w-2/3" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-64 w-full" />
            </CardContent>
        </Card>
    );
}

export default function CallLogsPage() {
    const { activeProjectId } = useProject();
    const [logs, setLogs] = useState<any[]>([]);
    const [isLoading, startTransition] = useTransition();

    const fetchData = useCallback(() => {
        if (!activeProjectId) return;
        startTransition(async () => {
            const data = await getCallLogs(activeProjectId);
            setLogs(data);
        });
    }, [activeProjectId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    if (!activeProjectId) {
         return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>Please select a project to view call logs.</AlertDescription>
            </Alert>
        );
    }
    
    if (isLoading && logs.length === 0) {
        return <PageSkeleton />;
    }

    return (
        <div className="flex flex-col gap-8">
             <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold font-headline">Call Logs</h1>
                <Button variant="outline" onClick={() => fetchData()} disabled={isLoading}>
                    {isLoading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Refresh
                </Button>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Recent Calls</CardTitle>
                    <CardDescription>A log of all inbound and outbound calls.</CardDescription>
                </CardHeader>
                 <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead></TableHead>
                                    <TableHead>From</TableHead>
                                    <TableHead>To</TableHead>
                                    <TableHead>Duration</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Time</TableHead>
                                    <TableHead>Call SID</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {logs.length > 0 ? (
                                    logs.map(log => (
                                        <TableRow key={log._id}>
                                            <TableCell><DirectionIcon direction={log.direction}/></TableCell>
                                            <TableCell className="font-mono text-xs">{log.from}</TableCell>
                                            <TableCell className="font-mono text-xs">{log.to}</TableCell>
                                            <TableCell>{log.duration}s</TableCell>
                                            <TableCell><StatusBadge status={log.status} /></TableCell>
                                            <TableCell>{formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}</TableCell>
                                            <TableCell className="font-mono text-xs">{log.callSid}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center h-24">
                                            No call logs found for this project.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
