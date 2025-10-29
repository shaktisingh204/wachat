
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, LoaderCircle, RefreshCw } from "lucide-react";
import { useState, useEffect, useTransition, useCallback } from 'react';
import { getLiveVisitors } from '@/app/actions/sabchat.actions';
import type { WithId, SabChatSession } from '@/lib/definitions';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

function PageSkeleton() {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-64 mt-2" />
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
            </CardContent>
        </Card>
    );
}

export default function SabChatVisitorsPage() {
    const [visitors, setVisitors] = useState<WithId<SabChatSession>[]>([]);
    const [isLoading, startLoading] = useTransition();
    const { toast } = useToast();

    const fetchData = useCallback((showToast = false) => {
        startLoading(async () => {
            try {
                const data = await getLiveVisitors();
                setVisitors(data);
                if (showToast) {
                    toast({ title: 'Refreshed', description: 'Visitor list has been updated.' });
                }
            } catch (e) {
                toast({ title: 'Error', description: 'Failed to fetch live visitors.', variant: 'destructive'});
            }
        });
    }, [toast]);
    
    useEffect(() => {
        fetchData(); // Initial fetch
        const intervalId = setInterval(() => fetchData(), 10000); // Poll every 10 seconds
        return () => clearInterval(intervalId);
    }, [fetchData]);


    if (isLoading && visitors.length === 0) {
        return <PageSkeleton />;
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5"/>Live Visitors</CardTitle>
                        <CardDescription>A real-time list of visitors currently on your website.</CardDescription>
                    </div>
                     <Button onClick={() => fetchData(true)} variant="outline" size="sm" disabled={isLoading}>
                        {isLoading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4"/>}
                        Refresh
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Visitor</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Last Seen</TableHead>
                                <TableHead>IP Address</TableHead>
                                <TableHead>Current Page</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {visitors.length > 0 ? (
                                visitors.map(visitor => {
                                    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
                                    const isOnline = new Date(visitor.updatedAt) > fiveMinutesAgo;
                                    return (
                                        <TableRow key={visitor._id.toString()}>
                                            <TableCell className="font-medium">{visitor.visitorInfo?.email || visitor.visitorId}</TableCell>
                                            <TableCell>
                                                <Badge variant={isOnline ? 'default' : 'secondary'}>
                                                    <div className={`h-2 w-2 rounded-full mr-2 ${isOnline ? 'bg-green-400' : 'bg-muted-foreground'}`}></div>
                                                    {isOnline ? 'Online' : 'Offline'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{formatDistanceToNow(new Date(visitor.updatedAt), { addSuffix: true })}</TableCell>
                                            <TableCell className="font-mono text-xs">{visitor.visitorInfo?.ip}</TableCell>
                                            <TableCell className="text-xs max-w-xs truncate">{visitor.visitorInfo?.page}</TableCell>
                                        </TableRow>
                                    )
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">No live visitors right now.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
