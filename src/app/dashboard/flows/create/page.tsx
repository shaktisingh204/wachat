
'use client';

import { useActionState, useEffect, useState, useRef, useCallback } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, LoaderCircle, Save, FileJson, Info, Plus, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { saveMetaFlow } from '@/app/actions/meta-flow.actions';
import { flowCategories, uiComponents } from '@/components/wabasimplify/meta-flow-templates';
import { MetaFlowPreview } from '@/components/wabasimplify/meta-flow-preview';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

const createFlowInitialState = { message: null, error: null };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} size="lg">
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save & Publish Flow
        </Button>
    );
}

function ComponentEditor({ component, onUpdate, onDelete }) {
    const [tempOptions, setTempOptions] = useState((component.data['data-source'] || []).map(o => o.title).join('\n'));

    const handleOptionChange = (e) => {
        const value = e.target.value;
        setTempOptions(value);
        const options = value.split('\n').map((line, index) => ({ id: `${component.name}_opt_${index}`, title: line }));
        onUpdate('data-source', options);
    };

    const commonFields = (
         <div className="space-y-2 mt-2">
            <Label htmlFor={`${component.id}_name`}>Field Name/ID</Label>
            <Input id={`${component.id}_name`} value={component.name || ''} onChange={e => onUpdate('name', e.target.value)} placeholder="e.g., user_name (unique)" />
        </div>
    );
    
    switch (component.type) {
        case 'TextHeading':
        case 'TextBody':
        case 'TextSubtext':
            return <Textarea value={component.text} onChange={e => onUpdate('text', e.target.value)} placeholder="Enter text content..." />;
        case 'Image':
             return <Input value={component.url || ''} onChange={e => onUpdate('url', e.target.value)} placeholder="https://example.com/image.png" />;
        case 'TextInput':
        case 'DatePicker':
             return (
                <div className="space-y-2">
                    <Label htmlFor={`${component.id}_label`}>Label</Label>
                    <Input id={`${component.id}_label`} value={component.label || ''} onChange={e => onUpdate('label', e.target.value)} placeholder="e.g., Your Full Name" />
                    {commonFields}
                </div>
            );
        case 'RadioButtons':
        case 'CheckboxGroup':
        case 'Dropdown':
             return (
                <div className="space-y-2">
                    <Label htmlFor={`${component.id}_label`}>Label</Label>
                    <Input id={`${component.id}_label`} value={component.label || ''} onChange={e => onUpdate('label', e.target.value)} placeholder="e.g., Select your interest" />
                    <Label htmlFor={`${component.id}_options`}>Options (one per line)</Label>
                    <Textarea id={`${component.id}_options`} value={tempOptions} onChange={handleOptionChange} placeholder="Option 1&#x0a;Option 2" />
                    {commonFields}
                </div>
            );
         case 'OptIn':
            return <Input value={component.label || ''} onChange={e => onUpdate('label', e.target.value)} placeholder="I agree to the terms..." />;
        default:
            return <p className="text-xs text-muted-foreground">This component has no editable properties.</p>;
    }
}

