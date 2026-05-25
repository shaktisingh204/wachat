'use client';

import {
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
  Button,
  Input,
  Label,
  Separator,
  Accordion,
  ZoruAccordionItem,
  ZoruAccordionTrigger,
  ZoruAccordionContent,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { handleUpdateProjectSettings } from '@/app/actions/project.actions';
import type { WithId,
  Project } from '@/lib/definitions';

const initialState = {
  message: null,
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save Settings
    </Button>
  );
}

interface ProjectSettingsFormProps {
  project: WithId<Project>;
}

export function ProjectSettingsForm({ project }: ProjectSettingsFormProps) {
    const [state, formAction] = useActionState(handleUpdateProjectSettings as any, initialState as any);
    const { toast } = useToast();
    
    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Success!', description: state.message });
        }
        if (state?.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast]);

    return (
        <form action={formAction}>
            <input type="hidden" name="projectId" value={project._id.toString()} />
            <Card className="card-gradient card-gradient-blue">
                <ZoruCardHeader>
                    <ZoruCardTitle>Project Settings</ZoruCardTitle>
                    <ZoruCardDescription>Manage general and branding settings for your project.</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <Accordion type="single" collapsible defaultValue="general" className="w-full">
                        <ZoruAccordionItem value="general">
                            <ZoruAccordionTrigger>General Settings</ZoruAccordionTrigger>
                            <ZoruAccordionContent>
                                <div className="space-y-4 pt-2">
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="timezone">Time Zone</Label>
                                            <Input
                                                id="timezone"
                                                name="timezone"
                                                type="text"
                                                placeholder="e.g. Asia/Kolkata"
                                                defaultValue={project.timezone || ''}
                                            />
                                            <p className="text-xs text-muted-foreground">The default timezone for reports and scheduling.</p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="defaultLanguage">Default Language</Label>
                                            <Input
                                                id="defaultLanguage"
                                                name="defaultLanguage"
                                                type="text"
                                                placeholder="e.g. en"
                                                defaultValue={project.defaultLanguage || ''}
                                            />
                                            <p className="text-xs text-muted-foreground">The default language code for auto-replies.</p>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="messagesPerSecond">Messages Per Second (Concurrency)</Label>
                                        <Input
                                            id="messagesPerSecond"
                                            name="messagesPerSecond"
                                            type="number"
                                            defaultValue={project.messagesPerSecond || 80}
                                            required
                                        />
                                        <p className="text-xs text-muted-foreground">The maximum number of messages your broadcast campaign will attempt to send per second.</p>
                                    </div>
                                </div>
                            </ZoruAccordionContent>
                        </ZoruAccordionItem>
                        <ZoruAccordionItem value="branding">
                            <ZoruAccordionTrigger>Web Chat Branding</ZoruAccordionTrigger>
                            <ZoruAccordionContent>
                                <div className="space-y-4 pt-2">
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="widgetHeaderTitle">Header Title</Label>
                                            <Input
                                                id="widgetHeaderTitle"
                                                name="widgetHeaderTitle"
                                                type="text"
                                                placeholder="e.g. Chat with us!"
                                                defaultValue={project.widgetSettings?.headerTitle || ''}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="widgetHeaderSubtitle">Header Subtitle</Label>
                                            <Input
                                                id="widgetHeaderSubtitle"
                                                name="widgetHeaderSubtitle"
                                                type="text"
                                                placeholder="e.g. Typically replies in minutes"
                                                defaultValue={project.widgetSettings?.headerSubtitle || ''}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="widgetButtonColor">Button Color</Label>
                                            <div className="flex gap-2 items-center">
                                                <Input
                                                    id="widgetButtonColor"
                                                    name="widgetButtonColor"
                                                    type="color"
                                                    className="w-12 h-10 p-1"
                                                    defaultValue={project.widgetSettings?.buttonColor || '#25D366'}
                                                />
                                                <span className="text-sm text-muted-foreground">Hex color code</span>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="widgetHeaderAvatarUrl">Logo / Avatar URL</Label>
                                            <Input
                                                id="widgetHeaderAvatarUrl"
                                                name="widgetHeaderAvatarUrl"
                                                type="url"
                                                placeholder="https://example.com/logo.png"
                                                defaultValue={project.widgetSettings?.headerAvatarUrl || ''}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </ZoruAccordionContent>
                        </ZoruAccordionItem>
                    </Accordion>
                </ZoruCardContent>
                <ZoruCardFooter className="pt-4 border-t border-zoru-line">
                    <SubmitButton />
                </ZoruCardFooter>
            </Card>
        </form>
    );
}
