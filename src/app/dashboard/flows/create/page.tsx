
'use client';

import { useActionState, useEffect, useState, useRef, useCallback } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, LoaderCircle, Save, FileJson, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { saveMetaFlow } from '@/app/actions/meta-flow.actions';
import { getTemplateScreens, flowCategories } from '@/components/wabasimplify/meta-flow-templates';
import { MetaFlowPreview } from '@/components/wabasimplify/meta-flow-preview';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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

const TemplateForm = ({ template, formData, setFormData, onJsonChange }) => {
     useEffect(() => {
        const generatedJson = {
            version: "3.0",
            data_api_version: "3.0",
            screens: template.screens.map(screen => ({
                ...screen,
                layout: {
                    ...screen.layout,
                    children: screen.layout.children.map(child => {
                        if (child.type === 'TextHeading' || child.type === 'TextBody') {
                            return { ...child, text: formData[child.text_key] || child.text };
                        }
                         if (child.type === 'Footer') {
                            return { ...child, label: formData[child.label_key] || child.label };
                        }
                        return child;
                    })
                }
            }))
        };
        onJsonChange(JSON.stringify(generatedJson, null, 2));
    }, [formData, template, onJsonChange]);

    return (
        <div className="space-y-4">
            {template.fields.map(field => (
                <div key={field.key} className="space-y-2">
                    <Label htmlFor={field.key}>{field.label}</Label>
                    <Input 
                        id={field.key} 
                        value={formData[field.key] || ''}
                        onChange={e => setFormData(prev => ({...prev, [field.key]: e.target.value}))}
                        placeholder={field.placeholder}
                    />
                </div>
            ))}
        </div>
    );
}

export default function CreateMetaFlowPage() {
    const [projectId, setProjectId] = useState<string | null>(null);
    const [state, formAction] = useActionState(saveMetaFlow, createFlowInitialState);
    const { toast } = useToast();
    const router = useRouter();

    const [flowName, setFlowName] = useState('new_flow');
    const [endpointUri, setEndpointUri] = useState('');
    const [category, setCategory] = useState('LEAD_GENERATION');
    const [flowJson, setFlowJson] = useState('');
    const [isEndpointFlow, setIsEndpointFlow] = useState(false);

    const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>('default-interest');
    const [formData, setFormData] = useState({});

    const templates = getTemplateScreens();

    const onTemplateChange = (key: string) => {
        setSelectedTemplateKey(key);
        setFormData({});
    };

    const selectedTemplate = templates.find(t => t.key === selectedTemplateKey);

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
                                <Select value={category} onValueChange={(val) => setCategory(val as any)}>
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
                            <CardTitle>2. Choose Template & Edit Content</CardTitle>
                            <CardDescription>Select a use-case and customize the content.</CardDescription>
                        </CardHeader>
                         <CardContent>
                             <Tabs defaultValue="no-endpoint" className="w-full" onValueChange={(val) => setIsEndpointFlow(val === 'endpoint')}>
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="no-endpoint">Without Endpoint</TabsTrigger>
                                    <TabsTrigger value="endpoint">With Endpoint</TabsTrigger>
                                </TabsList>
                                <TabsContent value="no-endpoint" className="mt-4">
                                    <div className="space-y-4">
                                        <Select onValueChange={onTemplateChange} defaultValue="default-interest">
                                            <SelectTrigger><SelectValue/></SelectTrigger>
                                            <SelectContent>
                                                {templates.filter(t => !t.endpoint).map(t => <SelectItem key={t.key} value={t.key}>{t.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        {selectedTemplate && <TemplateForm template={selectedTemplate} formData={formData} setFormData={setFormData} onJsonChange={setFlowJson} />}
                                    </div>
                                </TabsContent>
                                <TabsContent value="endpoint" className="mt-4">
                                     <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="endpoint_uri">Endpoint URI</Label>
                                            <Input id="endpoint_uri" value={endpointUri} onChange={e => setEndpointUri(e.target.value)} placeholder="https://your-server.com/api/flow" required/>
                                            <p className="text-xs text-muted-foreground">Your server must handle requests from this flow.</p>
                                        </div>
                                        <Separator/>
                                        <Select onValueChange={onTemplateChange} defaultValue="endpoint-leadgen">
                                            <SelectTrigger><SelectValue/></SelectTrigger>
                                            <SelectContent>
                                                {templates.filter(t => t.endpoint).map(t => <SelectItem key={t.key} value={t.key}>{t.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        {selectedTemplate && <TemplateForm template={selectedTemplate} formData={formData} setFormData={setFormData} onJsonChange={setFlowJson}/>}
                                    </div>
                                </TabsContent>
                            </Tabs>
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

