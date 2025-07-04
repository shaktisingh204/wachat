'use client';

import { useState, useActionState, useRef, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { handleCreateFacebookPost } from '@/app/actions/facebook.actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, ChevronLeft, Image as ImageIcon, LoaderCircle, Send, Type, Video, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { DatePicker } from '@/components/ui/date-picker';

const initialState = { message: null, error: null };

function SubmitButton({ isScheduled }: { isScheduled: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" size="lg" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {isScheduled ? 'Schedule Post' : 'Create Post'}
        </Button>
    )
}

export default function CreateFacebookPostPage() {
    const [state, formAction] = useActionState(handleCreateFacebookPost, initialState);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);
    const [projectId, setProjectId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('text');
    const [mediaSource, setMediaSource] = useState('url');
    const [isScheduled, setIsScheduled] = useState(false);
    const [scheduledDate, setScheduledDate] = useState<Date>();

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
    }, []);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success', description: state.message });
            formRef.current?.reset();
            setIsScheduled(false);
            setScheduledDate(undefined);
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast]);

    const MediaInputs = () => (
        <div className="space-y-4">
            <RadioGroup value={mediaSource} onValueChange={setMediaSource} className="flex gap-4">
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="url" id="source-url" />
                    <Label htmlFor="source-url">From URL</Label>
                </div>
                 <div className="flex items-center space-x-2">
                    <RadioGroupItem value="file" id="source-file" />
                    <Label htmlFor="source-file">Upload File</Label>
                </div>
            </RadioGroup>
            {mediaSource === 'url' ? (
                <div className="space-y-2">
                    <Label htmlFor="mediaUrl">Public Media URL</Label>
                    <Input id="mediaUrl" name="mediaUrl" type="url" placeholder="https://example.com/image.jpg" />
                </div>
            ) : (
                 <div className="space-y-2">
                    <Label htmlFor="mediaFile">File</Label>
                    <Input id="mediaFile" name="mediaFile" type="file" />
                </div>
            )}
        </div>
    );

    return (
        <div className="space-y-6">
            <div>
                <Button variant="ghost" asChild className="mb-4 -ml-4">
                    <Link href="/dashboard/facebook"><ChevronLeft className="mr-2 h-4 w-4" />Back to Facebook Dashboard</Link>
                </Button>
                <h1 className="text-3xl font-bold font-headline">Create a New Page Post</h1>
                <p className="text-muted-foreground">Publish content directly to your connected Facebook Page.</p>
            </div>
            
            {!projectId ? (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Project Selected</AlertTitle>
                    <AlertDescription>Please select a project with a connected Facebook Page to create a post.</AlertDescription>
                </Alert>
            ) : (
                <form action={formAction} ref={formRef}>
                    <input type="hidden" name="projectId" value={projectId} />
                    <input type="hidden" name="postType" value={activeTab} />
                    <input type="hidden" name="scheduledDate" value={scheduledDate?.toISOString().split('T')[0]} />

                    <Card>
                        <CardHeader>
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                <TabsList className="grid w-full grid-cols-3">
                                    <TabsTrigger value="text"><Type className="mr-2 h-4 w-4" />Text</TabsTrigger>
                                    <TabsTrigger value="image"><ImageIcon className="mr-2 h-4 w-4" />Image</TabsTrigger>
                                    <TabsTrigger value="video"><Video className="mr-2 h-4 w-4" />Video</TabsTrigger>
                                </TabsList>
                                <TabsContent value="text" className="pt-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="message-text">Message</Label>
                                        <Textarea id="message-text" name="message" placeholder="What's on your mind?" className="min-h-40" />
                                    </div>
                                </TabsContent>
                                <TabsContent value="image" className="pt-6 space-y-4">
                                     <div className="space-y-2">
                                        <Label htmlFor="message-image">Caption (Optional)</Label>
                                        <Textarea id="message-image" name="message" placeholder="A caption for your image." />
                                    </div>
                                    <MediaInputs />
                                </TabsContent>
                                <TabsContent value="video" className="pt-6 space-y-4">
                                     <div className="space-y-2">
                                        <Label htmlFor="message-video">Description (Optional)</Label>
                                        <Textarea id="message-video" name="message" placeholder="A description for your video." />
                                    </div>
                                    <MediaInputs />
                                </TabsContent>
                            </Tabs>
                        </CardHeader>
                        <CardFooter className="flex flex-wrap items-center justify-between gap-4">
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center space-x-2">
                                    <Switch id="isScheduled" name="isScheduled" checked={isScheduled} onCheckedChange={setIsScheduled} />
                                    <Label htmlFor="isScheduled" className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4" />
                                        Schedule Post
                                    </Label>
                                </div>
                                {isScheduled && (
                                    <div className="flex flex-wrap gap-2">
                                        <DatePicker date={scheduledDate} setDate={setScheduledDate} />
                                        <Input name="scheduledTime" type="time" required />
                                    </div>
                                )}
                            </div>
                            <SubmitButton isScheduled={isScheduled} />
                        </CardFooter>
                    </Card>
                </form>
            )}
        </div>
    );
}
