
'use client';

import { useEffect, useState, useActionState, useRef, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { getProjectById, handleUpdateAutoReplySettings, type Project, handleUpdateMasterSwitch } from '@/app/actions';
import type { WithId } from 'mongodb';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Bot, Save, LoaderCircle, Clock, BrainCircuit } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';


const timezones = [
    "UTC", "GMT", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
    "Europe/London", "Europe/Berlin", "Europe/Moscow", "Asia/Dubai", "Asia/Kolkata",
    "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney"
];

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];


function SaveButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      {children}
    </Button>
  );
}

const updateSettingsInitialState = { message: null, error: null };

function MasterSwitch({ project }: { project: WithId<Project> }) {
    const { toast } = useToast();
    const [isSubmitting, startTransition] = useTransition();

    const [isChecked, setIsChecked] = useState(project.autoReplySettings?.masterEnabled !== false);
    
    useEffect(() => {
        setIsChecked(project.autoReplySettings?.masterEnabled !== false);
    }, [project.autoReplySettings?.masterEnabled]);

    const onCheckedChange = (checked: boolean) => {
        setIsChecked(checked); // Optimistic UI update

        startTransition(async () => {
            const result = await handleUpdateMasterSwitch(project._id.toString(), checked);

            if (result.message) {
                toast({ title: 'Success!', description: result.message });
            }
            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
                // Revert optimistic update on error
                setIsChecked(prev => !prev);
            }
        });
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Master Auto-Reply Switch</CardTitle>
                        <CardDescription>Enable or disable all auto-replies for this project.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        {isSubmitting && <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground" />}
                        <Switch 
                            checked={isChecked}
                            onCheckedChange={onCheckedChange}
                            disabled={isSubmitting}
                        />
                    </div>
                </div>
            </CardHeader>
        </Card>
    );
}

function GeneralReplyForm({ project }: { project: WithId<Project> }) {
    const [state, formAction] = useActionState(handleUpdateAutoReplySettings, updateSettingsInitialState);
    const { toast } = useToast();
    const settings = project.autoReplySettings?.general;

    useEffect(() => {
        if (state?.message) toast({ title: 'Success!', description: state.message });
        if (state?.error) toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }, [state, toast]);

    return (
        <form action={formAction}>
            <input type="hidden" name="projectId" value={project._id.toString()} />
            <input type="hidden" name="replyType" value="general" />
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>General Auto Reply</CardTitle>
                        <CardDescription>Send a standard reply to any incoming message.</CardDescription>
                    </div>
                    <Switch name="enabled" defaultChecked={settings?.enabled} />
                </div>
            </CardHeader>
            <CardContent>
                <Label htmlFor="general-message">Reply Message</Label>
                <Textarea id="general-message" name="message" className="min-h-32 mt-2"
                    placeholder="Thank you for your message! We will get back to you shortly."
                    defaultValue={settings?.message}
                    required />
            </CardContent>
            <CardFooter>
                <SaveButton>Save General Reply</SaveButton>
            </CardFooter>
        </form>
    );
}

