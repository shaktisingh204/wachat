
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PhoneCall, PhoneForwarded, PhoneOutgoing, ArrowDown, ArrowUp, X, Check, Clock, LoaderCircle, RefreshCw } from 'lucide-react';
import { useState, useEffect, useTransition, useCallback } from "react";
import { getCallLogs } from "@/app/actions/calling.actions";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { useProject } from "@/context/project-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from 'lucide-react';

const DirectionIcon = ({ direction }: { direction?: string }) => {
    if (direction?.includes('USER_INITIATED')) return <ArrowDown className="h-4 w-4 text-green-500"/>;
    return <ArrowUp className="h-4 w-4 text-blue-500"/>;
}

const StatusBadge = ({ status }: { status?: string }) => {
    if (!status) return <Badge variant="outline"><Clock className="mr-2 h-3 w-3"/>Unknown</Badge>;
    let variant: "default" | "secondary" | "destructive" | "outline" = "outline";
    let Icon = Clock;
    const lowerStatus = status.toLowerCase();

    if (lowerStatus === 'completed') { variant = 'default'; Icon = Check; }
    else if (lowerStatus === 'no-answer' || lowerStatus === 'missed') { variant = 'secondary'; Icon = X; }
    else if (lowerStatus === 'failed' || lowerStatus === 'canceled') { variant = 'destructive'; Icon = X; }

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
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Recent Calls</CardTitle>
                        <CardDescription>A log of all inbound and outbound calls.</CardDescription>
                    </div>
                    <Button variant="outline" onClick={() => fetchData()} disabled={isLoading}>
                        {isLoading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Refresh
                    </Button>
                </div>
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
                                        <TableCell>{formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}</TableCell>
                                        <TableCell className="font-mono text-xs">{log.callId}</TableCell>
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
    );
}

    