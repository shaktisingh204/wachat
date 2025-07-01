
'use client';

import { useActionState, useEffect, useState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, LoaderCircle, Save, GripVertical, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { saveMetaFlow } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle } from 'lucide-react';

const createFlowInitialState = {
  message: null,
  error: null,
};

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save & Publish Flow
        </Button>
    )
}

const categories = [
    { id: 'LEAD_GENERATION', name: 'Lead Generation', desc: 'Collect user info like name, email, etc.', needsEndpoint: true },
    { id: 'CUSTOMER_SUPPORT', name: 'Customer Support', desc: 'Structured support interactions.', needsEndpoint: true },
    { id: 'APPOINTMENT_BOOKING', name: 'Appointment Booking', desc: 'Book or reschedule appointments.', needsEndpoint: true },
    { id: 'PRODUCT_RECOMMENDATION', name: 'Product Recommendation', desc: 'Help users select or configure a product.', needsEndpoint: false },
    { id: 'ORDER_TRACKING', name: 'Order Tracking', desc: 'Get delivery status or updates.', needsEndpoint: true },
    { id: 'ONBOARDING', name: 'Onboarding', desc: 'Multi-step guidance for new users.', needsEndpoint: true },
    { id: 'FEEDBACK_COLLECTION', name: 'Feedback Collection', desc: 'Survey-style flows to gather feedback.', needsEndpoint: false },
    { id: 'APPLICATION_PROCESS', name: 'Application Process', desc: 'Step-by-step input for applications.', needsEndpoint: true },
    { id: 'SUBSCRIPTION_MANAGEMENT', name: 'Subscription Management', desc: 'Lets users opt-in/out of updates.', needsEndpoint: false },
    { id: 'SURVEY', name: 'Survey', desc: 'Simple questionnaire for research.', needsEndpoint: false },
    { id: 'SIGN_UP', name: 'Sign Up', desc: 'User registration flows.', needsEndpoint: true },
    { id: 'SIGN_IN', name: 'Sign In', desc: 'User authentication flows.', needsEndpoint: true },
    { id: 'OTHER', name: 'Other', desc: 'A general-purpose category.', needsEndpoint: true },
];

type FormElement = {
    id: number;
    type: 'TextHeading' | 'TextInput' | 'DatePicker' | 'RadioButtons';
    label: string;
    name: string;
    required: boolean;
    options: string;
};

function GenericFlowForm({ onJsonChange, category }: { onJsonChange: (json: string) => void, category: string }) {
    const [title, setTitle] = useState("Custom Form");
    const [elements, setElements] = useState<FormElement[]>([]);
    const [submitLabel, setSubmitLabel] = useState("Submit");
    
    useEffect(() => {
        const formChildren: any[] = elements.map(el => {
            const base: any = { type: el.type, label: el.label, name: el.name };
            if (el.type !== 'TextHeading') {
                base.required = el.required;
            }
            if (el.type === 'RadioButtons' && el.options) {
                base['data-source'] = el.options.split(',').map(opt => ({ id: opt.trim().toLowerCase().replace(/\s+/g, '_'), title: opt.trim() }));
            }
            if (el.type === 'TextInput' && (el.name.includes('email') || el.name.includes('phone') || el.name.includes('password'))) {
                base['input-type'] = el.name.includes('email') ? 'email' : el.name.includes('phone') ? 'phone' : 'password';
            }
            return base;
        });

        formChildren.push({ type: 'Footer', label: submitLabel, 'on-click-action': { name: 'complete', payload: {} } });
        const json = { version: "3.0", data_api_version: "3.0", routing_model: {}, screens: [{ id: "CUSTOM_SCREEN", title: title, data: {}, layout: { type: 'SingleColumnLayout', children: [{ type: 'Form', name: `${category.toLowerCase()}_form`, children: formChildren }] } }] };
        onJsonChange(JSON.stringify(json, null, 2));
    }, [title, elements, submitLabel, onJsonChange, category]);

    const addElement = (type: FormElement['type']) => {
        setElements(prev => [...prev, { id: Date.now(), type, label: '', name: '', required: false, options: '' }]);
    };
    
    const updateElement = (id: number, field: string, value: string | boolean) => {
        setElements(prev => prev.map(el => el.id === id ? { ...el, [field]: value } : el));
    };

    const removeElement = (id: number) => {
        setElements(prev => prev.filter(el => el.id !== id));
    };

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Screen Title</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Customer Survey" />
            </div>
            <Separator/>
             <div className="space-y-2">
                <Label>Form Fields</Label>
                <div className="space-y-2">
                    {elements.map(el => (
                        <div key={el.id} className="p-4 border rounded-lg bg-background space-y-3 relative">
                            <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={() => removeElement(el.id)}><Trash2 className="h-4 w-4"/></Button>
                            <div className="flex items-center gap-2">
                                <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab"/>
                                <Badge variant="secondary">{el.type.replace(/([A-Z])/g, ' $1').trim()}</Badge>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2"><Label>Label</Label><Input value={el.label} onChange={e => updateElement(el.id, 'label', e.target.value)} placeholder="e.g., Your Full Name" /></div>
                                <div className="space-y-2"><Label>Name (variable)</Label><Input value={el.name} onChange={e => updateElement(el.id, 'name', e.target.value)} placeholder="e.g., user_name" /></div>
                            </div>
                             {el.type === 'RadioButtons' && <div className="space-y-2"><Label>Options (comma-separated)</Label><Input value={el.options} onChange={e => updateElement(el.id, 'options', e.target.value)} placeholder="Option 1, Option 2" /></div>}
                            {el.type !== 'TextHeading' && (
                                <div className="flex items-center space-x-2"><Checkbox checked={el.required} onCheckedChange={checked => updateElement(el.id, 'required', !!checked)}/><Label className="font-normal">Required</Label></div>
                            )}
                        </div>
                    ))}
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => addElement('TextHeading')}><Plus className="mr-2 h-4 w-4"/>Heading</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => addElement('TextInput')}><Plus className="mr-2 h-4 w-4"/>Text Input</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => addElement('DatePicker')}><Plus className="mr-2 h-4 w-4"/>Date Picker</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => addElement('RadioButtons')}><Plus className="mr-2 h-4 w-4"/>Radio Buttons</Button>
                </div>
            </div>
            <Separator/>
            <div className="space-y-2">
                <Label>Submit Button Label</Label>
                <Input value={submitLabel} onChange={e => setSubmitLabel(e.target.value)} placeholder="Submit"/>
            </div>
        </div>
    )
}