function InactiveHoursForm({ project }: { project: WithId<Project> }) {
    const [state, formAction] = useActionState(handleUpdateAutoReplySettings, updateSettingsInitialState);
    const { toast } = useToast();
    const settings = project.autoReplySettings?.inactiveHours;

    useEffect(() => {
        if (state?.message) toast({ title: 'Success!', description: state.message });
        if (state?.error) toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }, [state, toast]);

    return (
        <form action={formAction}>
            <input type="hidden" name="projectId" value={project._id.toString()} />
            <input type="hidden" name="replyType" value="inactiveHours" />
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Inactive Hours Reply</CardTitle>
                        <CardDescription>Reply automatically when customers message you outside of business hours.</CardDescription>
                    </div>
                    <Switch name="enabled" defaultChecked={settings?.enabled} />
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="startTime">From</Label>
                        <Input id="startTime" name="startTime" type="time" defaultValue={settings?.startTime || '18:00'} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="endTime">To</Label>
                        <Input id="endTime" name="endTime" type="time" defaultValue={settings?.endTime || '09:00'} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="timezone">Timezone</Label>
                        <Select name="timezone" defaultValue={settings?.timezone || 'UTC'}>
                            <SelectTrigger id="timezone"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {timezones.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                 <div className="space-y-2">
                    <Label>Repeat on</Label>
                    <div className="flex flex-wrap gap-4">
                        {dayLabels.map((day, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <Checkbox id={`day_${index}`} name={`day_${index}`} defaultChecked={settings?.days?.includes(index)} />
                                <Label htmlFor={`day_${index}`} className="font-normal">{day}</Label>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="inactive-message">Away Message</Label>
                    <Textarea id="inactive-message" name="message" className="min-h-32"
                        placeholder="Thanks for contacting us! We're currently closed, but we'll get back to you during our business hours (Mon-Fri, 9am-6pm)."
                        defaultValue={settings?.message}
                        required />
                </div>
            </CardContent>
            <CardFooter>
                <SaveButton>Save Inactive Hours Reply</SaveButton>
            </CardFooter>
        </form>
    );
}

function AiAssistantForm({ project }: { project: WithId<Project> }) {
    const [state, formAction] = useActionState(handleUpdateAutoReplySettings, updateSettingsInitialState);
    const { toast } = useToast();
    const settings = project.autoReplySettings?.aiAssistant;

    useEffect(() => {
        if (state?.message) toast({ title: 'Success!', description: state.message });
        if (state?.error) toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }, [state, toast]);

    return (
        <form action={formAction}>
            <input type="hidden" name="projectId" value={project._id.toString()} />
            <input type="hidden" name="replyType" value="aiAssistant" />
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>AI Assistant Reply</CardTitle>
                        <CardDescription>Let an AI handle initial queries with your business context.</CardDescription>
                    </div>
                    <Switch name="enabled" defaultChecked={settings?.enabled} />
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center justify-between rounded-lg border p-4 shadow-sm">
                    <div className="space-y-0.5">
                        <Label htmlFor="auto-translate-switch" className="text-base">Enable Automatic Translation</Label>
                        <p className="text-sm text-muted-foreground">
                            Automatically detect the user's language from their country code and reply in their native language.
                        </p>
                    </div>
                    <Switch id="auto-translate-switch" name="autoTranslate" defaultChecked={settings?.autoTranslate} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="ai-context">Business Context / Instructions</Label>
                    <Textarea id="ai-context" name="context" className="min-h-48 mt-2 font-mono text-xs"
                        placeholder="e.g., You are an assistant for 'My Awesome Pizza'. We are open 11am-10pm. Our specialties are pepperoni and margherita pizza. Our address is 123 Main St."
                        defaultValue={settings?.context}
                        required />
                    <p className="text-xs text-muted-foreground mt-2">Provide the AI with all the information it needs to answer customer questions accurately.</p>
                </div>
            </CardContent>
            <CardFooter>
                <SaveButton>Save AI Assistant</SaveButton>
            </CardFooter>
        </form>
    );
}


export default function AutoReplyPage() {
    const [project, setProject] = useState<WithId<Project> | null>(null);
    const [loading, setLoading] = useState(true);
    const [isClient, setIsClient] = useState(false);
  
    useEffect(() => {
        setIsClient(true);
        document.title = "Auto Reply | Wachat";
        const storedProjectId = localStorage.getItem('activeProjectId');
        if (storedProjectId) {
            getProjectById(storedProjectId).then(setProject).finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    if (!isClient || loading) {
        return (
            <div className="flex flex-col gap-8">
                <Skeleton className="h-8 w-1/3" />
                <Card>
                    <CardHeader><Skeleton className="h-6 w-1/4" /></CardHeader>
                    <CardContent><Skeleton className="h-48 w-full" /></CardContent>
                </Card>
            </div>
        );
    }

    if (!project) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>
                    Please select a project from the main dashboard to configure auto-replies.
                </AlertDescription>
            </Alert>
        );
    }
  
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">Auto Reply Settings</h1>
                <p className="text-muted-foreground">Configure automated responses for project "{project.name}".</p>
            </div>
            
            <MasterSwitch project={project} />

            <Tabs defaultValue="general" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="general"><Bot className="mr-2 h-4 w-4" />General</TabsTrigger>
                    <TabsTrigger value="inactive"><Clock className="mr-2 h-4 w-4" />Inactive Hours</TabsTrigger>
                    <TabsTrigger value="ai"><BrainCircuit className="mr-2 h-4 w-4" />AI Assistant</TabsTrigger>
                </TabsList>
                <TabsContent value="general">
                    <Card><GeneralReplyForm project={project} /></Card>
                </TabsContent>
                <TabsContent value="inactive">
                    <Card><InactiveHoursForm project={project} /></Card>
                </TabsContent>
                <TabsContent value="ai">
                    <Card><AiAssistantForm project={project} /></Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
