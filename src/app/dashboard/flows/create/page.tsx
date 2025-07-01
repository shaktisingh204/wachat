
'use client';

import { Suspense, useActionState, useEffect, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, LoaderCircle, Save, FileJson, Info, Plus, Trash2, GripVertical, Checkbox, View, Edit, Copy, ServerCog, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { saveMetaFlow, getMetaFlowById } from '@/app/actions/meta-flow.actions';
import { handleGenerateMetaFlow } from '@/app/actions';
import { flowCategories, uiComponents, type UIComponent } from '@/components/wabasimplify/meta-flow-templates';
import { MetaFlowPreview } from '@/components/wabasimplify/meta-flow-preview';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectValue, SelectTrigger, SelectContent, SelectItem } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import type { WithId } from 'mongodb';
import type { MetaFlow } from '@/lib/definitions';

const createFlowInitialState = { message: null, error: null };

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    const buttonText = isEditing ? 'Update Flow' : 'Save & Publish Flow';
    const Icon = isEditing ? Save : FileJson;
    return (
        <Button type="submit" disabled={pending} size="lg">
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Icon className="mr-2 h-4 w-4" />}
            {buttonText}
        </Button>
    );
}

function ComponentEditor({ component, onUpdate, onAddOption, onUpdateOption, onRemoveOption }: { component: UIComponent & { id: string }, onUpdate: (key: string, value: any) => void, onAddOption: () => void, onUpdateOption: (index: number, value: string) => void, onRemoveOption: (index: number) => void }) {
    
    switch (component.type) {
        case 'TextInput':
        case 'NumberInput':
        case 'UrlInput':
        case 'TimePicker':
        case 'PhotoPicker':
        case 'DocumentPicker':
        case 'Calendar':
        case 'ContactPicker':
             return (
                <div className="space-y-2">
                    <Label htmlFor={`${component.id}_label`}>Label</Label>
                    <Input id={`${component.id}_label`} value={component.label || ''} onChange={e => onUpdate('label', e.target.value)} placeholder="e.g., Your Full Name" />
                </div>
            );
        case 'Button':
            return (
                 <div className="space-y-2">
                    <Label htmlFor={`${component.id}_label`}>Button Label</Label>
                    <Input id={`${component.id}_label`} value={component.label || ''} onChange={e => onUpdate('label', e.target.value)} placeholder="e.g., Next" />
                </div>
            )
        case 'ChipsSelector':
        case 'RadioSelector':
        case 'ListSelector':
             return (
                <div className="space-y-2">
                    <Label htmlFor={`${component.id}_label`}>Label</Label>
                    <Input id={`${component.id}_label`} value={component.label || ''} onChange={e => onUpdate('label', e.target.value)} placeholder="e.g., Select your interest" />
                    <Label>Options</Label>
                    <div className="space-y-2">
                        {(component['options'] || []).map((opt, index) => (
                            <div key={opt.id} className="flex items-center gap-2">
                                <Input value={opt.label} onChange={e => onUpdateOption(index, e.target.value)} />
                                <Button type="button" variant="ghost" size="icon" onClick={() => onRemoveOption(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                            </div>
                        ))}
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={onAddOption}>+ Add Option</Button>
                </div>
            );
        default:
            return <p className="text-xs text-muted-foreground">This component has no editable properties.</p>;
    }
}


function PageSkeleton() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-10 w-48"/>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <Skeleton className="h-48 w-full"/>
                    <Skeleton className="h-96 w-full"/>
                </div>
                <Skeleton className="h-full w-full min-h-[720px] hidden lg:block"/>
            </div>
        </div>
    );
}