export default function CreateMetaFlowPage() {
    const [projectId, setProjectId] = useState<string | null>(null);
    const [state, formAction] = useActionState(saveMetaFlow, createFlowInitialState);
    const { toast } = useToast();
    const router = useRouter();

    const [flowName, setFlowName] = useState('new_flow');
    const [endpointUri, setEndpointUri] = useState('');
    const [category, setCategory] = useState('LEAD_GENERATION');
    const [isEndpointFlow, setIsEndpointFlow] = useState(false);
    
    const [screens, setScreens] = useState<any[]>([
        { id: 'SCREEN_1', title: 'Welcome Screen', layout: { type: 'SingleColumnLayout', children: [{ type: 'Footer', label: 'Continue', 'on-click-action': { name: 'complete' } }] } }
    ]);
    const [flowJson, setFlowJson] = useState('');

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
    }, []);
    
    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Success', description: state.message });
            router.push('/dashboard/flows');
        }
        if (state?.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router]);

    const addScreen = () => setScreens(prev => [...prev, { id: `SCREEN_${prev.length + 1}`, title: `Screen ${prev.length + 1}`, layout: { type: 'SingleColumnLayout', children: [{ type: 'Footer', label: 'Continue', 'on-click-action': { name: 'complete' } }] } }]);
    const removeScreen = (index) => setScreens(prev => prev.filter((_, i) => i !== index));
    const updateScreen = (index, key, value) => setScreens(prev => prev.map((s, i) => i === index ? { ...s, [key]: value } : s));
    const updateScreenAction = (index, screenId) => {
        setScreens(prev => prev.map((s, i) => {
            if (i === index) {
                const footer = s.layout.children.find(c => c.type === 'Footer');
                if(footer) {
                    footer['on-click-action'] = screenId ? { name: 'navigate', payload: { next: screenId } } : { name: 'complete' };
                }
            }
            return s;
        }))
    };
    
    const addComponentToScreen = (screenIndex, componentType) => {
        setScreens(prev => prev.map((s, i) => {
            if (i === screenIndex) {
                const newComponent = { id: `comp_${Date.now()}`, type: componentType };
                const footerIndex = s.layout.children.findIndex(c => c.type === 'Footer');
                const newChildren = [...s.layout.children];
                newChildren.splice(footerIndex, 0, newComponent);
                return { ...s, layout: { ...s.layout, children: newChildren } };
            }
            return s;
        }));
    };

    const updateComponentInScreen = (screenIndex, componentIndex, key, value) => {
        setScreens(prev => prev.map((s, i) => {
            if (i === screenIndex) {
                const newChildren = s.layout.children.map((c, j) => j === componentIndex ? { ...c, [key]: value } : c);
                return { ...s, layout: { ...s.layout, children: newChildren } };
            }
            return s;
        }));
    };
    
    const removeComponentFromScreen = (screenIndex, componentIndex) => {
        setScreens(prev => prev.map((s, i) => {
            if (i === screenIndex) {
                const newChildren = s.layout.children.filter((_, j) => j !== componentIndex);
                return { ...s, layout: { ...s.layout, children: newChildren } };
            }
            return s;
        }));
    };

     useEffect(() => {
        const generatedJson = {
            version: "3.0",
            data_api_version: isEndpointFlow ? "3.0" : undefined,
            screens: screens
        };
        setFlowJson(JSON.stringify(generatedJson, null, 2));
    }, [screens, isEndpointFlow]);
    
    return (
        <form action={formAction} className="space-y-6">
            <input type="hidden" name="projectId" value={projectId || ''}/>
            <input type="hidden" name="category" value={category} />
            <input type="hidden" name="name" value={flowName} />
            <input type="hidden" name="flow_data" value={flowJson} />
            {isEndpointFlow && <input type="hidden" name="endpoint_uri" value={endpointUri} />}

            <div>
                <Button variant="ghost" asChild className="mb-4 -ml-4">
                  <Link href="/dashboard/flows"><ChevronLeft className="mr-2 h-4 w-4" />Back to Meta Flows</Link>
                </Button>
                <h1 className="text-3xl font-bold font-headline">Create New Meta Flow</h1>
                <p className="text-muted-foreground mt-2">Build interactive forms and experiences for your customers.</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <ScrollArea className="h-[80vh] pr-4">
                    <div className="space-y-6">
                        <Card>
                            <CardHeader><CardTitle>1. General Details</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                 <div className="space-y-2">
                                    <Label htmlFor="name">Flow Name</Label>
                                    <Input id="name" value={flowName} onChange={e => setFlowName(e.target.value)} placeholder="e.g., lead_capture_flow" required/>
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
                                <div className="flex items-center space-x-2">
                                    <input type="checkbox" id="endpoint-toggle" checked={isEndpointFlow} onChange={e => setIsEndpointFlow(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"/>
                                    <Label htmlFor="endpoint-toggle">This flow uses a data endpoint</Label>
                                </div>
                                {isEndpointFlow && (
                                    <div className="space-y-2">
                                        <Label htmlFor="endpoint_uri">Endpoint URI</Label>
                                        <Input id="endpoint_uri" value={endpointUri} onChange={e => setEndpointUri(e.target.value)} placeholder="https://your-server.com/api/flow" required/>
                                    </div>
                                )}
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
                                                    <Input className="text-base font-semibold border-0 shadow-none focus-visible:ring-0 p-0 h-auto" value={screen.title} onChange={e => updateScreen(screenIndex, 'title', e.target.value)} />
                                                </div>
                                                <Button type="button" variant="ghost" size="icon" onClick={() => removeScreen(screenIndex)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                            </AccordionTrigger>
                                            <AccordionContent className="pt-4 space-y-4">
                                                {screen.layout.children.filter(c => c.type !== 'Footer').map((component, compIndex) => (
                                                    <div key={component.id || compIndex} className="p-3 border rounded-lg space-y-2 relative">
                                                        <div className="flex justify-between items-center">
                                                            <p className="text-sm font-medium text-muted-foreground">{component.type}</p>
                                                            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeComponentFromScreen(screenIndex, compIndex)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                                                        </div>
                                                        <ComponentEditor component={component} onUpdate={(key, value) => updateComponentInScreen(screenIndex, compIndex, key, value)} />
                                                    </div>
                                                ))}
                                                <Popover>
                                                    <PopoverTrigger asChild><Button type="button" variant="outline" className="w-full"><Plus className="mr-2 h-4 w-4" /> Add Component</Button></PopoverTrigger>
                                                    <PopoverContent className="w-56 p-1">
                                                        {uiComponents.map(c => <div key={c.type} className="p-2 text-sm rounded-md hover:bg-accent cursor-pointer" onClick={() => addComponentToScreen(screenIndex, c.type)}>{c.label}</div>)}
                                                    </PopoverContent>
                                                </Popover>
                                                <div className="space-y-2 pt-4 border-t">
                                                    <Label>Footer Button Action</Label>
                                                    <select value={screen.layout.children.find(c => c.type === 'Footer')['on-click-action']?.payload?.next || ''} onChange={e => updateScreenAction(screenIndex, e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
                                                        <option value="">End Flow</option>
                                                        {screens.filter(s => s.id !== screen.id).map(s => <option key={s.id} value={s.id}>Go to: {s.title}</option>)}
                                                    </select>
                                                </div>
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
                    <AccordionContent><pre className="p-4 bg-muted/50 rounded-md text-xs font-mono max-h-96 overflow-auto">{flowJson}</pre></AccordionContent>
                </AccordionItem>
            </Accordion>

            <div className="flex justify-end"><SubmitButton/></div>
        </form>
    );
}
