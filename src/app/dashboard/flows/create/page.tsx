
'use client';

import { Suspense, useActionState, useEffect, useState, useTransition, useCallback } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, LoaderCircle, Save, FileJson, Plus, Trash2, Settings, Server, Check, ChevronsUpDown, Switch as SwitchIcon, GitBranch, MessageSquare, Image as ImageIcon, CaseSensitive, Calendar, List, Link as LinkIcon, Hand, Footprints, MousePointerClick, FileUp, Heading1, PanelLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { saveMetaFlow, getMetaFlowById } from '@/app/actions/meta-flow.actions';
import { declarativeFlowComponents, flowCategories, type DeclarativeUIComponent } from '@/components/wabasimplify/meta-flow-templates';
import { MetaFlowPreview } from '@/components/wabasimplify/meta-flow-preview';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import type { WithId } from 'mongodb';
import type { MetaFlow } from '@/lib/definitions';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ComponentEditor } from '@/components/wabasimplify/meta-flow-editor/component-editor';


const createFlowInitialState = { message: null, error: null, payload: null };

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    const buttonText = isEditing ? 'Update Flow' : 'Save & Publish Flow';
    return (
        <Button type="submit" disabled={pending} size="lg">
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
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

function AddComponentDialog({ isOpen, onOpenChange, onAddComponent }: { isOpen: boolean, onOpenChange: (open: boolean) => void, onAddComponent: (type: DeclarativeUIComponent['type']) => void }) {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Add a Component</DialogTitle>
                    <DialogDescription>Select a component to add to the current screen.</DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[70vh]">
                   <Accordion type="multiple" defaultValue={declarativeFlowComponents.map(c => c.name)} className="w-full">
                        {declarativeFlowComponents.map(category => (
                            <AccordionItem value={category.name} key={category.name}>
                                <AccordionTrigger className="text-lg font-semibold px-2 py-3">{category.name}</AccordionTrigger>
                                <AccordionContent className="p-2">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {category.components.map(component => {
                                            const Icon = component.icon || Heading1;
                                            return (
                                                 <button 
                                                    key={component.type} 
                                                    onClick={() => {
                                                        onAddComponent(component.type);
                                                        onOpenChange(false);
                                                    }}
                                                    className="p-4 border rounded-lg text-left hover:bg-accent hover:border-primary transition-all space-y-2 h-full flex flex-col card-gradient card-gradient-green"
                                                    >
                                                        <Icon className="h-6 w-6 text-primary" />
                                                        <p className="font-semibold flex-grow">{component.label}</p>
                                                        <p className="text-xs text-muted-foreground">{component.description}</p>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}

const generateScreenId = () => {
    let result = 'SCREEN_';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const charactersLength = characters.length;
    for (let i = 0; i < 8; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
};

const inputComponentTypes: DeclarativeUIComponent['type'][] = [
    'TextInput', 'TextArea', 'DatePicker', 'CalendarPicker', 'Dropdown', 'RadioButtonsGroup', 'CheckboxGroup', 'ChipsSelector', 'PhotoPicker', 'DocumentPicker', 'OptIn', 'Switch'
];

function CreateMetaFlowPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const [state, formAction] = useActionState(saveMetaFlow, createFlowInitialState);

    const [projectId, setProjectId] = useState<string | null>(null);
    const [flowName, setFlowName] = useState('New Interactive Flow');
    const [category, setCategory] = useState('');
    const [publishOnSave, setPublishOnSave] = useState(true);
    const [flowData, setFlowData] = useState<any>({ version: '7.1', screens: [], routing_model: {} });
    const [flowId, setFlowId] = useState<string | null>(null);
    const [metaId, setMetaId] = useState<string | null>(null);
    const [isLoading, startLoadingTransition] = useTransition();

    const [selectedScreenId, setSelectedScreenId] = useState<string | null>(null);
    const [editingComponent, setEditingComponent] = useState<any>(null);
    const [isComponentEditorOpen, setIsComponentEditorOpen] = useState(false);
    const [isAddComponentOpen, setIsAddComponentOpen] = useState(false);

    const isEditing = !!flowId;

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);

        const flowIdParam = searchParams.get('flowId');
        if (flowIdParam) {
            setFlowId(flowIdParam);
            startLoadingTransition(async () => {
                const fetchedFlow = await getMetaFlowById(flowIdParam);
                if (fetchedFlow) {
                    setFlowName(fetchedFlow.name);
                    setCategory(fetchedFlow.categories?.[0] || '');
                    setFlowData(fetchedFlow.flow_data || { version: '7.1', screens: [], routing_model: {} });
                    setMetaId(fetchedFlow.metaId);
                    if (fetchedFlow.flow_data?.screens?.[0]) {
                        setSelectedScreenId(fetchedFlow.flow_data.screens[0].id);
                    }
                } else {
                    toast({ title: 'Error', description: 'Could not load the requested flow.', variant: 'destructive' });
                    router.push('/dashboard/flows');
                }
            });
        }
    }, [searchParams, router, toast]);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            router.push('/dashboard/flows');
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, router, toast]);
    
    const updateComponent = (updatedComponent: any) => {
        const newFlowData = JSON.parse(JSON.stringify(flowData));
        const screen = newFlowData.screens.find((s:any) => s.id === selectedScreenId);
        if (screen) {
            let container = screen.layout.children.find((c:any) => c.type === 'Form' || c.type === 'NavigationList');
            if (container) {
                if (!container.children) container.children = [];
                const componentIndex = container.children.findIndex((c:any) => c.name === updatedComponent.name);
                if (componentIndex > -1) {
                    container.children[componentIndex] = updatedComponent;
                } else {
                     container.children.push(updatedComponent);
                }
            }
        }
        setFlowData(newFlowData);
        closeComponentEditor();
    };

    const addScreen = () => {
        const newScreenId = generateScreenId();
        const newScreen = {
            id: newScreenId,
            title: 'New Screen',
            layout: {
                type: 'SingleColumnLayout',
                children: [
                    { type: 'Form', name: `${newScreenId}_FORM`, children: [] }
                ]
            }
        };
        const newFlowData = { ...flowData };
        newFlowData.screens = [...newFlowData.screens, newScreen];
        if (!newFlowData.routing_model[newScreenId]) {
            newFlowData.routing_model[newScreenId] = [];
        }
        setFlowData(newFlowData);
        setSelectedScreenId(newScreenId);
    };
    
    const removeScreen = (screenId: string) => {
        const newFlowData = { ...flowData };
        newFlowData.screens = newFlowData.screens.filter((s:any) => s.id !== screenId);
        delete newFlowData.routing_model[screenId];
        Object.keys(newFlowData.routing_model).forEach(key => {
            newFlowData.routing_model[key] = newFlowData.routing_model[key].filter((id:string) => id !== screenId);
        });
        setFlowData(newFlowData);
        if (selectedScreenId === screenId) {
            setSelectedScreenId(newFlowData.screens[0]?.id || null);
        }
    };
    
    const addComponent = (type: DeclarativeUIComponent['type']) => {
        if (!selectedScreenId) return;

        const isInputComponent = inputComponentTypes.some(t => type === t);
        const newComponent: any = { type };
        
        if (isInputComponent) {
            newComponent.name = `${type.toLowerCase()}_${Date.now()}`;
        }
        
        // Set defaults based on type
        if (type.startsWith('Text')) {
            newComponent.text = `New ${type}`;
        } else if (type !== 'Footer' && type !== 'If' && type !== 'Switch' && type !== 'Image') {
             newComponent.label = `New ${type}`;
        }
        
        const newFlowData = JSON.parse(JSON.stringify(flowData));
        const screen = newFlowData.screens.find((s:any) => s.id === selectedScreenId);
        if (screen) {
            let container = screen.layout.children.find((c:any) => c.type === 'Form');
            if (!container) {
                container = { type: 'Form', name: `${selectedScreenId}_FORM`, children: [] };
                screen.layout.children.push(container);
            }
            if (!container.children) container.children = [];
            container.children.push(newComponent);
            setFlowData(newFlowData);
        }
    };

    const removeComponent = (componentName: string) => {
        if (!selectedScreenId) return;
        const newFlowData = JSON.parse(JSON.stringify(flowData));
        const screen = newFlowData.screens.find((s:any) => s.id === selectedScreenId);
        if (screen) {
            const container = screen.layout.children.find((c:any) => c.type === 'Form' || c.type === 'NavigationList');
            if (container) {
                container.children = container.children.filter((c:any) => c.name !== componentName);
                setFlowData(newFlowData);
            }
        }
    };

    const openComponentEditor = (component: any) => {
        setEditingComponent(component);
        setIsComponentEditorOpen(true);
    };
    
    const closeComponentEditor = () => {
        setEditingComponent(null);
        setIsComponentEditorOpen(false);
    };

    if (isLoading) {
        return <PageSkeleton />;
    }

    const currentScreenForEditor = flowData.screens?.find((s: any) => s.id === selectedScreenId);
    
    return (
        <Suspense fallback={<PageSkeleton />}>
            {editingComponent && <ComponentEditor component={editingComponent} onSave={updateComponent} isOpen={isComponentEditorOpen} onOpenChange={setIsComponentEditorOpen} allScreens={flowData?.screens || []} />}
            <AddComponentDialog isOpen={isAddComponentOpen} onOpenChange={setIsAddComponentOpen} onAddComponent={addComponent} />

            <form action={formAction}>
                 {projectId && <input type="hidden" name="projectId" value={projectId} />}
                {flowId && <input type="hidden" name="flowId" value={flowId} />}
                {metaId && <input type="hidden" name="metaId" value={metaId} />}
                <input type="hidden" name="flow_data" value={JSON.stringify(flowData, null, 2)} />
                <input type="hidden" name="publish" value={publishOnSave ? 'on' : 'off'} />

                <div className="space-y-6">
                    <div>
                        <Button variant="ghost" asChild className="mb-2 -ml-4">
                            <Link href="/dashboard/flows"><ChevronLeft className="mr-2 h-4 w-4" />Back to Flows</Link>
                        </Button>
                        <h1 className="text-3xl font-bold font-headline">{isEditing ? 'Edit Meta Flow' : 'Create New Meta Flow'}</h1>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                        <div className="space-y-6">
                            <Card className="p-2 card-gradient card-gradient-green">
                                <CardHeader className="p-4">
                                    <CardTitle>Flow Configuration</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6 p-4">
                                     <div className="space-y-2">
                                        <Label htmlFor="flowName">Flow Name</Label>
                                        <Input id="flowName" name="flowName" value={flowName} onChange={(e) => setFlowName(e.target.value)} required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="category">Category</Label>
                                        <Select name="category" value={category} onValueChange={setCategory} required>
                                            <SelectTrigger id="category"><SelectValue placeholder="Select a category..."/></SelectTrigger>
                                            <SelectContent>{flowCategories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex items-center space-x-2 pt-2">
                                        <Switch id="publishOnSave" checked={publishOnSave} onCheckedChange={setPublishOnSave} />
                                        <Label htmlFor="publishOnSave">Publish immediately after saving</Label>
                                    </div>
                                </CardContent>
                            </Card>

                            <Accordion type="single" collapsible defaultValue="screens">
                                <AccordionItem value="screens">
                                    <AccordionTrigger className="text-base font-semibold px-4 py-3">Screens</AccordionTrigger>
                                    <AccordionContent className="space-y-3 p-4">
                                        {flowData.screens?.map((screen: any) => (
                                             <div key={screen.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted">
                                                <Button variant={selectedScreenId === screen.id ? 'default' : 'ghost'} className="flex-1 justify-start" onClick={() => setSelectedScreenId(screen.id)}>{screen.title || screen.id}</Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeScreen(screen.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                            </div>
                                        ))}
                                        <Button variant="outline" className="w-full" onClick={addScreen}><Plus className="mr-2 h-4 w-4"/>Add Screen</Button>
                                    </AccordionContent>
                                </AccordionItem>
                                 <AccordionItem value="settings">
                                    <AccordionTrigger className="text-base font-semibold px-4 py-3">Screen Settings</AccordionTrigger>
                                    <AccordionContent className="space-y-6 p-4">
                                       {currentScreenForEditor ? (
                                        <>
                                            <div className="space-y-2"><Label>Screen ID</Label><Input value={currentScreenForEditor.id} readOnly disabled/></div>
                                            <div className="space-y-2"><Label>Screen Title</Label><Input value={currentScreenForEditor.title} onChange={e => {
                                                const newFlowData = {...flowData};
                                                const screen = newFlowData.screens.find((s:any) => s.id === selectedScreenId);
                                                if(screen) screen.title = e.target.value;
                                                setFlowData(newFlowData);
                                            }}/></div>
                                        </>
                                       ) : <p className="text-sm text-muted-foreground">Select a screen to see its settings.</p>}
                                    </AccordionContent>
                                </AccordionItem>
                                <AccordionItem value="components">
                                     <AccordionTrigger className="text-base font-semibold px-4 py-3">Components</AccordionTrigger>
                                     <AccordionContent className="space-y-3 p-4">
                                        {currentScreenForEditor ? (
                                            <>
                                                {(currentScreenForEditor.layout.children.find((c:any) => c.type === 'Form' || c.type === 'NavigationList')?.children || []).map((comp:any, index:number) => (
                                                     <div key={comp.name || index} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted">
                                                         <p className="flex-1 text-sm">{comp.label || comp.text || comp.name || comp.type}</p>
                                                         <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openComponentEditor(comp)}><Settings className="h-4 w-4"/></Button>
                                                         <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeComponent(comp.name)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                                     </div>
                                                ))}
                                                <Button variant="outline" className="w-full" onClick={() => setIsAddComponentOpen(true)}><Plus className="mr-2 h-4 w-4"/>Add Component</Button>
                                            </>
                                        ): <p className="text-sm text-muted-foreground p-4">Select a screen to add components.</p>}
                                     </AccordionContent>
                                </AccordionItem>
                                <AccordionItem value="json">
                                    <AccordionTrigger className="text-base font-semibold px-4 py-3">Raw JSON</AccordionTrigger>
                                    <AccordionContent className="p-4"><Textarea value={JSON.stringify(flowData, null, 2)} onChange={(e) => { try { const parsed = JSON.parse(e.target.value); setFlowData(parsed); } catch(err) {/* ignore */} }} className="h-96 font-mono text-xs" /></AccordionContent>
                                </AccordionItem>
                            </Accordion>

                             <div className="flex justify-end pt-4">
                                <SubmitButton isEditing={isEditing} />
                            </div>
                        </div>

                        <div className="hidden lg:block">
                            <MetaFlowPreview flowJson={JSON.stringify(flowData)} />
                        </div>
                    </div>
                </div>
            </form>
        </Suspense>
    );
}

export default function CreateMetaFlowPage() {
    return (
        <Suspense fallback={<PageSkeleton />}>
            <CreateMetaFlowPageContent />
        </Suspense>
    );
}
