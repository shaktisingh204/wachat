'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { handleUpdateCommentAutoReplySettings } from '@/app/actions/facebook.actions';
import { getProjectById } from '@/app/actions';
import type { WithId, Project, FacebookCommentAutoReplySettings } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { LoaderCircle, Save, MessageSquareReply, ShieldX, Bot } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const initialState = { success: false, error: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="lg">
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save Settings
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

export default function AutoReplyPage() {
    const [project, setProject] = useState<WithId<Project> | null>(null);
    const [isLoading, startLoading] = useTransition();
    const [state, formAction] = useActionState(handleUpdateCommentAutoReplySettings, initialState);
    const { toast } = useToast();
    const settings = project?.facebookCommentAutoReply;
    const [replyMode, setReplyMode] = useState<'static' | 'ai'>(settings?.replyMode || 'static');
    
    useEffect(() => {
        startLoading(async () => {
            const projectId = localStorage.getItem('activeProjectId');
            if (projectId) {
                const data = await getProjectById(projectId);
                setProject(data);
                 if (data?.facebookCommentAutoReply?.replyMode) {
                    setReplyMode(data.facebookCommentAutoReply.replyMode);
                }
            }
        });
    }, []);
    
     useEffect(() => {
        if (state.success) {
            toast({ title: 'Success!', description: 'Auto-reply settings saved.' });
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast]);

    if(isLoading) {
        return <PageSkeleton />;
    }
    
    if(!project) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>Please select a project to manage its auto-reply settings.</AlertDescription>
            </Alert>
        );
    }
    
    return (
        <form action={formAction} className="space-y-6">
            <input type="hidden" name="projectId" value={project._id.toString()} />
             <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <MessageSquareReply className="h-8 w-8"/>
                    Comment Automation
                </h1>
                <p className="text-muted-foreground mt-2">
                    Manage automatic replies and moderation for your Facebook Page comments.
                </p>
            </div>
            
            <Card>
                <CardHeader>
                     <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="enabled" className="text-base font-semibold">Enable Automation</Label>
                            <p className="text-sm text-muted-foreground">Master switch to enable or disable all comment automation features.</p>
                        </div>
                        <Switch id="enabled" name="enabled" defaultChecked={settings?.enabled ?? false} />
                    </div>
                </CardHeader>
            </Card>

            <Tabs defaultValue="replies" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="replies"><Bot className="mr-2 h-4 w-4"/>Replies</TabsTrigger>
                    <TabsTrigger value="moderation"><ShieldX className="mr-2 h-4 w-4"/>Moderation</TabsTrigger>
                </TabsList>
                <TabsContent value="replies" className="mt-4">
                    <Card className="card-gradient card-gradient-blue">
                         <CardHeader>
                            <CardTitle>Reply Settings</CardTitle>
                            <CardDescription>Choose how the system should reply to new comments.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
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
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="moderation" className="mt-4">
                     <Card className="card-gradient card-gradient-orange">
                         <CardHeader>
                            <CardTitle>Content Moderation</CardTitle>
                             <div className="flex items-center justify-between pt-2">
                                <div className="space-y-0.5">
                                    <Label htmlFor="moderationEnabled" className="text-base">Enable AI Moderation</Label>
                                    <p className="text-sm text-muted-foreground">Automatically delete comments that violate your rules.</p>
                                </div>
                                <Switch id="moderationEnabled" name="moderationEnabled" defaultChecked={settings?.moderationEnabled ?? false} />
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="moderationPrompt">Moderation Prompt</Label>
                                <Textarea id="moderationPrompt" name="moderationPrompt" placeholder="Delete any comments that contain profanity, hate speech, or personal attacks." defaultValue={settings?.moderationPrompt || ''} className="min-h-32" />
                                <p className="text-xs text-muted-foreground">Define the rules for the AI to follow. If the AI determines a comment violates these rules, it will be deleted.</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
            <div className="flex justify-end">
                <SubmitButton />
            </div>
        </form>
    );
}
