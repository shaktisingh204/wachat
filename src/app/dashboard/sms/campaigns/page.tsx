

'use client';

import { useActionState, useEffect, useRef, useState, useTransition, useCallback } from 'react';
import { useFormStatus } from 'react-dom';
import { sendSmsCampaign, getSmsCampaigns, sendSingleSms } from '@/app/actions/sms.actions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoaderCircle, Send, FileUp, Calendar } from "lucide-react";
import { useProject } from '@/context/project-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { WithId, SmsCampaign } from '@/lib/definitions';
import { formatDistanceToNow } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DatePicker } from '@/components/ui/date-picker';
import { Switch } from '@/components/ui/switch';

const initialState = { message: null, error: null };

function SubmitButton({ isScheduled }: { isScheduled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
      {isScheduled ? 'Schedule Campaign' : 'Send'}
    </Button>
  );
}

export default function SmsCampaignsPage() {
    const { activeProjectId } = useProject();
    const { toast } = useToast();
    
    // Actions for different forms
    const [bulkState, bulkFormAction] = useActionState(sendSmsCampaign, initialState);
    const [singleState, singleFormAction] = useActionState(sendSingleSms, initialState);
    
    const bulkFormRef = useRef<HTMLFormElement>(null);
    const singleFormRef = useRef<HTMLFormElement>(null);
    const [file, setFile] = useState<File | null>(null);

    const [campaigns, setCampaigns] = useState<WithId<SmsCampaign>[]>([]);
    const [isLoading, startTransition] = useTransition();

    const [isScheduled, setIsScheduled] = useState(false);
    const [scheduledAt, setScheduledAt] = useState<Date | undefined>();

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
        if (bulkState.message) {
            toast({ title: 'Success!', description: bulkState.message });
            bulkFormRef.current?.reset();
            setFile(null);
            fetchCampaigns();
        }
        if (bulkState.error) {
            toast({ title: 'Error Starting Campaign', description: bulkState.error, variant: 'destructive' });
        }
    }, [bulkState, toast, fetchCampaigns]);
    
    useEffect(() => {
        if (singleState.message) {
            toast({ title: 'Success!', description: singleState.message });
            singleFormRef.current?.reset();
            fetchCampaigns();
        }
        if (singleState.error) {
            toast({ title: 'Error Sending SMS', description: singleState.error, variant: 'destructive' });
        }
    }, [singleState, toast, fetchCampaigns]);

    if (!activeProjectId) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>Please select a project to send SMS.</AlertDescription>
            </Alert>
        );
    }
    
    return (
        <div className="grid lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-1">
                <Tabs defaultValue="bulk">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="bulk">Bulk Campaign</TabsTrigger>
                        <TabsTrigger value="single">Single SMS</TabsTrigger>
                    </TabsList>
                    <TabsContent value="bulk">
                         <form action={bulkFormAction} ref={bulkFormRef}>
                            <input type="hidden" name="projectId" value={activeProjectId} />
                             <input type="hidden" name="scheduledAt" value={isScheduled && scheduledAt ? scheduledAt.toISOString() : ''} />
                            <Card>
                                <CardHeader>
                                    <CardTitle>New Bulk Campaign</CardTitle>
                                    <CardDescription>Send a message to a list of contacts from a file.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="campaignName">Campaign Name</Label>
                                        <Input id="campaignName" name="campaignName" placeholder="e.g. Summer Sale Announcement" required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="message-bulk">Message</Label>
                                        <Textarea id="message-bulk" name="message" placeholder="Hello! Our summer sale starts now..." required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="contactFile">Contact File (CSV/XLSX)</Label>
                                        <Input id="contactFile" name="contactFile" type="file" required accept=".csv,.xlsx" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                                        <p className="text-xs text-muted-foreground">First column: phone, Second column: name.</p>
                                    </div>
                                    <div className="flex items-center space-x-2 pt-2">
                                        <Switch id="schedule-switch" checked={isScheduled} onCheckedChange={setIsScheduled} />
                                        <Label htmlFor="schedule-switch">Schedule for later</Label>
                                    </div>
                                    {isScheduled && (
                                        <div className="pt-2">
                                            <DatePicker date={scheduledAt} setDate={setScheduledAt} />
                                        </div>
                                    )}
                                </CardContent>
                                <CardFooter>
                                    <SubmitButton isScheduled={isScheduled} />
                                </CardFooter>
                            </Card>
                        </form>
                    </TabsContent>
                    <TabsContent value="single">
                         <form action={singleFormAction} ref={singleFormRef}>
                            <input type="hidden" name="projectId" value={activeProjectId} />
                            <Card>
                                <CardHeader>
                                    <CardTitle>Send Single SMS</CardTitle>
                                    <CardDescription>Send a message to a single phone number.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="recipient">Recipient Phone Number</Label>
                                        <Input id="recipient" name="recipient" placeholder="e.g. 919876543210" required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="message-single">Message</Label>
                                        <Textarea id="message-single" name="message" placeholder="Hello there!" required />
                                    </div>
                                </CardContent>
                                <CardFooter>
                                    <SubmitButton />
                                </CardFooter>
                            </Card>
                        </form>
                    </TabsContent>
                </Tabs>
            </div>
            <div className="lg:col-span-2">
                <Card>
                    <CardHeader><CardTitle>Campaign History</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Campaign / Recipient</TableHead>
                                    <TableHead>Sent At</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? <TableRow><TableCell colSpan={3} className="text-center h-24"><LoaderCircle className="mx-auto h-6 w-6 animate-spin"/></TableCell></TableRow>
                                : campaigns.length > 0 ? campaigns.map(c => (
                                    <TableRow key={c._id.toString()}>
                                        <TableCell>
                                            <p className="font-medium">{c.name}</p>
                                        </TableCell>
                                        <TableCell>{formatDistanceToNow(new Date(c.sentAt), { addSuffix: true })}</TableCell>
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
