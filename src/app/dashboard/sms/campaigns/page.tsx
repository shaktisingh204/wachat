
'use client';

import { useActionState, useEffect, useRef, useState, useTransition, useCallback } from 'react';
import { useFormStatus } from 'react-dom';
import { sendSmsCampaign, getSmsCampaigns } from '@/app/actions/sms.actions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoaderCircle, Send } from "lucide-react";
import { useProject } from '@/context/project-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { WithId, SmsCampaign } from '@/lib/definitions';
import { formatDistanceToNow } from 'date-fns';

const initialState = { message: null, error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
      Send Campaign
    </Button>
  );
}

export default function SmsCampaignsPage() {
    const { activeProjectId } = useProject();
    const [state, formAction] = useActionState(sendSmsCampaign, initialState);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);
    const [campaigns, setCampaigns] = useState<WithId<SmsCampaign>[]>([]);
    const [isLoading, startTransition] = useTransition();

    const fetchCampaigns = useCallback(() => {
        if (activeProjectId) {
            startTransition(async () => {
                const data = await getSmsCampaigns(activeProjectId);
                setCampaigns(data);
            });
        }
    }, [activeProjectId]);

    useEffect(() => {
        fetchCampaigns();
    }, [fetchCampaigns]);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            formRef.current?.reset();
            fetchCampaigns();
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, fetchCampaigns]);

    if (!activeProjectId) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>Please select a project to manage SMS campaigns.</AlertDescription>
            </Alert>
        );
    }
    
    return (
        <div className="grid lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-1">
                <form action={formAction} ref={formRef}>
                    <input type="hidden" name="projectId" value={activeProjectId} />
                    <Card>
                        <CardHeader>
                            <CardTitle>New SMS Campaign</CardTitle>
                            <CardDescription>Send a message to all your SMS contacts.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="campaignName">Campaign Name</Label>
                                <Input id="campaignName" name="campaignName" placeholder="e.g. Summer Sale Announcement" required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="message">Message</Label>
                                <Textarea id="message" name="message" placeholder="Hello! Our summer sale starts now..." required />
                                <p className="text-xs text-muted-foreground">Character count is not yet implemented.</p>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <SubmitButton />
                        </CardFooter>
                    </Card>
                </form>
            </div>
            <div className="lg:col-span-2">
                <Card>
                    <CardHeader><CardTitle>Campaign History</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Campaign</TableHead>
                                    <TableHead>Sent</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? <TableRow><TableCell colSpan={3} className="text-center h-24"><LoaderCircle className="mx-auto h-6 w-6 animate-spin"/></TableCell></TableRow>
                                : campaigns.length > 0 ? campaigns.map(c => (
                                    <TableRow key={c._id.toString()}>
                                        <TableCell>
                                            <p className="font-medium">{c.name}</p>
                                            <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(c.sentAt), { addSuffix: true })}</p>
                                        </TableCell>
                                        <TableCell>{c.recipientCount}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col text-xs">
                                                <Badge variant="default" className="mb-1">Sent: {c.successCount}</Badge>
                                                <Badge variant="destructive">Failed: {c.failedCount}</Badge>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                                : <TableRow><TableCell colSpan={3} className="text-center h-24">No campaigns sent yet.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
