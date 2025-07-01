
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
import { flowCategories, uiComponentsV3, type UIComponentV3 } from '@/components/wabasimplify/meta-flow-templates';
import { MetaFlowPreview } from '@/components/wabasimplify/meta-flow-preview';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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

function ComponentEditor({ component, onUpdate, onAddOption, onUpdateOption, onRemoveOption }: { component: UIComponentV3 & { name?: string }, onUpdate: (key: string, value: any) => void, onAddOption: () => void, onUpdateOption: (index: number, value: string) => void, onRemoveOption: (index: number) => void }) {
    const { name } = component;

    switch (component.type) {
        case 'TextSubheading':
            return <Input value={component.text || ''} onChange={e => onUpdate('text', e.target.value)} placeholder="e.g., Your Details" />;
        case 'TextArea':
             return <Input value={component.label || ''} onChange={e => onUpdate('label', e.target.value)} placeholder="e.g., Additional Comments" />;
        case 'Dropdown':
        case 'RadioButtonsGroup':
        case 'CheckboxGroup':
             return (
                <div className="space-y-2">
                    <Input id={`${name}_label`} value={component.label || ''} onChange={e => onUpdate('label', e.target.value)} placeholder="e.g., Select your interest" />
                    <Label className="text-xs">Options</Label>
                    <div className="space-y-2">
                        {(component['data-source'] || []).map((opt, index) => (
                            <div key={opt.id} className="flex items-center gap-2">
                                <Input value={opt.title} onChange={e => onUpdateOption(index, e.target.value)} />
                                <Button type="button" variant="ghost" size="icon" onClick={() => onRemoveOption(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                            </div>
                        ))}
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={onAddOption}>+ Add Option</Button>
                </div>
            );
        case 'OptIn':
            return <Input value={component.label || ''} onChange={e => onUpdate('label', e.target.value)} placeholder="e.g., I agree to the terms." />;
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
    
    const [flowName, setFlowName] = useState('');
    const [screens, setScreens] = useState<any[]>([]);
    
    const [category, setCategory] = useState('OTHER');
    const [flowJson, setFlowJson] = useState('');
    const [aiPrompt, setAiPrompt] = useState('');
    const [isGenerating, startGeneratingTransition] = useTransition();
    const [shouldPublish, setShouldPublish] = useState(true);

    const getFormComponent = (screen: any) => screen?.layout?.children?.[0];
    const getFormChildren = (screen: any) => getFormComponent(screen)?.children || [];
    
    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
        if (flowId) {
            setIsLoading(true);
            getMetaFlowById(flowId).then(data => {
                if (data) {
                    setExistingFlow(data);
                    const flowContent = data.flow_data;
                    setFlowName(data.name);
                    setScreens(flowContent?.screens || []);
                    setCategory(data.categories[0] || 'OTHER');
                    setShouldPublish(data.status === 'PUBLISHED');
                }
                setIsLoading(false);
            });
        } else {
            setFlowName('new_flow_' + Math.floor(Math.random() * 1000));
            setScreens([{
                id: 'screen_1',
                title: 'Welcome Screen',
                terminal: true,
                success: true,
                layout: {
                    type: 'SingleColumnLayout',
                    children: [{
                        type: 'Form',
                        name: 'form_1',
                        children: [{
                            type: 'Footer',
                            label: 'Start',
                            'on-click-action': { name: 'complete' }
                        }]
                    }]
                }
            }]);
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
                    setScreens(parsedFlow.screens);
                    toast({ title: "Flow Generated!", description: "The AI has created your flow. Review and save it." });
                } catch (e) {
                    toast({ title: "JSON Parse Error", description: "The AI returned invalid JSON. Please try again.", variant: "destructive" });
                }
            }
        });
    };

    const updateScreenField = (screenId: string, field: 'title' | 'terminal' | 'success', value: string | boolean) => {
        setScreens(prev => prev.map(s => s.id === screenId ? { ...s, [field]: value } : s));
    };

    const updateScreenAction = (screenId: string, targetScreenId: string) => {
         setScreens(prev => prev.map(s => {
            if (s.id === screenId) {
                const form = getFormComponent(s);
                const children = getFormChildren(s);
                const footerIndex = children.findLastIndex((c: any) => c.type === 'Footer');

                if (footerIndex === -1) return s;

                const newChildren = [...children];
                const newAction = targetScreenId === 'COMPLETE' 
                    ? { name: 'complete' }
                    : { name: 'navigate', next: { type: 'screen', name: targetScreenId } };
                
                newChildren[footerIndex] = { ...newChildren[footerIndex], 'on-click-action': newAction };
                
                return { ...s, layout: { ...s.layout, children: [{ ...form, children: newChildren }] } };
            }
            return s;
        }));
    };

    const addComponentToScreen = (screenId: string, componentType: UIComponentV3['type']) => {
        const newUiId = `${componentType.toLowerCase()}_${Date.now()}`;
        let newComponent: any = { type: componentType, _ui_id: newUiId };

        const componentsThatNeedName = ['TextArea', 'Dropdown', 'RadioButtonsGroup', 'CheckboxGroup', 'OptIn'];
        if (componentsThatNeedName.includes(componentType)) {
            newComponent.name = newUiId.replace(/[^a-zA-Z0-9]/g, '');
        }

        switch (componentType) {
            case 'TextSubheading':
                newComponent.text = 'New Subheading';
                break;
            case 'TextArea':
            case 'OptIn':
                newComponent.label = 'New ' + componentType;
                break;
            case 'Dropdown':
            case 'RadioButtonsGroup':
            case 'CheckboxGroup':
                newComponent.label = 'New ' + componentType;
                newComponent['data-source'] = [{ id: `opt_${Date.now()}`, title: 'Option 1' }];
                break;
            default:
                return; 
        }

        setScreens(prev => prev.map((s) => {
            if (s.id === screenId) {
                const form = getFormComponent(s);
                const children = getFormChildren(s);
                const footerIndex = children.findLastIndex((c: any) => c.type === 'Footer');
                const newChildren = [...children];
                newChildren.splice(footerIndex, 0, newComponent);
                return { ...s, layout: { ...s.layout, children: [{ ...form, children: newChildren }] } };
            }
            return s;
        }));
    };
    
    const removeComponentFromScreen = (screenId: string, componentUiId: string) => {
        setScreens(prev => prev.map((s) => {
            if (s.id === screenId) {
                const form = getFormComponent(s);
                const newChildren = getFormChildren(s).filter((c: any) => c._ui_id !== componentUiId);
                return { ...s, layout: { ...s.layout, children: [{ ...form, children: newChildren }] } };
            }
            return s;
        }));
    };

    const updateComponentInScreen = (screenId: string, componentUiId: string, key: string, value: any) => {
        setScreens(prev => prev.map(s => {
            if (s.id === screenId) {
                const form = getFormComponent(s);
                const newChildren = getFormChildren(s).map((c: any) => c._ui_id === componentUiId ? { ...c, [key]: value } : c);
                return { ...s, layout: { ...s.layout, children: [{ ...form, children: newChildren }] } };
            }
            return s;
        }));
    };

    const handleAddOption = (screenId: string, componentUiId: string) => {
        setScreens(prev => prev.map(s => {
            if (s.id === screenId) {
                const form = getFormComponent(s);
                const newChildren = getFormChildren(s).map((c: any) => {
                    if (c._ui_id === componentUiId) {
                        const newOptions = [...(c['data-source'] || []), { id: `opt_${Date.now()}`, title: '' }];
                        return { ...c, 'data-source': newOptions };
                    }
                    return c;
                });
                return { ...s, layout: {...s.layout, children: [{...form, children: newChildren}]} };
            }
            return s;
        }));
    };

    const handleUpdateOption = (screenId: string, componentUiId: string, optionIndex: number, value: string) => {
        setScreens(prev => prev.map(s => {
            if (s.id === screenId) {
                const form = getFormComponent(s);
                const newChildren = getFormChildren(s).map((c: any) => {
                    if (c._ui_id === componentUiId) {
                        const newOptions = c['data-source'].map((opt:any, k:number) => k === optionIndex ? { ...opt, title: value } : opt);
                        return { ...c, 'data-source': newOptions };
                    }
                    return c;
                });
                return { ...s, layout: {...s.layout, children: [{...form, children: newChildren}]} };
            }
            return s;
        }));
    };

    const handleRemoveOption = (screenId: string, componentUiId: string, optionIndex: number) => {
        setScreens(prev => prev.map(s => {
            if (s.id === screenId) {
                const form = getFormComponent(s);
                const newChildren = getFormChildren(s).map((c: any) => {
                    if (c._ui_id === componentUiId) {
                        const newOptions = c['data-source'].filter((_: any, k: number) => k !== optionIndex);
                        return { ...c, 'data-source': newOptions };
                    }
                    return c;
                });
                return { ...s, layout: {...s.layout, children: [{...form, children: newChildren}]}};
            }
            return s;
        }));
    };

    const addNewScreen = () => {
        const newScreenId = `screen_${screens.length + 1}_${Date.now()}`;
        const newScreen = {
            id: newScreenId,
            title: `New Screen ${screens.length + 1}`,
            terminal: false,
            success: false,
            layout: {
                type: 'SingleColumnLayout',
                children: [{
                    type: 'Form',
                    name: `form_${newScreenId}`,
                    children: [{
                        type: 'Footer',
                        label: 'Submit',
                        'on-click-action': { name: 'complete' }
                    }]
                }]
            }
        };
        setScreens(prev => [...prev, newScreen]);
    };

    useEffect(() => {
        const screensForJson = JSON.parse(JSON.stringify(screens));
        screensForJson.forEach((screen: any) => {
            getFormChildren(screen)?.forEach((component: any) => {
                delete component._ui_id;
            });
        });
        const generatedJson = { version: "7.1", screens: screensForJson };
        setFlowJson(JSON.stringify(generatedJson, null, 2));
    }, [screens]);
    
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
                                        <div key={c.id}><RadioGroupItem value={c.id} id={c.id} className="sr-only" /><Label htmlFor={c.id} className={`flex text-xs items-center justify-center rounded-md border-2 p-2 hover:bg-accent hover:text-accent-foreground cursor-pointer ${category === c.id ? 'border-primary' : 'border-muted'}`}>{c.name}</Label></div>
                                    ))}
                                    </div>
                                    </RadioGroup>
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
                                    {screens.map((screen, screenIndex) => (
                                        <AccordionItem value={`item-${screenIndex}`} key={screen.id} className="border rounded-md px-4">
                                            <AccordionTrigger className="hover:no-underline">
                                                 <Input className="text-base font-semibold border-0 shadow-none focus-visible:ring-0 p-0 h-auto" value={screen.title || ''} onChange={e => updateScreenField(screen.id, 'title', e.target.value)} onClick={e => e.stopPropagation()}/>
                                            </AccordionTrigger>
                                            <AccordionContent className="pt-4 space-y-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="flex items-center space-x-2"><Switch id={`terminal-${screen.id}`} checked={!!screen.terminal} onCheckedChange={checked => updateScreenField(screen.id, 'terminal', checked)} /><Label htmlFor={`terminal-${screen.id}`}>Terminal Screen</Label></div>
                                                    <div className="flex items-center space-x-2"><Switch id={`success-${screen.id}`} checked={!!screen.success} onCheckedChange={checked => updateScreenField(screen.id, 'success', checked)} /><Label htmlFor={`success-${screen.id}`}>Success Screen</Label></div>
                                                </div>
                                                <Separator />
                                                <h4 className="font-semibold text-sm">Components</h4>
                                                {getFormChildren(screen).filter((c: any) => c.type !== 'Footer').map((component: any, compIndex: number) => (
                                                    <div key={component._ui_id || compIndex} className="p-3 border rounded-lg space-y-2 relative bg-background">
                                                        <div className="flex justify-between items-center">
                                                            <p className="text-sm font-medium text-muted-foreground">{component.type}</p>
                                                            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeComponentFromScreen(screen.id, component._ui_id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                                                        </div>
                                                        <ComponentEditor 
                                                            component={component} 
                                                            onUpdate={(key, value) => updateComponentInScreen(screen.id, component._ui_id, key, value)}
                                                            onAddOption={() => handleAddOption(screen.id, component._ui_id)}
                                                            onUpdateOption={(optionIndex, value) => handleUpdateOption(screen.id, component._ui_id, optionIndex, value)}
                                                            onRemoveOption={(optionIndex) => handleRemoveOption(screen.id, component._ui_id, optionIndex)}
                                                        />
                                                    </div>
                                                ))}
                                                <Popover>
                                                    <PopoverTrigger asChild><Button type="button" variant="outline" className="w-full"><Plus className="mr-2 h-4 w-4" /> Add Component</Button></PopoverTrigger>
                                                    <PopoverContent className="w-56 p-1"><ScrollArea className="h-64">{uiComponentsV3.map(c => <div key={c.type} className="p-2 text-sm rounded-md hover:bg-accent cursor-pointer" onClick={() => addComponentToScreen(screen.id, c.type)}>{c.label}</div>)}</ScrollArea></PopoverContent>
                                                </Popover>
                                                <Separator />
                                                <div className="space-y-2 pt-2">
                                                    <Label>Footer Button Action</Label>
                                                    <Select value={getFormChildren(screen).find((c: any) => c.type === 'Footer')?.['on-click-action']?.next?.name || 'COMPLETE'} onValueChange={value => updateScreenAction(screen.id, value)}>
                                                        <SelectTrigger><SelectValue/></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="COMPLETE">End & Complete Flow</SelectItem>
                                                            {screens.filter(s => s.id !== screen.id).map(s => <SelectItem key={s.id} value={s.id}>Go to: {s.title}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
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
