'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { handleUpdateFacebookAutomationSettings } from '@/app/actions/facebook.actions';
import { getProjectById } from '@/app/actions';
import type { WithId, Project, FacebookCommentAutoReplySettings, FacebookWelcomeMessageSettings } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { LoaderCircle, Save, MessageSquareReply, ShieldX, Bot, MessageSquareHeart } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const initialState = { success: false, error: undefined };

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="lg">
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      {children}
    </Button>
  );
}

function PageSkeleton() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-10 w-64"/>
            <Skeleton className="h-4 w-96"/>
            <div className="space-y-4">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-48 w-full" />
            </div>
        </div>
    );
}

function CommentAutomationForm({ project, settings }: { project: WithId<Project>, settings?: FacebookCommentAutoReplySettings }) {
    const [state, formAction] = useActionState(handleUpdateFacebookAutomationSettings, initialState);
    const { toast } = useToast();
    const [replyMode, setReplyMode] = useState<'static' | 'ai'>(settings?.replyMode || 'static');
    
    useEffect(() => {
        if (state.success) toast({ title: 'Success!', description: 'Comment automation settings saved.' });
        if (state.error) toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }, [state, toast]);
    
    return (
        <form action={formAction}>
            <input type="hidden" name="projectId" value={project._id.toString()} />
            <input type="hidden" name="automationType" value="comment" />
            <Card className="card-gradient card-gradient-purple">
                <CardHeader>
                     <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="enabled" className="text-base font-semibold">Enable Comment Automation</Label>
                            <p className="text-sm text-muted-foreground">Master switch for all comment-related features.</p>
                        </div>
                        <Switch id="enabled" name="enabled" defaultChecked={settings?.enabled ?? false} />
                    </div>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="replies" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="replies"><Bot className="mr-2 h-4 w-4"/>Replies</TabsTrigger>
                            <TabsTrigger value="moderation"><ShieldX className="mr-2 h-4 w-4"/>Moderation</TabsTrigger>
                        </TabsList>
                        <TabsContent value="replies" className="mt-4 space-y-4">
                             <RadioGroup name="replyMode" value={replyMode} onValueChange={(v) => setReplyMode(v as any)} className="flex gap-4 pt-1">
                                <div className="flex items-center space-x-2"><RadioGroupItem value="static" id="mode-static" /><Label htmlFor="mode-static" className="font-normal">Static Reply</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="ai" id="mode-ai" /><Label htmlFor="mode-ai" className="font-normal">AI-Generated Reply</Label></div>
                             </RadioGroup>
                             <Separator />
                             {replyMode === 'static' ? (
                                <div className="space-y-2">
                                    <Label htmlFor="staticReplyText">Static Reply Text</Label>
                                    <Textarea id="staticReplyText" name="staticReplyText" placeholder="Thanks for your comment! We'll get back to you shortly." defaultValue={settings?.staticReplyText || ''} className="min-h-32" />
                                </div>
                             ) : (
                                <div className="space-y-2">
                                    <Label htmlFor="aiReplyPrompt">AI Reply Prompt</Label>
                                    <Textarea id="aiReplyPrompt" name="aiReplyPrompt" placeholder="You are a friendly community manager. Acknowledge the user's comment and tell them you appreciate their feedback. Keep it brief and positive." defaultValue={settings?.aiReplyPrompt || ''} className="min-h-32" />
                                     <p className="text-xs text-muted-foreground">Provide instructions for the AI on how to generate replies.</p>
                                </div>
                             )}
                        </TabsContent>
                         <TabsContent value="moderation" className="mt-4 space-y-4">
                            <div className="flex items-center justify-between pt-2">
                                <div className="space-y-0.5">
                                    <Label htmlFor="moderationEnabled" className="text-base">Enable AI Moderation</Label>
                                    <p className="text-sm text-muted-foreground">Automatically delete comments that violate your rules.</p>
                                </div>
                                <Switch id="moderationEnabled" name="moderationEnabled" defaultChecked={settings?.moderationEnabled ?? false} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="moderationPrompt">Moderation Prompt</Label>
                                <Textarea id="moderationPrompt" name="moderationPrompt" placeholder="Delete any comments that contain profanity, hate speech, or personal attacks." defaultValue={settings?.moderationPrompt || ''} className="min-h-32" />
                                <p className="text-xs text-muted-foreground">Define the rules for the AI to follow. If the AI determines a comment violates these rules, it will be deleted.</p>
                            </div>
                         </TabsContent>
                    </Tabs>
                </CardContent>
                <CardFooter><SubmitButton>Save Comment Settings</SubmitButton></CardFooter>
            </Card>
        </form>
    )
}

function MessengerWelcomeForm({ project, settings }: { project: WithId<Project>, settings?: FacebookWelcomeMessageSettings }) {
    const [state, formAction] = useActionState(handleUpdateFacebookAutomationSettings, initialState);
    const { toast } = useToast();
    
    useEffect(() => {
        if (state.success) toast({ title: 'Success!', description: 'Welcome message settings saved.' });
        if (state.error) toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }, [state, toast]);
    
    return (
        <form action={formAction}>
            <input type="hidden" name="projectId" value={project._id.toString()} />
            <input type="hidden" name="automationType" value="welcome" />
            <Card className="card-gradient card-gradient-green">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="welcome-enabled" className="text-base font-semibold">Enable Welcome Message</Label>
                            <p className="text-sm text-muted-foreground">Automatically send a greeting the first time a user messages your page.</p>
                        </div>
                        <Switch id="welcome-enabled" name="enabled" defaultChecked={settings?.enabled ?? false} />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        <Label htmlFor="message">Welcome Message Text</Label>
                        <Textarea id="message" name="message" placeholder="Welcome to our page! How can we help you today?" defaultValue={settings?.message || ''} className="min-h-32"/>
                    </div>
                </CardContent>
                <CardFooter><SubmitButton>Save Welcome Message</SubmitButton></CardFooter>
            </Card>
        </form>
    );
}


export default function FacebookAutomationPage() {
    const [project, setProject] = useState<WithId<Project> | null>(null);
    const [isLoading, startLoading] = useTransition();
    
    useEffect(() => {
        startLoading(async () => {
            const projectId = localStorage.getItem('activeProjectId');
            if (projectId) {
                const data = await getProjectById(projectId);
                setProject(data);
            }
        });
    }, []);
    
    if(isLoading) return <PageSkeleton />;
    
    if(!project) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>Please select a project to manage its automation settings.</AlertDescription>
            </Alert>
        );
    }
    
    return (
        <div className="space-y-6">
             <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <Bot className="h-8 w-8"/>
                    Facebook Automation
                </h1>
                <p className="text-muted-foreground mt-2">
                    Manage automations for your Facebook Page comments and Messenger conversations.
                </p>
            </div>
            
            <Tabs defaultValue="comments" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="comments"><MessageSquareReply className="mr-2 h-4 w-4"/>Comment Automation</TabsTrigger>
                    <TabsTrigger value="messenger"><MessageSquareHeart className="mr-2 h-4 w-4"/>Messenger Automation</TabsTrigger>
                </TabsList>
                <TabsContent value="comments" className="mt-6">
                    <CommentAutomationForm project={project} settings={project.facebookCommentAutoReply} />
                </TabsContent>
                <TabsContent value="messenger" className="mt-6">
                    <MessengerWelcomeForm project={project} settings={project.facebookWelcomeMessage} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
