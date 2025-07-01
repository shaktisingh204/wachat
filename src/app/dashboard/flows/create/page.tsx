
'use client';

import { Suspense, useActionState, useEffect, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, LoaderCircle, Save, FileJson, Plus, Trash2, Wand2 } from 'lucide-react';
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

function ComponentEditor({ component, onUpdate, onAddOption, onUpdateOption, onRemoveOption }: { component: any, onUpdate: (key: string, value: any) => void, onAddOption: () => void, onUpdateOption: (index: number, value: string) => void, onRemoveOption: (index: number) => void }) {
    
    const commonInputs = (
        <div className="grid grid-cols-2 gap-2">
            {component.name !== undefined && <Input value={component.name || ''} onChange={e => onUpdate('name', e.target.value)} placeholder="Component Name" className="text-xs" />}
            {component.label !== undefined && <Input value={component.label || ''} onChange={e => onUpdate('label', e.target.value)} placeholder="Label" className="text-xs" />}
        </div>
    );
    
    const optionManager = (
        <div className="space-y-2 mt-2">
            <Label className="text-xs">Options</Label>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                {(component['data-source'] || []).map((opt: any, index: number) => (
                    <div key={opt.id} className="flex items-center gap-2">
                        <Input value={opt.title} className="text-xs h-8" onChange={e => onUpdateOption(index, e.target.value)} placeholder="Option Title" />
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => onRemoveOption(index)}><Trash2 className="h-3 w-3 text-destructive"/></Button>
                    </div>
                ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={onAddOption}>+ Add Option</Button>
        </div>
    );

    switch (component.type) {
        case 'TextSubheading':
        case 'TextHeading':
            return <Input value={component.text} onChange={e => onUpdate('text', e.target.value)} placeholder="Heading Text" className="text-xs" />;
        case 'TextArea':
        case 'TextInput':
        case 'PhoneNumber':
        case 'DatePicker':
            return commonInputs;
        case 'Dropdown':
        case 'RadioButtonsGroup':
             return <div className="space-y-2">{commonInputs}{optionManager}</div>;
        default:
            return <p className="text-xs text-muted-foreground">This component has no editable properties in the UI yet.</p>;
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
    
    const [flowData, setFlowData] = useState<any>({ name: '', screens: [], description: '' });
    
    const [category, setCategory] = useState('OTHER');
    const [flowJson, setFlowJson] = useState('');
    const [aiPrompt, setAiPrompt] = useState('');
    const [isGenerating, startGeneratingTransition] = useTransition();
    const [shouldPublish, setShouldPublish] = useState(true);

    const safeGetFormChildren = (screen: any) => {
      return screen?.layout?.children?.[0]?.children || [];
    };

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
                screens: [{
                    id: 'screen_1',
                    title: 'Welcome Screen',
                    layout: {
                        type: 'SingleColumnLayout',
                        children: [{
                            type: 'Form',
                            name: 'form_1',
                            children: [{
                                type: 'TextSubheading', text: 'This is the start of your flow.'
                            }, {
                                type: 'Footer', label: 'Finish', 'on-click-action': { name: 'complete' }
                            }]
                        }]
                    }
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
            } else if (result) {
                try {
                    setFlowData(result);
                    toast({ title: "Flow Generated!", description: "The AI has created your flow. Review and save it." });
                } catch (e) {
                    toast({ title: "JSON Parse Error", description: "The AI returned invalid JSON. Please try again.", variant: "destructive" });
                }
            }
        });
    };

    const updateFlowField = (field: 'name' | 'description', value: string) => {
        setFlowData(prev => ({ ...prev, [field]: value }));
    };

    const updateScreenField = (screenId: string, path: string, value: any) => {
        setFlowData(prev => ({
            ...prev,
            screens: prev.screens.map(s => {
                if (s.id === screenId) {
                    const newScreen = JSON.parse(JSON.stringify(s));
                    let current = newScreen;
                    const keys = path.split('.');
                    for(let i=0; i<keys.length-1; i++){
                        current = current[keys[i]];
                    }
                    current[keys[keys.length-1]] = value;
                    return newScreen;
                }
                return s;
            })
        }));
    };

    const updateComponentInScreen = (screenId: string, componentIndex: number, key: string, value: any) => {
        setFlowData(prev => ({
            ...prev,
            screens: prev.screens.map(s => {
                if (s.id === screenId) {
                    const newScreen = JSON.parse(JSON.stringify(s));
                    const formChildren = newScreen.layout.children[0].children;
                    formChildren[componentIndex] = {...formChildren[componentIndex], [key]: value};
                    return newScreen;
                }
                return s;
            })
        }));
    };

    const addComponentToScreen = (screenId: string, componentType: DeclarativeUIComponent['type']) => {
        const newComponent: any = { type: componentType, name: `${componentType.toLowerCase()}_${Date.now()}` };
        if (['TextSubheading', 'TextHeading'].includes(componentType)) {
            newComponent.text = 'New ' + componentType;
            delete newComponent.name;
        }
        if (['TextArea', 'TextInput', 'PhoneNumber', 'DatePicker', 'Dropdown', 'RadioButtonsGroup'].includes(componentType)) {
            newComponent.label = 'New ' + componentType;
        }
        if (['Dropdown', 'RadioButtonsGroup'].includes(componentType)) {
            newComponent['data-source'] = [{ id: `opt_${Date.now()}`, title: 'Option 1' }];
        }
        if (componentType === 'Footer') {
            newComponent.label = 'Submit';
            newComponent['on-click-action'] = { name: 'complete' };
            delete newComponent.name;
        }

        setFlowData(prev => ({
            ...prev,
            screens: prev.screens.map(s => {
                if (s.id === screenId) {
                    const newScreen = JSON.parse(JSON.stringify(s));
                    newScreen.layout.children[0].children.push(newComponent);
                    return newScreen;
                }
                return s;
            })
        }));
    };
    
    const removeComponentFromScreen = (screenId: string, componentIndex: number) => {
        setFlowData(prev => ({
            ...prev,
            screens: prev.screens.map(s => {
                if (s.id === screenId) {
                    const newScreen = JSON.parse(JSON.stringify(s));
                    newScreen.layout.children[0].children.splice(componentIndex, 1);
                    return newScreen;
                }
                return s;
            })
        }));
    };
    
    const handleAddOption = (screenId: string, componentIndex: number) => {
        const component = safeGetFormChildren(flowData.screens.find(s => s.id === screenId))[componentIndex];
        const newOptions = [...(component['data-source'] || []), {id: `opt_${Date.now()}`, title: ''}];
        updateComponentInScreen(screenId, componentIndex, 'data-source', newOptions);
    };
    const handleUpdateOption = (screenId: string, componentIndex: number, optionIndex: number, value: string) => {
        const component = safeGetFormChildren(flowData.screens.find(s => s.id === screenId))[componentIndex];
        const newOptions = [...(component['data-source'] || [])];
        newOptions[optionIndex] = {...newOptions[optionIndex], title: value};
        updateComponentInScreen(screenId, componentIndex, 'data-source', newOptions);
    };
    const handleRemoveOption = (screenId: string, componentIndex: number, optionIndex: number) => {
        const component = safeGetFormChildren(flowData.screens.find(s => s.id === screenId))[componentIndex];
        const newOptions = (component['data-source'] || []).filter((_: any, i: number) => i !== optionIndex);
        updateComponentInScreen(screenId, componentIndex, 'data-source', newOptions);
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
            }
        };
        setFlowData(prev => ({ ...prev, screens: [...prev.screens, newScreen] }));
    };

    useEffect(() => {
        setFlowJson(JSON.stringify(flowData, null, 2));
    }, [flowData]);
    
    if (isLoading) {
        return <PageSkeleton />;
    }

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
                                    <Input id="flowNameInput" value={flowData.name} onChange={e => updateFlowField('name', e.target.value)} placeholder="e.g., lead_capture_flow" required/>
                                    <p className="text-xs text-muted-foreground">Lowercase letters and underscores only.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Category</Label>
                                    <Select value={category} onValueChange={setCategory}>
                                        <SelectTrigger><SelectValue/></SelectTrigger>
                                        <SelectContent>{flowCategories.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                                    </Select>
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
                                <Textarea id="ai-prompt" value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="e.g., A flow to capture leads for a real estate agency. Ask for name, email, and property type they are interested in."/>
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
                                                 <Input className="text-base font-semibold border-0 shadow-none focus-visible:ring-0 p-0 h-auto" value={screen.title || ''} onChange={e => updateScreenField(screen.id, 'title', e.target.value)} onClick={e => e.stopPropagation()}/>
                                            </AccordionTrigger>
                                            <AccordionContent className="pt-4 space-y-4">
                                                <h4 className="font-semibold text-sm">Components</h4>
                                                {(safeGetFormChildren(screen)).map((component: any, compIndex: number) => (
                                                    <div key={component.name || compIndex} className="p-3 border rounded-lg space-y-2 relative bg-background">
                                                        <div className="flex justify-between items-center">
                                                            <p className="text-sm font-medium text-muted-foreground">{component.type}</p>
                                                            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeComponentFromScreen(screen.id, compIndex)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                                                        </div>
                                                        <ComponentEditor 
                                                            component={component} 
                                                            onUpdate={(key, value) => updateComponentInScreen(screen.id, compIndex, key, value)}
                                                            onAddOption={() => handleAddOption(screen.id, compIndex)}
                                                            onUpdateOption={(optionIndex, value) => handleUpdateOption(screen.id, compIndex, optionIndex, value)}
                                                            onRemoveOption={(optionIndex) => handleRemoveOption(screen.id, compIndex, optionIndex)}
                                                        />
                                                    </div>
                                                ))}
                                                <Popover>
                                                    <PopoverTrigger asChild><Button type="button" variant="outline" className="w-full"><Plus className="mr-2 h-4 w-4" /> Add Component</Button></PopoverTrigger>
                                                    <PopoverContent className="w-56 p-1"><ScrollArea className="h-64">{declarativeFlowComponents.map(c => <div key={c.type} className="p-2 text-sm rounded-md hover:bg-accent cursor-pointer" onClick={() => addComponentToScreen(screen.id, c.type)}>{c.label}</div>)}</ScrollArea></PopoverContent>
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
