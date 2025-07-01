
'use client';

import { Suspense, useActionState, useEffect, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, LoaderCircle, Save, FileJson, Plus, Trash2, Wand2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { saveMetaFlow, getMetaFlowById } from '@/app/actions/meta-flow.actions';
import { handleGenerateMetaFlow } from '@/app/actions';
import { flowCategories, declarativeFlowComponents, type DeclarativeUIComponent } from '@/components/wabasimplify/meta-flow-templates';
import { MetaFlowPreview } from '@/components/wabasimplify/meta-flow-preview';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import type { WithId } from 'mongodb';
import type { MetaFlow } from '@/lib/definitions';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const createFlowInitialState = { message: null, error: null };

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    const buttonText = isEditing ? 'Update Flow' : 'Save & Publish Flow';
    return (
        <Button type="submit" disabled={pending} size="lg">
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {buttonText}
        </Button>
    );
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

function ComponentEditorDialog({ component, onSave, onCancel, isOpen, onOpenChange }: { component: any, onSave: (newComponent: any) => void, onCancel: () => void, isOpen: boolean, onOpenChange: (open: boolean) => void }) {
    const [localComponent, setLocalComponent] = useState(component);

    useEffect(() => {
        setLocalComponent(component);
    }, [component]);
    
    const updateField = (key: string, value: any) => {
        setLocalComponent((prev: any) => ({...prev, [key]: value}));
    };

    if (!component) return null;

    return (
         <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Edit Component: {component.type}</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto">
                    {Object.keys(component).map(key => {
                        const value = localComponent[key];
                        return (
                            <div key={key} className="space-y-2">
                                <Label htmlFor={key}>{key}</Label>
                                {typeof value === 'boolean' ? (
                                    <Switch id={key} checked={value} onCheckedChange={(val) => updateField(key, val)} />
                                ) : typeof value === 'object' && value !== null ? (
                                    <Textarea id={key} value={JSON.stringify(value, null, 2)} onChange={e => { try { updateField(key, JSON.parse(e.target.value)) } catch(err) { /* ignore parse error */}}} className="font-mono text-xs h-32"/>
                                ) : (
                                    <Input id={key} value={value ?? ''} onChange={e => updateField(key, e.target.value)} />
                                )}
                            </div>
                        )
                    })}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onCancel}>Cancel</Button>
                    <Button onClick={() => onSave(localComponent)}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
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
    const [flowData, setFlowData] = useState<any>({ name: '', screens: [], description: '' });
    
    const [category, setCategory] = useState('OTHER');
    const [flowJson, setFlowJson] = useState('');
    const [aiPrompt, setAiPrompt] = useState('');
    const [isGenerating, startGeneratingTransition] = useTransition();
    const [shouldPublish, setShouldPublish] = useState(true);
    
    const [editingComponent, setEditingComponent] = useState<{ screenIndex: number, componentIndex: number, component: any } | null>(null);

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
        if (flowId) {
            setIsLoading(true);
            getMetaFlowById(flowId).then(data => {
                if (data) {
                    setExistingFlow(data);
                    const flowContent = data.flow_data || {};
                    setFlowData(flowContent);
                    setCategory(data.categories[0] || 'OTHER');
                    setShouldPublish(data.status === 'PUBLISHED');
                }
                setIsLoading(false);
            });
        } else {
            setFlowData({
                name: 'new_flow_' + Math.floor(Math.random() * 1000),
                description: '',
                routing_model: {},
                screens: [{
                    id: 'screen_1',
                    title: 'Welcome Screen',
                    layout: {
                        type: 'SingleColumnLayout',
                        children: [{
                            type: 'Form',
                            name: 'form_1',
                            children: [{ type: 'TextBody', text: 'This is the start of your flow.' }, { type: 'Footer', label: 'Finish', 'on-click-action': { name: 'complete' } }]
                        }]
                    },
                    terminal: true,
                    success: true,
                }],
            });
            setIsLoading(false);
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
            const result = await handleGenerateMetaFlow(aiPrompt, category);
            if (result.error) {
                toast({ title: "AI Generation Failed", description: result.error, variant: "destructive" });
            } else if (result.flowJson) {
                try {
                    const parsedFlow = JSON.parse(result.flowJson);
                    setFlowData(parsedFlow);
                    toast({ title: "Flow Generated!", description: "The AI has created your flow. Review and save it." });
                } catch (e) {
                     toast({ title: "AI Generation Error", description: "The AI returned invalid JSON. Please try again.", variant: "destructive" });
                }
            }
        });
    };

    const updateFlowField = (field: 'name' | 'description' | 'routing_model', value: any) => {
        setFlowData(prev => ({ ...prev, [field]: value }));
    };

    const updateScreenField = (screenIndex: number, field: string, value: any) => {
        setFlowData(prev => {
            const newScreens = JSON.parse(JSON.stringify(prev.screens));
            newScreens[screenIndex][field] = value;
            return { ...prev, screens: newScreens };
        });
    };
    
    const addComponentToScreen = (screenIndex: number, componentType: DeclarativeUIComponent['type']) => {
        const newComponent: any = { type: componentType };
        // Basic default properties for new components
        if (componentType === 'TextSubheading' || componentType === 'TextBody' || componentType === 'TextCaption') {
            newComponent.text = `New ${componentType}`;
        } else {
             newComponent.name = `${componentType.toLowerCase()}_${Date.now()}`;
            if (['TextInput', 'TextArea', 'DatePicker', 'Dropdown', 'RadioButtonsGroup', 'PhotoPicker', 'DocumentPicker'].includes(componentType)) {
                newComponent.label = `New ${componentType}`;
            }
        }
        if (['Dropdown', 'RadioButtonsGroup', 'CheckboxGroup'].includes(componentType)) {
            newComponent['data-source'] = [{ id: `opt_${Date.now()}`, title: 'Option 1' }];
        }
        if (componentType === 'Footer') {
            newComponent.label = 'Submit';
            newComponent['on-click-action'] = { name: 'complete' };
        }

        setFlowData(prev => {
            const newScreens = JSON.parse(JSON.stringify(prev.screens));
            const screenToUpdate = newScreens[screenIndex];
            if (screenToUpdate.layout.children[0]?.type === 'Form') {
                screenToUpdate.layout.children[0].children.push(newComponent);
            } else {
                 screenToUpdate.layout.children.push(newComponent);
            }
            return { ...prev, screens: newScreens };
        });
    };
    
    const removeComponentFromScreen = (screenIndex: number, componentIndex: number) => {
        setFlowData(prev => {
            const newScreens = JSON.parse(JSON.stringify(prev.screens));
            const screenToUpdate = newScreens[screenIndex];
            const formOrLayout = screenToUpdate.layout.children[0];
            if (formOrLayout?.type === 'Form') {
                formOrLayout.children.splice(componentIndex, 1);
            } else {
                 screenToUpdate.layout.children.splice(componentIndex, 1);
            }
            return { ...prev, screens: newScreens };
        });
    };
    
    const addNewScreen = () => {
        const newScreenId = `screen_${Date.now()}`;
        const newScreen = {
            id: newScreenId,
            title: `New Screen ${flowData.screens.length + 1}`,
            layout: {
                type: 'SingleColumnLayout',
                children: [{
                    type: 'Form', name: `form_${newScreenId}`,
                    children: [{ type: 'Footer', label: 'Submit', 'on-click-action': { name: 'complete' } }]
                }]
            },
            terminal: true,
            success: true,
        };
        setFlowData(prev => ({ ...prev, screens: [...prev.screens, newScreen] }));
    };

    const removeScreen = (screenIndex: number) => {
        setFlowData(prev => ({
            ...prev,
            screens: prev.screens.filter((_: any, i: number) => i !== screenIndex)
        }));
    };
    
    const handleComponentUpdate = (updatedComponent: any) => {
        if (!editingComponent) return;
        setFlowData(prev => {
            const newScreens = JSON.parse(JSON.stringify(prev.screens));
            const formOrLayout = newScreens[editingComponent.screenIndex].layout.children[0];
            if (formOrLayout.type === 'Form') {
                formOrLayout.children[editingComponent.componentIndex] = updatedComponent;
            } else {
                newScreens[editingComponent.screenIndex].layout.children[editingComponent.componentIndex] = updatedComponent;
            }
            return { ...prev, screens: newScreens };
        });
        setEditingComponent(null);
    }
    
    useEffect(() => {
        const newJson = JSON.stringify(flowData, null, 2);
        if (newJson !== flowJson) {
            setFlowJson(newJson);
        }
    }, [flowData, flowJson]);
    
    if (isLoading) return <PageSkeleton />;

    return (
        <form action={formAction} className="space-y-6">
            <input type="hidden" name="projectId" value={projectId || ''}/>
            <input type="hidden" name="flowId" value={flowId || ''}/>
            <input type="hidden" name="metaId" value={existingFlow?.metaId || ''}/>
            <input type="hidden" name="category" value={category} />
            <input type="hidden" name="name" value={flowData?.name} />
            <input type="hidden" name="flow_data" value={flowJson} />

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
                                    <Input id="flowNameInput" value={flowData.name || ''} onChange={e => updateFlowField('name', e.target.value)} placeholder="e.g., lead_capture_flow" required/>
                                    <p className="text-xs text-muted-foreground">Lowercase letters and underscores only.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Category</Label>
                                    <Select value={category} onValueChange={setCategory}>
                                        <SelectTrigger><SelectValue/></SelectTrigger>
                                        <SelectContent>{flowCategories.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                 <div className="space-y-2">
                                    <Label htmlFor="routingModel">Routing Model (JSON)</Label>
                                    <Textarea id="routingModel" value={JSON.stringify(flowData.routing_model || {}, null, 2)} onChange={e => {try { updateFlowField('routing_model', JSON.parse(e.target.value)) } catch(err) {}}} className="font-mono text-xs h-24"/>
                                </div>
                                <div className="flex items-center space-x-2 pt-2">
                                    <Switch id="publish" name="publish" checked={shouldPublish} onCheckedChange={setShouldPublish} />
                                    <Label htmlFor="publish">Publish this flow</Label>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-primary/5 border-primary/20">
                            <CardHeader>
                                <div className="flex items-center gap-2"><Wand2 className="h-5 w-5 text-primary"/><CardTitle>AI Assistant</CardTitle></div>
                                <CardDescription>Describe the flow you want to create, and the AI will generate it for you.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Textarea id="ai-prompt" value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="e.g., A two-screen survey asking for feedback and then a rating."/>
                                <Button type="button" onClick={handleGenerateByAi} disabled={isGenerating}>
                                    {isGenerating ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : <Wand2 className="mr-2 h-4 w-4" />}
                                    Generate with AI
                                </Button>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <div className="flex justify-between items-center">
                                    <CardTitle>2. Build Your Screens</CardTitle>
                                    <Button type="button" size="sm" variant="outline" onClick={addNewScreen}><Plus className="mr-2 h-4 w-4" /> Add Screen</Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <Accordion type="multiple" className="w-full space-y-4" defaultValue={['item-0']}>
                                    {(flowData.screens || []).map((screen: any, screenIndex: number) => (
                                        <AccordionItem value={`item-${screenIndex}`} key={screen.id} className="border rounded-md px-4">
                                            <AccordionTrigger className="hover:no-underline">
                                                <div className="flex items-center justify-between w-full">
                                                    <Input className="text-base font-semibold border-0 shadow-none focus-visible:ring-0 p-0 h-auto" value={screen.title || ''} onChange={e => updateScreenField(screenIndex, 'title', e.target.value)} onClick={e => e.stopPropagation()}/>
                                                    {flowData.screens.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); removeScreen(screenIndex); }}><Trash2 className="h-4 w-4 text-destructive"/></Button>}
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="pt-4 space-y-4">
                                                <div className="flex items-center justify-end gap-6 text-sm">
                                                    <div className="flex items-center gap-2"><Label htmlFor={`terminal-${screen.id}`}>Terminal Screen</Label><Switch id={`terminal-${screen.id}`} checked={!!screen.terminal} onCheckedChange={(val) => updateScreenField(screenIndex, 'terminal', val)}/></div>
                                                    <div className="flex items-center gap-2"><Label htmlFor={`success-${screen.id}`}>Success Screen</Label><Switch id={`success-${screen.id}`} checked={!!screen.success} onCheckedChange={(val) => updateScreenField(screenIndex, 'success', val)}/></div>
                                                </div>
                                                <h4 className="font-semibold text-sm">Components</h4>
                                                {(screen.layout.children[0]?.children || screen.layout.children).filter(Boolean).map((component: any, compIndex: number) => (
                                                    <div key={component.name || compIndex} className="p-3 border rounded-lg space-y-2 relative bg-background">
                                                        <div className="flex justify-between items-center">
                                                            <p className="text-sm font-medium text-muted-foreground">{component.type}</p>
                                                            <div>
                                                                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingComponent({screenIndex, componentIndex: compIndex, component})}><Settings className="h-3 w-3" /></Button>
                                                                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeComponentFromScreen(screenIndex, compIndex)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                                                            </div>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground truncate">Name: {component.name || 'N/A'}, Label: {component.label || component.text || 'N/A'}</p>
                                                    </div>
                                                ))}
                                                <Popover>
                                                    <PopoverTrigger asChild><Button type="button" variant="outline" className="w-full"><Plus className="mr-2 h-4 w-4" /> Add Component</Button></PopoverTrigger>
                                                    <PopoverContent className="w-56 p-1"><ScrollArea className="h-64">{declarativeFlowComponents.map(c => <div key={c.type} className="p-2 text-sm rounded-md hover:bg-accent cursor-pointer" onClick={() => addComponentToScreen(screenIndex, c.type)}>{c.label}</div>)}</ScrollArea></PopoverContent>
                                                </Popover>
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
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
            
             <ComponentEditorDialog 
                isOpen={!!editingComponent}
                onOpenChange={(open) => !open && setEditingComponent(null)}
                component={editingComponent?.component}
                onSave={handleComponentUpdate}
                onCancel={() => setEditingComponent(null)}
            />

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
