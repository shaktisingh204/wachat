
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
      Save AI Settings
    </Button>
  );
}

export default function AiRepliesPage() {
    const { sessionUser, reloadProject } = useProject();
    const settings = sessionUser?.sabChatSettings || {};
    const [state, formAction] = useActionState(saveSabChatSettings, initialState);
    const { toast } = useToast();

    useEffect(() => {
        if (state.message) {
            toast({ title: "Success!", description: state.message });
            reloadProject(); // This re-fetches user data in the context
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
                welcomeMessage: settings.welcomeMessage,
                awayMessage: settings.awayMessage,
                teamName: settings.teamName,
                avatarUrl: settings.avatarUrl,
                officeHours: settings.officeHours,
                faqs: settings.faqs,
                quickReplies: settings.quickReplies,
            })} />
             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Bot className="h-6 w-6"/>AI Assistant Configuration</CardTitle>
                    <CardDescription>
                        Provide context about your business. The AI will use this information, along with your FAQs, to answer visitor questions automatically.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center space-x-2">
                        <Switch id="aiEnabled" name="aiEnabled" defaultChecked={settings.aiEnabled} />
                        <Label htmlFor="aiEnabled">Enable AI Assistant</Label>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="aiContext">Business Context</Label>
                        <Textarea
                            id="aiContext"
                            name="aiContext"
                            defaultValue={settings.aiContext || ''}
                            className="min-h-[250px]"
                            placeholder="Describe your business, services, hours, and common policies..."
                        />
                         <p className="text-xs text-muted-foreground">The more detailed your context, the better the AI will perform.</p>
                    </div>
                </CardContent>
                 <CardFooter>
                    <SubmitButton />
                </CardFooter>
            </Card>
        </form>
    );
}