export default function CreateMetaFlowPage() {
    const [projectId, setProjectId] = useState<string | null>(null);
    const [isClient, setIsClient] = useState(false);
    const [state, formAction] = useActionState(saveMetaFlow, createFlowInitialState);
    const { toast } = useToast();
    const router = useRouter();

    const [activeTab, setActiveTab] = useState('without-endpoint');
    const [selectedCategory, setSelectedCategory] = useState('LEAD_GENERATION');
    const [flowJson, setFlowJson] = useState('');

    useEffect(() => {
        setIsClient(true);
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
    }, []);

    useEffect(() => {
        if(state?.message) {
            toast({ title: 'Success', description: state.message });
            router.push('/dashboard/flows');
        }
        if(state?.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router]);


    if (!isClient) {
        return <Skeleton className="h-screen w-full" />
    }

    if (!projectId) {
        return (
             <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>
                    Please select a project from the main dashboard before creating a Meta Flow.
                </AlertDescription>
            </Alert>
        );
    }
    
    return (
        <form action={formAction} className="space-y-6">
            <input type="hidden" name="projectId" value={projectId}/>
            <input type="hidden" name="category" value={selectedCategory} />
            <input type="hidden" name="flow_data" value={flowJson} />

            <div>
                <Button variant="ghost" asChild className="mb-4 -ml-4">
                  <Link href="/dashboard/flows">
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Back to Meta Flows
                  </Link>
                </Button>
                <h1 className="text-3xl font-bold font-headline">Create New Meta Flow</h1>
                <p className="text-muted-foreground mt-2">Build interactive forms and experiences for your customers.</p>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>1. General Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                     <div className="space-y-2">
                        <Label htmlFor="name">Flow Name</Label>
                        <Input id="name" name="name" placeholder="e.g., lead_capture_flow" required/>
                        <p className="text-xs text-muted-foreground">Lowercase letters and underscores only.</p>
                    </div>
                    <div className="space-y-2">
                        <Label>Flow Category</Label>
                        <RadioGroup value={selectedCategory} onValueChange={setSelectedCategory} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {categories.map(cat => (
                                <div key={cat.id}>
                                    <RadioGroupItem value={cat.id} id={cat.id} className="sr-only" />
                                    <Label htmlFor={cat.id} className={`flex flex-col items-center justify-center rounded-md border-2 p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer text-center h-full ${selectedCategory === cat.id ? 'border-primary' : 'border-muted'}`}>
                                        <span className="font-semibold text-sm">{cat.name}</span>
                                    </Label>
                                </div>
                            ))}
                        </RadioGroup>
                    </div>
                </CardContent>
            </Card>

            <Card>
                 <CardHeader>
                    <CardTitle>2. Build Your Flow</CardTitle>
                </CardHeader>
                <CardContent>
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                      <TabsList>
                        <TabsTrigger value="without-endpoint">Simple Flow (No Endpoint)</TabsTrigger>
                        <TabsTrigger value="with-endpoint">Data Exchange Flow (With Endpoint)</TabsTrigger>
                      </TabsList>
                      <TabsContent value="without-endpoint" className="pt-4">
                          <GenericFlowForm onJsonChange={setFlowJson} category={selectedCategory} />
                      </TabsContent>
                      <TabsContent value="with-endpoint" className="pt-4 space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="endpoint_uri">Endpoint URI</Label>
                            <Input id="endpoint_uri" name="endpoint_uri" placeholder="https://your-server.com/api/flow" />
                            <p className="text-xs text-muted-foreground">The endpoint to send flow data to for processing.</p>
                          </div>
                          <Separator/>
                          <GenericFlowForm onJsonChange={setFlowJson} category={selectedCategory} />
                      </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <SubmitButton/>
            </div>
        </form>
    );
}
