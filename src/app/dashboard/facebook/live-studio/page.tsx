
'use client';

import { useEffect, useState, useTransition, useCallback, useActionState, useRef } from 'react';
import type { WithId, FacebookLiveStream } from '@/lib/definitions';
import { getScheduledLiveStreams, handleScheduleLiveStream } from '@/app/actions/facebook.actions';
import { useToast } from '@/hooks/use-toast';
import { useFormStatus } from 'react-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LoaderCircle, Video, Calendar, AlertCircle, Upload } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DatePicker } from '@/components/ui/date-picker';
import { format } from 'date-fns';
import Link from 'next/link';

const scheduleInitialState = { message: null, error: undefined };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} size="lg">
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Calendar className="mr-2 h-4 w-4" />}
            Schedule Live Stream
        </Button>
    );
}

function PageSkeleton() {
     return (
        <div className="space-y-8">
            <div><Skeleton className="h-8 w-1/3" /><Skeleton className="h-4 w-2/3 mt-2" /></div>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                <Skeleton className="h-96 lg:col-span-3" />
                <Skeleton className="h-96 lg:col-span-2" />
            </div>
        </div>
    );
}

export default function LiveStudioPage() {
    const [streams, setStreams] = useState<WithId<FacebookLiveStream>[]>([]);
    const [isLoading, startLoading] = useTransition();
    const [projectId, setProjectId] = useState<string | null>(null);
    const [state, formAction] = useActionState(handleScheduleLiveStream, scheduleInitialState);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);
    const [scheduledDate, setScheduledDate] = useState<Date>();
    const [videoFile, setVideoFile] = useState<File | null>(null);

    const fetchData = useCallback(() => {
        if (!projectId) return;
        startLoading(async () => {
            const data = await getScheduledLiveStreams(projectId);
            setStreams(data);
        });
    }, [projectId]);

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
    }, []);
    
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (state.message) {
            toast({ title: "Success", description: state.message });
            formRef.current?.reset();
            setScheduledDate(undefined);
            setVideoFile(null);
            fetchData();
        }
        if (state.error) {
            toast({ title: "Error", description: state.error, variant: 'destructive' });
        }
    }, [state, toast, fetchData]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setVideoFile(file);
        }
    };

    if (!projectId) {
         return (
             <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>
                    Please select a project from the main dashboard to use the Live Studio.
                </AlertDescription>
            </Alert>
         )
    }
    
    if (isLoading) {
        return <PageSkeleton />;
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <Video className="h-8 w-8"/>
                    Live Studio
                </h1>
                <p className="text-muted-foreground mt-2">
                   Upload a pre-recorded video and schedule it to premiere as a live stream on your page.
                </p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
                <form action={formAction} ref={formRef} className="space-y-6 lg:col-span-3">
                    <input type="hidden" name="projectId" value={projectId} />
                    {scheduledDate && <input type="hidden" name="scheduledDate" value={scheduledDate.toISOString().split('T')[0]} />}

                    <Card>
                        <CardHeader>
                            <CardTitle>Schedule a Premiere</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                             <div className="space-y-2">
                                <Label htmlFor="videoFile" className="text-base font-medium">Video File</Label>
                                <div className="mt-2 flex justify-center rounded-lg border border-dashed border-muted-foreground/25 px-6 py-10">
                                    <div className="text-center">
                                        <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                                        <div className="mt-4 flex text-sm leading-6 text-muted-foreground">
                                            <Label htmlFor="videoFile" className="relative cursor-pointer rounded-md bg-transparent font-semibold text-primary focus-within:outline-none focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 hover:text-primary/80">
                                                <span>Upload a file</span>
                                                <Input id="videoFile" name="videoFile" type="file" className="sr-only" accept="video/mp4,video/quicktime" required onChange={handleFileChange} />
                                            </Label>
                                            <p className="pl-1">or drag and drop</p>
                                        </div>
                                        {videoFile ? (
                                            <p className="text-sm text-foreground mt-2">{videoFile.name}</p>
                                        ) : (
                                            <p className="text-xs leading-5">MP4, MOV up to 50MB</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="title">Title</Label>
                                <Input id="title" name="title" placeholder="e.g., Our New Product Launch!" required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description">Description (Optional)</Label>
                                <Textarea id="description" name="description" placeholder="Join us as we unveil our latest creation..." />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Date</Label>
                                    <DatePicker date={scheduledDate} setDate={setScheduledDate} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="scheduledTime">Time</Label>
                                    <Input id="scheduledTime" name="scheduledTime" type="time" required/>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <SubmitButton />
                        </CardFooter>
                    </Card>
                </form>

                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Upcoming & Past Streams</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Title</TableHead>
                                        <TableHead>Scheduled For</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {streams.length > 0 ? (
                                        streams.map(stream => (
                                            <TableRow key={stream._id.toString()}>
                                                <TableCell className="font-medium truncate max-w-xs">
                                                    <Link href={`https://www.facebook.com/${stream.facebookVideoId}`} target="_blank" className="hover:underline">
                                                        {stream.title}
                                                    </Link>
                                                </TableCell>
                                                <TableCell>{format(new Date(stream.scheduledTime), 'PPP p')}</TableCell>
                                                <TableCell><Badge>{stream.status.replace('_', ' ')}</Badge></TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center h-24">No streams scheduled yet.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
