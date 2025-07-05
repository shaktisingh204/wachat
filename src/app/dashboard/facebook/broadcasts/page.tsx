
'use client';

import { useState, useEffect, useTransition, useCallback, useRef } from 'react';
import type { WithId } from 'mongodb';
import { getFacebookBroadcasts, handleSendFacebookBroadcast, getProjectById } from '@/app/actions/facebook.actions';
import type { Project, FacebookBroadcast } from '@/lib/definitions';
import { useActionState, useFormStatus } from 'react-dom';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { LoaderCircle, Send, AlertCircle, Clock } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { formatDistanceToNow } from 'date-fns';
import { Progress } from '@/components/ui/progress';

const initialState = { message: null, error: undefined };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send Broadcast
        </Button>
    )
}

function PageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
        </div>
    );
}

export default function FacebookBroadcastsPage() {
    const [project, setProject] = useState<WithId<Project> | null>(null);
    const [broadcasts, setBroadcasts] = useState<WithId<FacebookBroadcast>[]>([]);
    const [isLoading, startLoading] = useTransition();
    const [isClient, setIsClient] = useState(false);
    const [projectId, setProjectId] = useState<string | null>(null);

    const [state, formAction] = useActionState(handleSendFacebookBroadcast, initialState);
    const formRef = useRef<HTMLFormElement>(null);
    const { toast } = useToast();

    const fetchData = useCallback(() => {
        if (!projectId) return;
        startLoading(async () => {
            const [projectData, broadcastsData] = await Promise.all([
                getProjectById(projectId),
                getFacebookBroadcasts(projectId)
            ]);
            setProject(projectData);
            setBroadcasts(broadcastsData);
        });
    }, [projectId]);

    useEffect(() => {
        setIsClient(true);
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
    }, []);

    useEffect(() => {
        if (projectId) {
            fetchData();
        }
    }, [projectId, fetchData]);

    useEffect(() => {
        if (state.message) {
            toast({ title: "Success", description: state.message });
            formRef.current?.reset();
            fetchData();
        }
        if (state.error) {
            toast({ title: "Error", description: state.error, variant: 'destructive' });
        }
    }, [state, toast, fetchData]);

    if (!isClient) {
        return <PageSkeleton />;
    }

    if (!projectId) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>Please select a project from the main dashboard to use Facebook Broadcasts.</AlertDescription>
            </Alert>
        );
    }
    
    const getStatusVariant = (status: string) => {
        const s = status.toLowerCase();
        if (s === 'completed') return 'default';
        if (s === 'processing' || s === 'queued') return 'secondary';
        return 'destructive';
    };
    
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <Send className="h-8 w-8"/>
                    Facebook Broadcasts
                </h1>
                <p className="text-muted-foreground mt-2">
                    Send a message to all users who have previously messaged your page.
                </p>
            </div>
            
            <form action={formAction} ref={formRef}>
                <input type="hidden" name="projectId" value={projectId} />
                <Card className="card-gradient card-gradient-blue">
                    <CardHeader>
                        <CardTitle>Create New Broadcast</CardTitle>
                        <CardDescription>Messages will be sent to all contacts who are eligible to receive them. Requires POST_PURCHASE_UPDATE tag permission.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Label htmlFor="message">Message</Label>
                        <Textarea id="message" name="message" className="min-h-32" placeholder="Enter your broadcast message..." required />
                    </CardContent>
                    <CardFooter className="flex justify-end">
                        <SubmitButton />
                    </CardFooter>
                </Card>
            </form>

            <Card className="card-gradient card-gradient-green">
                <CardHeader>
                    <CardTitle>Broadcast History</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Created</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Message</TableHead>
                                    <TableHead>Stats</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? <TableRow><TableCell colSpan={4}><Skeleton className="h-10 w-full"/></TableCell></TableRow>
                                : broadcasts.length > 0 ? broadcasts.map(b => (
                                    <TableRow key={b._id.toString()}>
                                        <TableCell>{formatDistanceToNow(new Date(b.createdAt), { addSuffix: true })}</TableCell>
                                        <TableCell><Badge variant={getStatusVariant(b.status)}>{b.status}</Badge></TableCell>
                                        <TableCell className="max-w-sm truncate">{b.message}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col text-xs">
                                                <span>Sent: {b.successCount}/{b.totalRecipients}</span>
                                                <span className="text-destructive">Failed: {b.failedCount}</span>
                                                {b.status === 'PROCESSING' && <Progress value={(b.successCount + b.failedCount) / b.totalRecipients * 100} className="h-1 mt-1"/>}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                                : <TableRow><TableCell colSpan={4} className="text-center h-24">No broadcasts sent yet.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

        </div>
    );
}
