
'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Bot, LoaderCircle, Save } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { saveSabChatSettings } from '@/app/actions/sabchat.actions';
import { useProject } from '@/context/project-context';

const initialState = { message: null, error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save Auto-Reply Settings
    </Button>
  );
}

export default function AutoReplyPage() {
    const { sessionUser, reloadProject } = useProject();
    const settings = sessionUser?.sabChatSettings || {};
    const [state, formAction] = useActionState(saveSabChatSettings, initialState);
    const { toast } = useToast();

    useEffect(() => {
        if (state.message) {
            toast({ title: "Success!", description: state.message });
            reloadProject();
        }
        if (state.error) {
            toast({ title: "Error", description: state.error, variant: 'destructive' });
        }
    }, [state, toast, reloadProject]);

    return (
        <form action={formAction}>
            {/* Pass through existing settings that aren't on this form */}
            <input type="hidden" name="settings" value={JSON.stringify({
                enabled: settings.enabled,
                widgetColor: settings.widgetColor,
                teamName: settings.teamName,
                avatarUrl: settings.avatarUrl,
                officeHours: settings.officeHours,
                aiEnabled: settings.aiEnabled,
                aiContext: settings.aiContext,
                faqs: settings.faqs,
                quickReplies: settings.quickReplies,
            })} />
             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Bot className="h-6 w-6"/>Automated Messages</CardTitle>
                    <CardDescription>
                        Configure messages that are sent automatically to your visitors.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                     <div className="p-4 border rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="welcomeEnabled" className="font-semibold">Welcome Message</Label>
                            <Switch id="welcomeEnabled" name="welcomeEnabled" defaultChecked={settings.welcomeEnabled} />
                        </div>
                        <p className="text-sm text-muted-foreground">The first message a visitor sees when they start a chat.</p>
                        <Textarea
                            name="welcomeMessage"
                            defaultValue={settings.welcomeMessage || 'Hello! How can we help you today?'}
                            placeholder="Welcome message..."
                            className="min-h-24"
                        />
                    </div>

                    <div className="p-4 border rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="awayMessageEnabled" className="font-semibold">Away Message</Label>
                             <Switch id="awayMessageEnabled" name="awayMessageEnabled" defaultChecked={settings.awayMessageEnabled} />
                        </div>
                        <p className="text-sm text-muted-foreground">Sent automatically when a visitor messages you outside of office hours.</p>
                        <Textarea
                            name="awayMessage"
                            defaultValue={settings.awayMessage || 'We are currently away, but we will get back to you as soon as possible.'}
                            placeholder="Away message..."
                            className="min-h-24"
                        />
                         <p className="text-xs text-muted-foreground">Office hours can be configured under general settings.</p>
                    </div>
                </CardContent>
                 <CardFooter>
                    <SubmitButton />
                </CardFooter>
            </Card>
        </form>
    );
}
