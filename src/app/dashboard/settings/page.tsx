
'use client';

import { useEffect, useState, useActionState, useRef, useTransition, Suspense } from 'react';
import { useFormStatus } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { getProjectById, handleUpdateProjectSettings, handleUpdateAutoReplySettings, handleUpdateMasterSwitch, handleUpdateOptInOutSettings, handleSaveUserAttributes, getSession, User, Plan, getProjects, GeneralReplyRule } from '@/app/actions';
import type { WithId } from 'mongodb';
import type { Project, UserAttribute } from '@/app/dashboard/page';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, LoaderCircle, Save, Bot, Clock, BrainCircuit, Users, Trash2, Plus, Search, ShieldCheck, ClipboardList, UserCog, Handshake, MessageSquareHeart } from 'lucide-react';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { CannedMessagesSettingsTab } from '@/components/wabasimplify/canned-messages-settings-tab';
import { AgentsRolesSettingsTab } from '@/components/wabasimplify/agents-roles-settings-tab';
import { useRouter } from 'next/navigation';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';


const updateSettingsInitialState = { message: null, error: null };
const updateAutoReplyInitialState = { message: null, error: null };
const updateOptInOutInitialState = { message: null, error: null };
const saveUserAttributesInitialState = { message: null, error: null };


function SaveButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      {children}
    </Button>
  );
}

const timezones = [
    "UTC", "GMT", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
    "Europe/London", "Europe/Berlin", "Europe/Moscow", "Asia/Dubai", "Asia/Kolkata",
    "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney"
];

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];


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
                setIsChecked(prev => !prev); // Revert optimistic update
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
                        <Switch checked={isChecked} onCheckedChange={onCheckedChange} disabled={isSubmitting} />
                    </div>
                </div>
            </CardHeader>
        </Card>
    );
}

function WelcomeMessageForm({ project }: { project: WithId<Project> }) {
    const [state, formAction] = useActionState(handleUpdateAutoReplySettings, updateAutoReplyInitialState);
    const { toast } = useToast();
    const settings = project.autoReplySettings?.welcomeMessage;

    useEffect(() => {
        if (state?.message) toast({ title: 'Success!', description: state.message });
        if (state?.error) toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }, [state, toast]);

    return (
        <form action={formAction}>
            <input type="hidden" name="projectId" value={project._id.toString()} />
            <input type="hidden" name="replyType" value="welcomeMessage" />
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Welcome Message</CardTitle>
                        <CardDescription>Send a dedicated greeting the very first time a new contact messages you. This takes priority over all other replies for that first interaction.</CardDescription>
                    </div>
                    <Switch name="enabled" defaultChecked={settings?.enabled} />
                </div>
            </CardHeader>
            <CardContent>
                <Label htmlFor="welcome-message">Reply Message</Label>
                <Textarea id="welcome-message" name="message" className="min-h-32 mt-2"
                    placeholder="Welcome to our service! How can we help you today?"
                    defaultValue={settings?.message}
                    required />
            </CardContent>
            <CardFooter><SaveButton>Save Welcome Message</SaveButton></CardFooter>
        </form>
    );
}

