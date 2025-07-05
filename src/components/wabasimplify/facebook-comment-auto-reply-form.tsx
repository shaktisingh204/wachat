
'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { handleUpdateCommentAutoReply } from '@/app/actions/facebook.actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { LoaderCircle, Save, MessageSquareReply } from 'lucide-react';
import type { Project, WithId, FacebookCommentAutoReplySettings } from '@/lib/definitions';

const initialState = { success: false, error: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save Auto-Reply Settings
    </Button>
  );
}

interface FacebookCommentAutoReplyFormProps {
    project: WithId<Project>;
}

export function FacebookCommentAutoReplyForm({ project }: FacebookCommentAutoReplyFormProps) {
    const [state, formAction] = useActionState(handleUpdateCommentAutoReply, initialState);
    const { toast } = useToast();
    const settings = project.facebookCommentAutoReply;

    useEffect(() => {
        if (state.success) {
            toast({ title: 'Success!', description: 'Auto-reply settings saved.' });
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast]);

    return (
        <form action={formAction}>
            <input type="hidden" name="projectId" value={project._id.toString()} />
            <Card className="card-gradient card-gradient-purple">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MessageSquareReply className="h-5 w-5" />
                        Comment Auto-Reply
                    </CardTitle>
                    <CardDescription>
                        Automatically reply to new comments on your Facebook posts.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border p-4 shadow-sm">
                        <div className="space-y-0.5">
                            <Label htmlFor="enabled" className="text-base">Enable Auto-Reply</Label>
                            <p className="text-sm text-muted-foreground">Automatically post a reply to all new top-level comments.</p>
                        </div>
                        <Switch id="enabled" name="enabled" defaultChecked={settings?.enabled ?? false} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="replyText">Reply Text</Label>
                        <Textarea
                            id="replyText"
                            name="replyText"
                            placeholder="Thanks for your comment! We'll get back to you shortly."
                            defaultValue={settings?.replyText || ''}
                            className="min-h-32"
                        />
                        <p className="text-xs text-muted-foreground">This message will be posted as a reply to the comment.</p>
                    </div>
                </CardContent>
                <CardFooter>
                    <SubmitButton />
                </CardFooter>
            </Card>
        </form>
    );
}