function CreateMetaFlowPage() {
    const searchParams = useSearchParams();
    const flowId = searchParams.get('flowId');
    const isEditing = !!flowId;
    
    const [projectId, setProjectId] = useState<string | null>(null);
    const [state, formAction] = useActionState(saveMetaFlow, createFlowInitialState);
    const { toast } = useToast();
    const router = useRouter();

    const [isLoading, setIsLoading] = useState(true);
    const [existingFlow, setExistingFlow] = useState<WithId<MetaFlow> | null>(null);
    
    // New state structure
    const [flowName, setFlowName] = useState('');
    const [flowDescription, setFlowDescription] = useState('');
    const [screens, setScreens] = useState<any[]>([]);
    
    const [endpointUri, setEndpointUri] = useState('');
    const [category, setCategory] = useState('OTHER');
    const [flowJson, setFlowJson] = useState('');
    const [aiPrompt, setAiPrompt] = useState('');
    const [isGenerating, startGeneratingTransition] = useTransition();
    const [shouldPublish, setShouldPublish] = useState(true);

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
        if (flowId) {
            setIsLoading(true);
            getMetaFlowById(flowId).then(data => {
                if (data) {
                    setExistingFlow(data);
                    const flowContent = data.flow_data?.flow;
                    setFlowName(flowContent?.name || data.name);
                    setFlowDescription(flowContent?.description || '');
                    setScreens(flowContent?.screens || []);
                    setCategory(data.categories[0] || 'OTHER');
                    setEndpointUri((data as any).endpointUri || '');
                    setShouldPublish(data.status === 'PUBLISHED');
                }
                setIsLoading(false);
            });
        } else {
            setFlowName('new_flow_' + Math.floor(Math.random() * 1000));
            setScreens([{ id: 'screen_1', title: { text: 'Welcome Screen' }, body: { text: "Welcome!" }, components: [{ type: 'Button', id: 'btn_next_1', label: 'Start', action: { type: 'submit' } }] }]);
            setIsLoading(false);
            setShouldPublish(true); // Default to publish for new flows
        }
    }, [flowId]);
    
    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Success', description: state.message });
            router.push('/dashboard/flows');
        }
        if (state?.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router]);

    const handleGenerateByAi = () => {
        if (!aiPrompt) {
            toast({ title: "Error", description: "Please enter a description for the AI.", variant: "destructive" });
            return;
        }
        startGeneratingTransition(async () => {
            const result = await handleGenerateMetaFlow({ prompt: aiPrompt, category });
            if (result.error) {
                toast({ title: "AI Generation Failed", description: result.error, variant: "destructive" });
            } else if (result.flow) {
                try {
                    setFlowName(result.flow.name);
                    setFlowDescription(result.flow.description || '');
                    setScreens(result.flow.screens);
                    toast({ title: "Flow Generated!", description: "The AI has created your flow. Review and save it." });
                } catch (e) {
                    toast({ title: "JSON Parse Error", description: "The AI returned invalid JSON. Please try again.", variant: "destructive" });
                }
            }
        });
    };

    const addScreen = () => setScreens(prev => [...prev, { id: `screen_${Date.now()}`, title: { text: `Screen ${prev.length + 1}` }, components: [{ type: 'Button', id: `btn_${Date.now()}`, label: 'Continue', action: { type: 'submit' } }] }]);
    const removeScreen = (screenId: string) => {
        if (screens.length <= 1) {
            toast({ title: "Cannot Delete", description: "A flow must have at least one screen.", variant: "destructive" });
            return;
        }
        setScreens(prev => prev.filter(s => s.id !== screenId));
    };

    const updateScreenField = (screenId: string, field: 'title' | 'body', value: string) => {
        setScreens(prev => prev.map(s => s.id === screenId ? { ...s, [field]: { ...s[field], text: value } } : s));
    };
    
    const updateScreenAction = (screenId: string, buttonId: string, targetScreenId: string) => {
        setScreens(prev => prev.map(s => {
            if (s.id === screenId) {
                const newComponents = s.components.map((c: any) => {
                    if (c.id === buttonId) {
                        return { ...c, action: targetScreenId === 'SUBMIT' ? { type: 'submit' } : { type: 'navigate', target: targetScreenId } };
                    }
                    return c;
                });
                return { ...s, components: newComponents };
            }
            return s;
        }))
    };
    
    const addComponentToScreen = (screenId: string, componentType: string) => {
        setScreens(prev => prev.map((s) => {
            if (s.id === screenId) {
                const newComponent: any = { type: componentType, id: `comp_${Date.now()}`, label: `New ${componentType}` };
                 if (['ChipsSelector', 'RadioSelector', 'ListSelector'].includes(componentType)) {
                    newComponent.options = [];
                }
                // Insert before the last button
                const buttonIndex = s.components.findLastIndex((c: any) => c.type === 'Button');
                const newComponents = [...s.components];
                newComponents.splice(buttonIndex, 0, newComponent);
                return { ...s, components: newComponents };
            }
            return s;
        }));
    };

    const updateComponentInScreen = (screenId: string, componentId: string, key: string, value: any) => {
        setScreens(prev => prev.map(s => {
            if (s.id === screenId) {
                const newComponents = s.components.map((c: any) => c.id === componentId ? { ...c, [key]: value } : c);
                return { ...s, components: newComponents };
            }
            return s;
        }));
    };
    
    const removeComponentFromScreen = (screenId: string, componentId: string) => {
        setScreens(prev => prev.map((s, i) => {
            if (s.id === screenId) {
                const newComponents = s.components.filter((c: any) => c.id !== componentId);
                return { ...s, components: newComponents };
            }
            return s;
        }));
    };

    const handleAddComponentOption = (screenId: string, componentId: string) => {
        setScreens(prev => prev.map(s => {
            if (s.id === screenId) {
                const newComponents = s.components.map((c: any) => {
                    if (c.id === componentId) {
                        const newOptions = [...(c.options || []), { id: `opt_${Date.now()}`, label: '' }];
                        return { ...c, options: newOptions };
                    }
                    return c;
                });
                return { ...s, components: newComponents };
            }
            return s;
        }));
    };

    const handleUpdateComponentOption = (screenId: string, componentId: string, optionIndex: number, value: string) => {
         setScreens(prev => prev.map(s => {
            if (s.id === screenId) {
                const newComponents = s.components.map((c: any) => {
                    if (c.id === componentId) {
                        const newOptions = c.options.map((opt, k) => k === optionIndex ? { ...opt, label: value } : opt);
                        return { ...c, options: newOptions };
                    }
                    return c;
                });
                return { ...s, components: newComponents };
            }
            return s;
        }));
    };

    const handleRemoveComponentOption = (screenId: string, componentId: string, optionIndex: number) => {
        setScreens(prev => prev.map(s => {
            if (s.id === screenId) {
                const newComponents = s.components.map((c: any) => {
                    if (c.id === componentId) {
                        const newOptions = c.options.filter((_: any, k: number) => k !== optionIndex);
                        return { ...c, options: newOptions };
                    }
                    return c;
                });
                return { ...s, components: newComponents };
            }
            return s;
        }));
    };

     useEffect(() => {
        const generatedJson = {
            version: "7.1",
            flow: {
                name: flowName,
                description: flowDescription,
                screens: screens,
                metadata: { language: 'en_US' }
            }
        };
        setFlowJson(JSON.stringify(generatedJson, null, 2));
    }, [flowName, flowDescription, screens]);
    
    if (isLoading) {
        return <PageSkeleton />;
    }

    return (
        <form action={formAction} className="space-y-6">
            <input type="hidden" name="projectId" value={projectId || ''}/>
            <input type="hidden" name="flowId" value={flowId || ''}/>
            <input type="hidden" name="metaId" value={existingFlow?.metaId || ''}/>
            <input type="hidden" name="category" value={category} />
            <input type="hidden" name="name" value={flowName} />
            <input type="hidden" name="flow_data" value={flowJson} />
            <input type="hidden" name="endpoint_uri" value={endpointUri} />
            <input type="hidden" name="currentStatus" value={existingFlow?.status || 'DRAFT'}/>

            <div>
                <Button variant="ghost" asChild className="mb-4 -ml-4">
                  <Link href="/dashboard/flows"><ChevronLeft className="mr-2 h-4 w-4" />Back to Meta Flows</Link>
                </Button>
                <h1 className="text-3xl font-bold font-headline">{isEditing ? 'Edit Meta Flow' : 'Create New Meta Flow'}</h1>
                <p className="text-muted-foreground mt-2">{isEditing ? `Editing flow: ${existingFlow?.name}` : 'Build interactive forms and experiences for your customers.'}</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <ScrollArea className="h-[80vh] pr-4">
                    <div className="space-y-6">
                        <Card>
                            <CardHeader><CardTitle>1. General Details</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                 <div className="space-y-2">
                                    <Label htmlFor="flowNameInput">Flow Name</Label>
                                    <Input id="flowNameInput" value={flowName} onChange={e => setFlowName(e.target.value)} placeholder="e.g., lead_capture_flow" required/>
                                    <p className="text-xs text-muted-foreground">Lowercase letters and underscores only.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Category</Label>
                                    <RadioGroup value={category} onValueChange={setCategory}>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {flowCategories.map(c => (
                                        <div key={c.id}>
                                            <RadioGroupItem value={c.id} id={c.id} className="sr-only" />
                                            <Label htmlFor={c.id} className={`flex text-xs items-center justify-center rounded-md border-2 p-2 hover:bg-accent hover:text-accent-foreground cursor-pointer ${category === c.id ? 'border-primary' : 'border-muted'}`}>{c.name}</Label>
                                        </div>
                                    ))}
                                    </div>
                                    </RadioGroup>
                                </div>
                                <div className="space-y-2">
                                    <Label>Endpoint URI (Optional)</Label>
                                    <Input id="endpoint_uri_visible" value={endpointUri} onChange={e => setEndpointUri(e.target.value)} placeholder="https://your-server.com/api/flow"/>
                                </div>
                                 <div className="flex items-center space-x-2 pt-2">
                                    <Switch id="publish" name="publish" checked={shouldPublish} onCheckedChange={setShouldPublish} />
                                    <Label htmlFor="publish">Publish this flow</Label>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-primary/5 border-primary/20">
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <Wand2 className="h-5 w-5 text-primary"/>
                                    <CardTitle>AI Assistant</CardTitle>
                                </div>
                                <CardDescription>Describe the flow you want to create, and the AI will generate it for you.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="ai-prompt">What should this flow do?</Label>
                                    <Textarea id="ai-prompt" value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="e.g., A flow to capture leads for a real estate agency. Ask for name, email, and property type they are interested in."/>
                                </div>
                                <Button type="button" onClick={handleGenerateByAi} disabled={isGenerating}>
                                    {isGenerating ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : <Wand2 className="mr-2 h-4 w-4" />}
                                    Generate with AI
                                </Button>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader><CardTitle>2. Build Your Screens</CardTitle></CardHeader>
                            <CardContent>
                                <Accordion type="multiple" className="w-full space-y-4" defaultValue={['item-0']}>
                                    {screens.map((screen, screenIndex) => (
                                        <AccordionItem value={`item-${screenIndex}`} key={screen.id} className="border rounded-md px-4">
                                            <AccordionTrigger className="hover:no-underline">
                                                 <div className="flex-1 flex items-center gap-2">
                                                    <GripVertical className="h-5 w-5 text-muted-foreground" />
                                                    <Input className="text-base font-semibold border-0 shadow-none focus-visible:ring-0 p-0 h-auto" value={screen.title?.text || ''} onChange={e => updateScreenField(screen.id, 'title', e.target.value)} onClick={e => e.stopPropagation()}/>
                                                </div>
                                                <Button type="button" variant="ghost" size="icon" onClick={() => removeScreen(screen.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                            </AccordionTrigger>
                                            <AccordionContent className="pt-4 space-y-4">
                                                <div className="space-y-2">
                                                  <Label>Screen Body Text (Optional)</Label>
                                                  <Textarea value={screen.body?.text || ''} onChange={e => updateScreenField(screen.id, 'body', e.target.value)} placeholder="Enter body text..."/>
                                                </div>
                                                <Separator />
                                                <h4 className="font-semibold text-sm">Components</h4>
                                                {screen.components?.map((component: any, compIndex: number) => (
                                                    <div key={component.id || compIndex} className="p-3 border rounded-lg space-y-2 relative bg-background">
                                                        <div className="flex justify-between items-center">
                                                            <p className="text-sm font-medium text-muted-foreground">{component.type}</p>
                                                            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeComponentFromScreen(screen.id, component.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                                                        </div>
                                                        <ComponentEditor 
                                                            component={component} 
                                                            onUpdate={(key, value) => updateComponentInScreen(screen.id, component.id, key, value)}
                                                            onAddOption={() => handleAddComponentOption(screen.id, component.id)}
                                                            onUpdateOption={(optionIndex, value) => handleUpdateComponentOption(screen.id, component.id, optionIndex, value)}
                                                            onRemoveOption={(optionIndex) => handleRemoveComponentOption(screen.id, component.id, optionIndex)}
                                                        />
                                                        {component.type === 'Button' && (
                                                            <div className="space-y-2 pt-2 border-t mt-2">
                                                                <Label>Button Action</Label>
                                                                <Select value={component.action?.target || 'SUBMIT'} onValueChange={value => updateScreenAction(screen.id, component.id, value)}>
                                                                    <SelectTrigger><SelectValue placeholder="Select next step..." /></SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="SUBMIT">End & Submit Flow</SelectItem>
                                                                        {screens.filter(s => s.id !== screen.id).map(s => <SelectItem key={s.id} value={s.id}>Go to: {s.title.text}</SelectItem>)}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                                <Popover>
                                                    <PopoverTrigger asChild><Button type="button" variant="outline" className="w-full"><Plus className="mr-2 h-4 w-4" /> Add Component</Button></PopoverTrigger>
                                                    <PopoverContent className="w-56 p-1">
                                                        {uiComponents.map(c => <div key={c.type} className="p-2 text-sm rounded-md hover:bg-accent cursor-pointer" onClick={() => addComponentToScreen(screen.id, c.type)}>{c.label}</div>)}
                                                    </PopoverContent>
                                                </Popover>
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                                <Button type="button" variant="outline" className="w-full mt-4" onClick={addScreen}><Plus className="mr-2 h-4 w-4"/>Add New Screen</Button>
                            </CardContent>
                        </Card>
                    </div>
                </ScrollArea>
                
                <div className="lg:sticky top-6">
                    <MetaFlowPreview flowJson={flowJson} />
                </div>
            </div>

            <Accordion type="single" collapsible>
                <AccordionItem value="json-preview">
                    <AccordionTrigger><div className="flex items-center gap-2"><FileJson className="h-4 w-4"/> View Generated JSON</div></AccordionTrigger>
                    <AccordionContent><pre className="p-4 bg-muted/50 rounded-md text-xs font-mono max-h-96 overflow-y-auto">{flowJson}</pre></AccordionContent>
                </AccordionItem>
            </Accordion>

            <div className="flex justify-end"><SubmitButton isEditing={isEditing} /></div>
        </form>
    );
}


export default function CreateMetaFlowPageWrapper() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CreateMetaFlowPage />
    </Suspense>
  )
}
