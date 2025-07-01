
'use client';

import { useActionState, useEffect, useState, useRef, useCallback } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, LoaderCircle, Save, FileJson, Info, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { saveMetaFlow } from '@/app/actions/meta-flow.actions';
import { getTemplateScreens, flowCategories, uiComponents } from '@/components/wabasimplify/meta-flow-templates';
import { MetaFlowPreview } from '@/components/wabasimplify/meta-flow-preview';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

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

const ScreenEditor = ({ screens, setScreens, activeScreenIndex, setActiveScreenIndex }) => {
    const activeScreen = screens[activeScreenIndex];
    if (!activeScreen) return null;

    const updateScreen = (updatedScreen) => {
        setScreens(screens.map((s, i) => i === activeScreenIndex ? updatedScreen : s));
    };

    const addComponent = (type) => {
        const newComponent = { id: `comp_${Date.now()}`, type, label: 'New Component' };
        if (type === 'TextInput') newComponent.label = 'New Text Input';
        updateScreen({ ...activeScreen, layout: { ...activeScreen.layout, children: [...activeScreen.layout.children, newComponent] }});
    };

    const updateComponent = (compIndex, newCompData) => {
        const newChildren = [...activeScreen.layout.children];
        newChildren[compIndex] = { ...newChildren[compIndex], ...newCompData };
        updateScreen({ ...activeScreen, layout: { ...activeScreen.layout, children: newChildren }});
    };

    const removeComponent = (compIndex) => {
        updateScreen({ ...activeScreen, layout: { ...activeScreen.layout, children: activeScreen.layout.children.filter((_, i) => i !== compIndex) }});
    };
    
    const footer = activeScreen.layout.children.find(c => c.type === 'Footer');
    const normalChildren = activeScreen.layout.children.filter(c => c.type !== 'Footer');

    return (
        <div className="space-y-4">
             <div className="space-y-2">
                <Label>Screen Title</Label>
                <Input value={activeScreen.title} onChange={e => updateScreen({...activeScreen, title: e.target.value})} placeholder="e.g., Welcome Screen" />
            </div>

            {normalChildren.map((component, index) => (
                 <Card key={component.id || index} className="p-4 space-y-3 relative">
                     <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => removeComponent(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                     <p className="text-sm font-medium text-muted-foreground">{component.type}</p>
                     
                     {component.type === 'TextHeading' && <Input placeholder="Heading Text" value={component.text} onChange={e => updateComponent(index, { text: e.target.value })} />}
                     {component.type === 'TextBody' && <Textarea placeholder="Body Text" value={component.text} onChange={e => updateComponent(index, { text: e.target.value })} />}
                     {component.type === 'Image' && <Input placeholder="Image URL" value={component.url} onChange={e => updateComponent(index, { url: e.target.value })} />}
                     {component.type === 'TextInput' && (
                         <div className="space-y-2">
                             <Input placeholder="Input Label" value={component.label} onChange={e => updateComponent(index, { label: e.target.value })} />
                             <Input placeholder="Variable Name (e.g., user_name)" value={component.name} onChange={e => updateComponent(index, { name: e.target.value })} />
                         </div>
                     )}
                     {component.type === 'DatePicker' && (
                          <div className="space-y-2">
                             <Input placeholder="Date Picker Label" value={component.label} onChange={e => updateComponent(index, { label: e.target.value })} />
                             <Input placeholder="Variable Name (e.g., appointment_date)" value={component.name} onChange={e => updateComponent(index, { name: e.target.value })} />
                         </div>
                     )}
                </Card>
            ))}

             <div className="space-y-2">
                 <Label>Add New Component</Label>
                <Select onValueChange={addComponent}>
                    <SelectTrigger><SelectValue placeholder="Select a component to add..." /></SelectTrigger>
                    <SelectContent>{uiComponents.map(c => <SelectItem key={c.type} value={c.type}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
            </div>
            <Separator/>
            {footer && (
                <div className="space-y-2">
                    <Label>Footer / Action Button</Label>
                    <Input placeholder="Button Label" value={footer.label} onChange={e => updateComponent(normalChildren.length, { label: e.target.value })} />
                    <Select value={footer['on-click-action'].name} onValueChange={val => updateComponent(normalChildren.length, { 'on-click-action': { ...footer['on-click-action'], name: val }})}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="next">Go to next screen</SelectItem>
                            <SelectItem value="complete">Complete Flow</SelectItem>
                        </SelectContent>
                    </Select>
                    {footer['on-click-action'].name === 'next' && (
                         <Select value={footer['on-click-action'].payload?.next || ''} onValueChange={val => updateComponent(normalChildren.length, { 'on-click-action': { ...footer['on-click-action'], payload: { next: val } }})}>
                            <SelectTrigger><SelectValue placeholder="Select next screen..."/></SelectTrigger>
                            <SelectContent>
                                {screens.filter(s => s.id !== activeScreen.id).map(s => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    )}
                </div>
            )}
        </div>
    );
};


export default function CreateMetaFlowPage() {
    const [projectId, setProjectId] = useState<string | null>(null);
    const [state, formAction] = useActionState(saveMetaFlow, createFlowInitialState);
    const { toast } = useToast();
    const router = useRouter();

    const [flowName, setFlowName] = useState('new_flow');
    const [endpointUri, setEndpointUri] = useState('');
    const [category, setCategory] = useState('OTHER');
    const [templateType, setTemplateType] = useState('default');
    const [flowJson, setFlowJson] = useState('');

    const [screens, setScreens] = useState(getTemplateScreens('default'));
    const [activeScreenIndex, setActiveScreenIndex] = useState(0);

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
    }, []);

    useEffect(() => {
        const newScreens = getTemplateScreens(templateType);
        setScreens(newScreens);
        setActiveScreenIndex(0);
    }, [templateType]);

    useEffect(() => {
        const finalJson = {
            version: "3.0",
            data_api_version: "3.0",
            routing_model: {},
            screens: screens
        };
        setFlowJson(JSON.stringify(finalJson, null, 2));
    }, [screens]);
    
    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Success', description: state.message });
            router.push('/dashboard/flows');
        }
        if (state?.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router]);
    
    const addScreen = () => {
        setScreens([...screens, { id: `screen_${Date.now()}`, title: 'New Screen', layout: { type: 'SingleColumnLayout', children: [{ type: 'Footer', label: 'Continue', 'on-click-action': { name: 'complete' } }]}}]);
        setActiveScreenIndex(screens.length);
    }
    const removeScreen = (indexToRemove: number) => {
        setScreens(screens.filter((_, i) => i !== indexToRemove));
        setActiveScreenIndex(Math.max(0, indexToRemove - 1));
    }
    
    const isEndpointFlow = templateType.startsWith('endpoint-');

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
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>1. General Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                             <div className="space-y-2">
                                <Label htmlFor="name">Flow Name</Label>
                                <Input id="name" value={flowName} onChange={e => setFlowName(e.target.value)} placeholder="e.g., lead_capture_flow" required/>
                                <p className="text-xs text-muted-foreground">Lowercase letters and underscores only.</p>
                            </div>
                             <div className="space-y-2">
                                <Label>Category</Label>
                                <Select value={category} onValueChange={setCategory}>
                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        {flowCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>2. Choose a Template</CardTitle>
                            <CardDescription>Select a starting point for your flow.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                             <Tabs defaultValue="no-endpoint" onValueChange={setTemplateType}>
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="default">Without Endpoint</TabsTrigger>
                                    <TabsTrigger value="endpoint-leadgen">With Endpoint</TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>3. Build Screens</CardTitle>
                            <CardDescription>Design the screens and logic for your flow.</CardDescription>
                        </CardHeader>
                         <CardContent>
                            <div className="flex items-center gap-2 mb-4 border-b">
                                <ScrollArea className="w-full whitespace-nowrap">
                                    <div className="flex items-center gap-1 pb-2">
                                    {screens.map((screen, index) => (
                                        <div key={screen.id || index} className="relative group">
                                            <Button variant={activeScreenIndex === index ? 'secondary' : 'ghost'} onClick={() => setActiveScreenIndex(index)} className="pr-7">{screen.title || `Screen ${index + 1}`}</Button>
                                            {screens.length > 1 && <Button variant="ghost" size="icon" className="absolute top-1/2 -translate-y-1/2 right-0 h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => removeScreen(index)}><X className="h-3 w-3"/></Button>}
                                        </div>
                                    ))}
                                    <Button variant="outline" size="icon" onClick={addScreen}><Plus className="h-4 w-4"/></Button>
                                    </div>
                                    <ScrollBar orientation="horizontal" />
                                </ScrollArea>
                            </div>
                            <ScreenEditor screens={screens} setScreens={setScreens} activeScreenIndex={activeScreenIndex} setActiveScreenIndex={setActiveScreenIndex} />
                        </CardContent>
                    </Card>
                </div>
                
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