function GeneralReplyForm({ project }: { project: WithId<Project> }) {
    const [state, formAction] = useActionState(handleUpdateAutoReplySettings, updateAutoReplyInitialState);
    const { toast } = useToast();
    
    const [replies, setReplies] = useState<GeneralReplyRule[]>(project.autoReplySettings?.general?.replies || []);

    useEffect(() => {
        if (state?.message) toast({ title: 'Success!', description: state.message });
        if (state?.error) toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }, [state, toast]);

    const handleUpdateReply = (id: string, field: 'keywords' | 'reply' | 'matchType', value: string) => {
        setReplies(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const handleAddReply = () => {
        setReplies(prev => [...prev, { id: `rule_${Date.now()}`, keywords: '', reply: '', matchType: 'contains' }]);
    };

    const handleRemoveReply = (id: string) => {
        setReplies(prev => prev.filter(r => r.id !== id));
    };
    
    return (
        <form action={formAction}>
            <input type="hidden" name="projectId" value={project._id.toString()} />
            <input type="hidden" name="replyType" value="general" />
            <input type="hidden" name="replies" value={JSON.stringify(replies)} />
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Keyword-based Replies</CardTitle>
                        <CardDescription>If no other reply is triggered, check the first message from a new contact for keywords and send a specific response.</CardDescription>
                    </div>
                    <Switch name="enabled" defaultChecked={project.autoReplySettings?.general?.enabled} />
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {replies.map((rule, index) => (
                    <div key={rule.id} className="space-y-3 p-4 border rounded-lg relative">
                        <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={() => handleRemoveReply(rule.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor={`keywords-${index}`}>If message contains keyword(s)</Label>
                                <Input id={`keywords-${index}`} value={rule.keywords} onChange={e => handleUpdateReply(rule.id, 'keywords', e.target.value)} placeholder="e.g. hello, pricing, help" />
                                <p className="text-xs text-muted-foreground">Comma-separated values.</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor={`matchType-${index}`}>Match Type</Label>
                                <Select value={rule.matchType} onValueChange={v => handleUpdateReply(rule.id, 'matchType', v)}>
                                    <SelectTrigger id={`matchType-${index}`}><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="contains">Contains any keyword</SelectItem>
                                        <SelectItem value="exact">Exact match</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`reply-${index}`}>Send this reply</Label>
                            <Textarea id={`reply-${index}`} value={rule.reply} onChange={e => handleUpdateReply(rule.id, 'reply', e.target.value)} placeholder="Enter the reply message..." />
                        </div>
                    </div>
                ))}
                 <Button type="button" variant="outline" className="w-full" onClick={handleAddReply}><Plus className="mr-2 h-4 w-4"/>Add Rule</Button>
            </CardContent>
            <CardFooter>
                <SaveButton>Save Keyword Replies</SaveButton>
            </CardFooter>
        </form>
    );
}

function InactiveHoursForm({ project }: { project: WithId<Project> }) {
    const [state, formAction] = useActionState(handleUpdateAutoReplySettings, updateAutoReplyInitialState);
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
                    <div className="space-y-2"><Label htmlFor="startTime">From</Label><Input id="startTime" name="startTime" type="time" defaultValue={settings?.startTime || '18:00'} /></div>
                    <div className="space-y-2"><Label htmlFor="endTime">To</Label><Input id="endTime" name="endTime" type="time" defaultValue={settings?.endTime || '09:00'} /></div>
                    <div className="space-y-2"><Label htmlFor="timezone">Timezone</Label><Select name="timezone" defaultValue={settings?.timezone || 'UTC'}><SelectTrigger id="timezone"><SelectValue /></SelectTrigger><SelectContent>{timezones.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}</SelectContent></Select></div>
                </div>
                 <div className="space-y-2"><Label>Repeat on</Label><div className="flex flex-wrap gap-4">{dayLabels.map((day, index) => (<div key={index} className="flex items-center gap-2"><Checkbox id={`day_${index}`} name={`day_${index}`} defaultChecked={settings?.days?.includes(index)} /><Label htmlFor={`day_${index}`} className="font-normal">{day}</Label></div>))}</div></div>
                <div className="space-y-2"><Label htmlFor="inactive-message">Away Message</Label><Textarea id="inactive-message" name="message" className="min-h-32" placeholder="Thanks for contacting us! We're currently closed, but we'll get back to you during our business hours (Mon-Fri, 9am-6pm)." defaultValue={settings?.message} required /></div>
            </CardContent>
            <CardFooter><SaveButton>Save Inactive Hours Reply</SaveButton></CardFooter>
        </form>
    );
}

function AiAssistantForm({ project }: { project: WithId<Project> }) {
    const [state, formAction] = useActionState(handleUpdateAutoReplySettings, updateAutoReplyInitialState);
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
                    <div><CardTitle>AI Assistant Reply</CardTitle><CardDescription>Let an AI handle initial queries with your business context.</CardDescription></div>
                    <Switch name="enabled" defaultChecked={settings?.enabled} />
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center justify-between rounded-lg border p-4 shadow-sm">
                    <div className="space-y-0.5"><Label htmlFor="auto-translate-switch" className="text-base">Enable Automatic Translation</Label><p className="text-sm text-muted-foreground">Automatically detect the user's language from their country code and reply in their native language.</p></div>
                    <Switch id="auto-translate-switch" name="autoTranslate" defaultChecked={settings?.autoTranslate} />
                </div>
                <div className="space-y-2"><Label htmlFor="ai-context">Business Context / Instructions</Label><Textarea id="ai-context" name="context" className="min-h-48 mt-2 font-mono text-xs" placeholder="e.g., You are an assistant for 'My Awesome Pizza'. We are open 11am-10pm. Our specialties are pepperoni and margherita pizza. Our address is 123 Main St." defaultValue={settings?.context} required /><p className="text-xs text-muted-foreground mt-2">Provide the AI with all the information it needs to answer customer questions accurately.</p></div>
            </CardContent>
            <CardFooter><SaveButton>Save AI Assistant</SaveButton></CardFooter>
        </form>
    );
}

function OptInOutForm({ project }: { project: WithId<Project> }) {
    const [state, formAction] = useActionState(handleUpdateOptInOutSettings, updateOptInOutInitialState);
    const { toast } = useToast();
    const optSettings = project.optInOutSettings;

    useEffect(() => {
        if (state?.message) toast({ title: 'Success!', description: state.message });
        if (state?.error) toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }, [state, toast]);
    
    return (
        <form action={formAction}>
            <input type="hidden" name="projectId" value={project._id.toString()} />
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Campaign Opt-out</CardTitle>
                        <CardDescription>Enable this if you don't wish to send API campaigns to opted-out contacts.</CardDescription>
                    </div>
                    <Switch name="enabled" defaultChecked={optSettings?.enabled} />
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-4">
                    <h3 className="font-medium text-lg">Opt-out Settings</h3>
                    <div className="space-y-2">
                        <Label htmlFor="optOutKeywords">Opt-out Keywords</Label>
                        <Input id="optOutKeywords" name="optOutKeywords" placeholder="stop, unsubscribe" defaultValue={optSettings?.optOutKeywords?.join(', ')} />
                        <p className="text-xs text-muted-foreground">Comma-separated keywords. If a user sends any of these, they will be opted out.</p>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="optOutResponse">Opt-out Response Message</Label>
                        <Textarea id="optOutResponse" name="optOutResponse" placeholder="You have been opted-out of our future communications." defaultValue={optSettings?.optOutResponse} />
                    </div>
                </div>
                <Separator/>
                <div className="space-y-4">
                    <h3 className="font-medium text-lg">Opt-in Settings</h3>
                    <div className="space-y-2">
                        <Label htmlFor="optInKeywords">Opt-in Keywords</Label>
                        <Input id="optInKeywords" name="optInKeywords" placeholder="start, allow, subscribe" defaultValue={optSettings?.optInKeywords?.join(', ')} />
                        <p className="text-xs text-muted-foreground">Comma-separated keywords for users to opt back in.</p>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="optInResponse">Opt-in Response Message</Label>
                        <Textarea id="optInResponse" name="optInResponse" placeholder="Thanks! You have been opted-in for our future communications." defaultValue={optSettings?.optInResponse} />
                    </div>
                </div>
            </CardContent>
            <CardFooter>
                <SaveButton>Save Opt-in/Opt-out Settings</SaveButton>
            </CardFooter>
        </form>
    )
}

function UserAttributesForm({ project, user }: { project: WithId<Project>, user: (Omit<User, 'password' | 'planId'> & { plan?: WithId<Plan> | null }) | null }) {
  const { toast } = useToast();
  const [state, formAction] = useActionState(handleSaveUserAttributes, saveUserAttributesInitialState);
  
  const [attributes, setAttributes] = useState<UserAttribute[]>(project.userAttributes || []);
  const [newAttrName, setNewAttrName] = useState('');
  const [newAttrAction, setNewAttrAction] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const { pending } = useFormStatus();

  const plan = user?.plan;
  const limit = plan?.attributeLimit ?? 0;
  const isAtLimit = attributes.length >= limit;
  const planName = plan?.name || 'Unknown';

  useEffect(() => {
    if (state?.message) toast({ title: 'Success!', description: state.message });
    if (state?.error) toast({ title: 'Error', description: state.error, variant: 'destructive' });
  }, [state, toast]);

  const handleAddAttribute = () => {
    if (!newAttrName.trim()) {
      toast({ title: 'Error', description: 'Attribute name cannot be empty.', variant: 'destructive' });
      return;
    }
    if (isAtLimit) {
      toast({ title: 'Limit Reached', description: `Your "${planName}" plan allows a maximum of ${limit} attributes. Please upgrade for more.`, variant: 'destructive' });
      return;
    }
    setAttributes(prev => [...prev, {
      id: `attr_${Date.now()}`,
      name: newAttrName.trim(),
      action: newAttrAction.trim(),
      status: 'ACTIVE',
    }]);
    setNewAttrName('');
    setNewAttrAction('');
  };

  const handleUpdateAttribute = (index: number, field: keyof UserAttribute, value: string | boolean) => {
    const newAttributes = [...attributes];
    const attributeToUpdate = { ...newAttributes[index] };

    if (field === 'status') {
      attributeToUpdate.status = value ? 'ACTIVE' : 'INACTIVE';
    } else if (field === 'name' || field === 'action') {
      attributeToUpdate[field] = value as string;
    }

    newAttributes[index] = attributeToUpdate;
    setAttributes(newAttributes);
  };
  
  const handleDeleteAttribute = (id: string) => {
    setAttributes(prev => prev.filter(attr => attr.id !== id));
  };

  const filteredAttributes = attributes.filter(attr => attr.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <form action={formAction}>
      <input type="hidden" name="projectId" value={project._id.toString()} />
      <input type="hidden" name="attributes" value={JSON.stringify(attributes)} />
      <Card>
        <CardHeader>
            <CardTitle>User Attributes</CardTitle>
            <CardDescription>Manage custom contact attributes for personalization and flows.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="p-4 bg-muted/50 rounded-lg space-y-2 text-sm text-muted-foreground">
                <h4 className="font-semibold text-card-foreground">Quick Guide</h4>
                 <p>Attributes hold contact-specific values, which you can assign on the contacts page.</p>
                <p>Your current <span className="font-semibold capitalize text-primary">{planName}</span> plan allows for <span className="font-semibold text-primary">{limit}</span> custom attributes. You have created <span className="font-semibold text-primary">{attributes.length}</span>.</p>
                {limit < 20 && (
                    <p className="font-semibold">
                        <Link href="/dashboard/billing" className="text-primary hover:underline">Upgrade your plan</Link> to unlock more attributes! 🚀
                    </p>
                )}
            </div>

            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by attribute name..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            
            {/* Mobile View */}
            <div className="space-y-2 md:hidden">
              {filteredAttributes.map((attr, index) => {
                  const originalIndex = attributes.findIndex(a => a.id === attr.id);
                  return (
                      <Card key={attr.id} className="p-4 space-y-4">
                          <div className="flex justify-between items-start">
                              <Input className="text-base font-semibold border-0 shadow-none -ml-3 p-0 h-auto" value={attr.name} onChange={(e) => handleUpdateAttribute(originalIndex, 'name', e.target.value)} placeholder="Attribute Name" />
                              <Button type="button" variant="ghost" size="icon" onClick={() => handleDeleteAttribute(attr.id)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                          </div>
                          <div className="space-y-2">
                              <Label>Action (optional)</Label>
                              <Input value={attr.action || ''} onChange={(e) => handleUpdateAttribute(originalIndex, 'action', e.target.value)} placeholder="Action Name"/>
                          </div>
                          <div className="flex items-center justify-between">
                              <Label>Status</Label>
                              <Switch checked={attr.status === 'ACTIVE'} onCheckedChange={(checked) => handleUpdateAttribute(originalIndex, 'status', checked)} />
                          </div>
                      </Card>
                  );
              })}
            </div>

            {/* Desktop View */}
            <div className="hidden md:block border rounded-md">
                <div className="grid grid-cols-[1fr,1fr,auto,auto] items-center p-2 border-b font-medium text-sm text-muted-foreground">
                    <div className="px-2">Name*</div>
                    <div className="px-2">Action (optional)</div>
                    <div className="px-2 text-center">Status</div>
                    <div className="px-2 w-10"></div>
                </div>
                 <div className="space-y-2 p-2">
                    {filteredAttributes.map((attr, index) => {
                        const originalIndex = attributes.findIndex(a => a.id === attr.id);
                        return (
                            <div key={attr.id} className="grid grid-cols-[1fr,1fr,auto,auto] items-center gap-2">
                                <Input value={attr.name} onChange={(e) => handleUpdateAttribute(originalIndex, 'name', e.target.value)} placeholder="Attribute Name" />
                                <Input value={attr.action || ''} onChange={(e) => handleUpdateAttribute(originalIndex, 'action', e.target.value)} placeholder="Action Name"/>
                                <Switch className="mx-auto" checked={attr.status === 'ACTIVE'} onCheckedChange={(checked) => handleUpdateAttribute(originalIndex, 'status', checked)} />
                                <Button type="button" variant="ghost" size="icon" onClick={() => handleDeleteAttribute(attr.id)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="space-y-2">
                <h4 className="font-semibold text-sm">Add user attribute manually</h4>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr,1fr,auto] items-center gap-2 p-2 border rounded-md border-dashed">
                    <Input placeholder="Enter attribute name" value={newAttrName} onChange={e => setNewAttrName(e.target.value)} />
                    <Input placeholder="Enter action name" value={newAttrAction} onChange={e => setNewAttrAction(e.target.value)} />
                    <Button type="button" onClick={handleAddAttribute} disabled={isAtLimit}><Plus className="mr-2 h-4 w-4"/>Add</Button>
                </div>
            </div>
        </CardContent>
        <CardFooter className="border-t pt-6">
            <Button type="submit" disabled={pending}>
                {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Attributes
            </Button>
        </CardFooter>
      </Card>
    </form>
  );
}


function SettingsPageContent() {
  const [project, setProject] = useState<WithId<Project> | null>(null);
  const [user, setUser] = useState<(Omit<User, 'password' | 'planId'> & { plan?: WithId<Plan> | null }) | null>(null);
  const [isLoading, startLoadingTransition] = useTransition();
  const [isClient, setIsClient] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string|null>(null);
  const [messagesPerSecond, setMessagesPerSecond] = useState(1000);
  const { toast } = useToast();
  const [state, formAction] = useActionState(handleUpdateProjectSettings, updateSettingsInitialState);
  const router = useRouter();

  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'broadcast';

  useEffect(() => {
    setIsClient(true);
    const storedProjectId = localStorage.getItem('activeProjectId');
    setActiveProjectId(storedProjectId);
  }, []);

  useEffect(() => {
    if (isClient && activeProjectId) {
        document.title = 'Project Settings | Wachat';
        startLoadingTransition(async () => {
            const [projectData, sessionData] = await Promise.all([
                getProjectById(activeProjectId),
                getSession()
            ]);
            if (projectData) {
                setProject(projectData);
                setMessagesPerSecond(projectData.messagesPerSecond || 1000);
            }
            if (sessionData?.user) {
                setUser(sessionData.user);
            }
        });
    } else if (isClient && !activeProjectId) {
        startLoadingTransition(async () => {
             const projects = await getProjects();
                 if (projects && projects.length > 0) {
                router.push('/dashboard');
            } else {
                router.push('/dashboard/setup');
            }
        });
    }
  }, [isClient, activeProjectId, router]);

  useEffect(() => {
    if (state?.message) {
      toast({
        title: 'Success!',
        description: state.message,
      });
    }
    if (state?.error) {
      toast({
        title: 'Error updating settings',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, toast]);
  
  if (isLoading || !project || !user) {
    return (
      <div className="flex flex-col gap-8">
        <div>
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-4 w-2/3 mt-2" />
        </div>
        <Card>
          <CardHeader><Skeleton className="h-6 w-1/4" /><Skeleton className="h-4 w-1/2" /></CardHeader>
          <CardContent><Skeleton className="h-48 w-full" /></CardContent>
        </Card>
      </div>
    );
  }

  return (
     <div className="flex flex-col gap-8">
      <div><h1 className="text-3xl font-bold font-headline">Project Settings</h1><p className="text-muted-foreground">Manage settings for project "{project.name}".</p></div>

      <Tabs defaultValue={initialTab} className="w-full">
        <ScrollArea className="w-full whitespace-nowrap rounded-md border-b">
            <TabsList className="inline-flex h-auto p-1 bg-transparent w-max">
              <TabsTrigger value="broadcast"><Save className="mr-2 h-4 w-4" />Broadcast</TabsTrigger>
              <TabsTrigger value="auto-reply"><Bot className="mr-2 h-4 w-4" />Auto-Replies</TabsTrigger>
              <TabsTrigger value="canned-messages"><ClipboardList className="mr-2 h-4 w-4" />Canned Messages</TabsTrigger>
              <TabsTrigger value="agents-roles"><UserCog className="mr-2 h-4 w-4" />Agents & Roles</TabsTrigger>
              <TabsTrigger value="compliance"><ShieldCheck className="mr-2 h-4 w-4" />Compliance</TabsTrigger>
              <TabsTrigger value="attributes"><Users className="mr-2 h-4 w-4" />User Attributes</TabsTrigger>
            </TabsList>
            <ScrollBar orientation="horizontal" />
        </ScrollArea>

          <TabsContent value="broadcast" className="mt-6">
            <form action={formAction}>
              <input type="hidden" name="projectId" value={project._id.toString()} />
              <Card>
                <CardHeader>
                    <CardTitle>Broadcast Settings</CardTitle>
                    <CardDescription>Configure the rate at which broadcast messages are sent.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-w-sm">
                    <Label htmlFor="messagesPerSecond">Concurrency Level (Messages in Parallel)</Label>
                    <Input id="messagesPerSecond" name="messagesPerSecond" type="number" min="1" step="1" value={messagesPerSecond} onChange={(e) => setMessagesPerSecond(Number(e.target.value))} required />
                    <p className="text-xs text-muted-foreground">The number of messages to send in parallel. Higher values increase throughput but are limited by API response times.</p>
                  </div>
                </CardContent>
                <CardFooter className="border-t px-6 py-4"><SaveButton>Save Broadcast Settings</SaveButton></CardFooter>
              </Card>
            </form>
          </TabsContent>

          <TabsContent value="auto-reply" className="mt-6 space-y-6">
            <MasterSwitch project={project} />
            <Tabs defaultValue="welcome" className="w-full">
                <ScrollArea className="w-full whitespace-nowrap rounded-md border-b">
                  <TabsList className="inline-flex h-auto p-1 bg-transparent w-max">
                      <TabsTrigger value="welcome"><Handshake className="mr-2 h-4 w-4" />Welcome</TabsTrigger>
                      <TabsTrigger value="general"><MessageSquareHeart className="mr-2 h-4 w-4" />Keyword Replies</TabsTrigger>
                      <TabsTrigger value="inactive"><Clock className="mr-2 h-4 w-4" />Inactive Hours</TabsTrigger>
                      <TabsTrigger value="ai"><BrainCircuit className="mr-2 h-4 w-4" />AI Assistant</TabsTrigger>
                  </TabsList>
                  <ScrollBar orientation="horizontal" />
              </ScrollArea>
              <TabsContent value="welcome" className="mt-4"><Card><WelcomeMessageForm project={project} /></Card></TabsContent>
              <TabsContent value="general" className="mt-4"><Card><GeneralReplyForm project={project} /></Card></TabsContent>
              <TabsContent value="inactive" className="mt-4"><Card><InactiveHoursForm project={project} /></Card></TabsContent>
              <TabsContent value="ai" className="mt-4"><Card><AiAssistantForm project={project} /></Card></TabsContent>
            </Tabs>
          </TabsContent>
          
          <TabsContent value="canned-messages" className="mt-6">
            <CannedMessagesSettingsTab project={project} />
          </TabsContent>

          <TabsContent value="agents-roles" className="mt-6">
            <AgentsRolesSettingsTab project={project} user={user} />
          </TabsContent>

          <TabsContent value="compliance" className="mt-6">
              <Card><OptInOutForm project={project} /></Card>
          </TabsContent>

          <TabsContent value="attributes" className="mt-6">
            <UserAttributesForm project={project} user={user} />
          </TabsContent>

        </Tabs>
    </div>
  )
}

export default function SettingsPage() {
    return (
        // Suspense is needed because we read the searchParams in the child component
        <Suspense fallback={<Skeleton className="h-full w-full"/>}>
            <SettingsPageContent />
        </Suspense>
    );
}
