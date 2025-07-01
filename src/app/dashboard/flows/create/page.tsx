
'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, LoaderCircle, Save, Info, UserRound, Mail, Phone, MessageSquareText, Edit, Code, Star, CheckSquare, Calendar, ChevronsRight, GripVertical, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { saveMetaFlow } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';

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
    { id: 'LEAD_GENERATION', name: 'Lead Generation', desc: 'Collect user info like name, email, etc. Common in ads and sign-up.', endpoint: true },
    { id: 'CUSTOMER_SUPPORT', name: 'Customer Support', desc: 'For structured support interactions, like selecting issue type, entering order ID, etc.', endpoint: true },
    { id: 'APPOINTMENT_BOOKING', name: 'Appointment Booking', desc: 'Book or reschedule appointments or time slots. Often used in clinics, salons, etc.', endpoint: true },
    { id: 'PRODUCT_RECOMMENDATION', name: 'Product Recommendation', desc: 'Helps users select or configure a product (e.g., choose a phone model, size, etc.).', endpoint: false },
    { id: 'ORDER_TRACKING', name: 'Order Tracking', desc: 'Allows users to input order details and get delivery status or updates.', endpoint: true },
    { id: 'ONBOARDING', name: 'Onboarding', desc: 'Multi-step guidance for new users (e.g., app signup, product setup, etc.).', endpoint: true },
    { id: 'FEEDBACK_COLLECTION', name: 'Feedback Collection', desc: 'Survey-style flows to gather user feedback, ratings, or suggestions.', endpoint: false },
    { id: 'APPLICATION_PROCESS', name: 'Application Process', desc: 'Step-by-step input for job or service applications (e.g., loan, credit card, etc.).', endpoint: true },
    { id: 'SUBSCRIPTION_MANAGEMENT', name: 'Subscription Management', desc: 'Lets users opt-in/out of updates, notifications, or newsletters.', endpoint: false },
    { id: 'SURVEY', name: 'Survey', desc: 'Simple questionnaire for research, customer satisfaction, or reviews.', endpoint: false },
    { id: 'SIGN_UP', name: 'Sign Up', desc: 'User registration flows.', endpoint: true },
    { id: 'SIGN_IN', name: 'Sign In', desc: 'User authentication flows.', endpoint: true },
    { id: 'OTHER', name: 'Other', desc: 'A general-purpose category for advanced users.', endpoint: true },
];

function LeadGenForm({ onJsonChange }: { onJsonChange: (json: string) => void }) {
    const [welcome, setWelcome] = useState("Welcome! Let's get your information.");
    const [fields, setFields] = useState({ name: true, email: true, phone: false });

    useEffect(() => {
        const formChildren: any[] = [{ type: 'TextHeading', text: welcome }];
        if (fields.name) formChildren.push({ type: 'TextInput', label: 'Full Name', name: 'name', required: true });
        if (fields.email) formChildren.push({ type: 'TextInput', label: 'Email', name: 'email', 'input-type': 'email' });
        if (fields.phone) formChildren.push({ type: 'TextInput', label: 'Phone', name: 'phone', 'input-type': 'phone' });
        formChildren.push({ type: 'Footer', label: 'Submit', 'on-click-action': { name: 'complete', payload: {} } });
        
        const json = { version: "3.0", data_api_version: "3.0", routing_model: {}, screens: [{ id: "LEAD_GEN_SCREEN", title: "Lead Generation", data: {}, layout: { type: 'SingleColumnLayout', children: [{ type: 'Form', name: 'lead_gen_form', children: formChildren }] } }] };
        onJsonChange(JSON.stringify(json, null, 2));
    }, [welcome, fields, onJsonChange]);

    return (
        <div className="space-y-4">
            <div className="space-y-2"><Label>Welcome Message</Label><Input value={welcome} onChange={e => setWelcome(e.target.value)} /></div>
            <div className="space-y-2"><Label>Fields to Include</Label><div className="flex flex-wrap gap-4">{Object.entries({name: 'Name', email: 'Email', phone: 'Phone'}).map(([key, label]) => <div key={key} className="flex items-center space-x-2"><Checkbox id={key} checked={fields[key as keyof typeof fields]} onCheckedChange={checked => setFields(f => ({...f, [key]: !!checked}))} /><Label htmlFor={key} className="font-normal">{label}</Label></div>)}</div></div>
        </div>
    );
}
function SignUpForm({ onJsonChange }: { onJsonChange: (json: string) => void }) {
    const [welcome, setWelcome] = useState("Create your account to get started.");
    
    useEffect(() => {
        const json = { version: "3.0", data_api_version: "3.0", routing_model: {}, screens: [{ id: "SIGN_UP_SCREEN", title: "Sign Up", data: {}, layout: { type: 'SingleColumnLayout', children: [{ type: 'Form', name: 'sign_up_form', children: [{ type: 'TextHeading', text: welcome }, { type: 'TextInput', label: 'Full Name', name: 'name', required: true }, { type: 'TextInput', label: 'Email', name: 'email', 'input-type': 'email', required: true }, { type: 'TextInput', label: 'Password', name: 'password', 'input-type': 'password', required: true }, { type: 'Footer', label: 'Sign Up', 'on-click-action': { name: 'complete', payload: {} } }] }] } }] };
        onJsonChange(JSON.stringify(json, null, 2));
    }, [welcome, onJsonChange]);

    return (
        <div className="space-y-2"><Label>Welcome Message</Label><Input value={welcome} onChange={e => setWelcome(e.target.value)} /></div>
    );
}

function FeedbackForm({ onJsonChange }: { onJsonChange: (json: string) => void }) {
    const [question, setQuestion] = useState("How would you rate your experience?");
    const [submitLabel, setSubmitLabel] = useState("Submit Feedback");

    useEffect(() => {
        const json = { version: "3.0", data_api_version: "3.0", routing_model: {}, screens: [{ id: "FEEDBACK_SCREEN", title: "Feedback", data: {}, layout: { type: 'SingleColumnLayout', children: [{ type: 'Form', name: 'feedback_form', children: [{ type: 'TextHeading', text: question }, { type: 'RadioButtons', name: 'rating', label: 'Rating', 'data-source': [{id: '5', title: 'Excellent'}, {id: '4', title: 'Good'}, {id: '3', title: 'Okay'}, {id: '2', title: 'Bad'}, {id: '1', title: 'Terrible'}]}, { type: 'TextInput', name: 'comments', label: 'Additional Comments (optional)' }, { type: 'Footer', label: submitLabel, 'on-click-action': { name: 'complete', payload: {} } }] }] } }] };
        onJsonChange(JSON.stringify(json, null, 2));
    }, [question, submitLabel, onJsonChange]);

    return (
        <div className="space-y-4">
             <div className="space-y-2"><Label>Main Question</Label><Input value={question} onChange={e => setQuestion(e.target.value)} /></div>
             <div className="space-y-2"><Label>Submit Button Label</Label><Input value={submitLabel} onChange={e => setSubmitLabel(e.target.value)} /></div>
        </div>
    );
}

function AppointmentForm({ onJsonChange }: { onJsonChange: (json: string) => void }) {
    const [welcome, setWelcome] = useState("Book an appointment");
    
    useEffect(() => {
        const json = { version: "3.0", data_api_version: "3.0", routing_model: {}, screens: [{ id: "APPOINTMENT_SCREEN", title: "Appointment", data: {}, layout: { type: 'SingleColumnLayout', children: [{ type: 'Form', name: 'appt_form', children: [{ type: 'TextHeading', text: welcome }, { type: 'DatePicker', name: 'appt_date', label: 'Select a Date' }, { type: 'TimePicker', name: 'appt_time', label: 'Select a Time' }, { type: 'TextInput', name: 'notes', label: 'Notes (optional)' }, { type: 'Footer', label: 'Book Appointment', 'on-click-action': { name: 'complete', payload: {} } }] }] } }] };
        onJsonChange(JSON.stringify(json, null, 2));
    }, [welcome, onJsonChange]);

    return (
        <div className="space-y-2"><Label>Welcome Message</Label><Input value={welcome} onChange={e => setWelcome(e.target.value)} /></div>
    );
}

function GenericFlowForm({ onJsonChange }: { onJsonChange: (json: string) => void; }) {
    const [title, setTitle] = useState("Custom Form");
    const [elements, setElements] = useState<{ id: number; type: string; label: string; name: string; required: boolean; options: string; }[]>([]);
    const [submitLabel, setSubmitLabel] = useState("Submit");
    
    useEffect(() => {
        const formChildren: any[] = elements.map(el => {
            const base: any = { type: el.type, label: el.label, name: el.name, required: el.required };
            if (el.type === 'RadioButtons' && el.options) {
                base['data-source'] = el.options.split(',').map(opt => ({ id: opt.trim().toLowerCase().replace(/\s+/g, '_'), title: opt.trim() }));
            }
            if (el.type === 'TextInput' && (el.name.includes('email') || el.name.includes('phone') || el.name.includes('password'))) {
                base['input-type'] = el.name.includes('email') ? 'email' : el.name.includes('phone') ? 'phone' : 'password';
            }
            return base;
        });

        formChildren.push({ type: 'Footer', label: submitLabel, 'on-click-action': { name: 'complete', payload: {} } });
        const json = { version: "3.0", data_api_version: "3.0", routing_model: {}, screens: [{ id: "CUSTOM_SCREEN", title: title, data: {}, layout: { type: 'SingleColumnLayout', children: [{ type: 'Form', name: 'custom_form', children: formChildren }] } }] };
        onJsonChange(JSON.stringify(json, null, 2));
    }, [title, elements, submitLabel, onJsonChange]);

    const addElement = (type: string) => {
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
                            <div className="flex items-center space-x-2"><Checkbox checked={el.required} onCheckedChange={checked => updateElement(el.id, 'required', !!checked)}/><Label>Required</Label></div>
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
    
    const renderFormForCategory = () => {
        switch (selectedCategory) {
            case 'LEAD_GENERATION': return <LeadGenForm onJsonChange={setFlowJson} />;
            case 'SIGN_UP': return <SignUpForm onJsonChange={setFlowJson} />;
            case 'FEEDBACK_COLLECTION': return <FeedbackForm onJsonChange={setFlowJson} />;
            case 'APPOINTMENT_BOOKING': return <AppointmentForm onJsonChange={setFlowJson} />;
            default: return <GenericFlowForm onJsonChange={setFlowJson} />;
        }
    };

    const needsEndpoint = categories.find(c => c.id === selectedCategory)?.endpoint;

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
                <p className="text-muted-foreground mt-2">Choose a category to start with a template, or select "Other" for a blank canvas.</p>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>1. Select Flow Category</CardTitle>
                </CardHeader>
                <CardContent>
                    <RadioGroup value={selectedCategory} onValueChange={setSelectedCategory} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {categories.map(cat => (
                            <div key={cat.id}>
                                <RadioGroupItem value={cat.id} id={cat.id} className="sr-only" />
                                <Label htmlFor={cat.id} className={`flex flex-col items-center justify-center rounded-md border-2 p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer text-center h-full ${selectedCategory === cat.id ? 'border-primary' : 'border-muted'}`}>
                                    <span className="font-semibold text-sm">{cat.name}</span>
                                    <span className="text-xs text-muted-foreground mt-1">{cat.desc}</span>
                                </Label>
                            </div>
                        ))}
                    </RadioGroup>
                </CardContent>
            </Card>

            <Card>
                 <CardHeader>
                    <CardTitle>2. Configure Your Flow</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Flow Name</Label>
                            <Input id="name" name="name" placeholder="e.g., lead_capture_flow" required/>
                            <p className="text-xs text-muted-foreground">Lowercase letters and underscores only.</p>
                        </div>
                        {needsEndpoint && (
                             <div className="space-y-2">
                                <Label htmlFor="endpoint_uri">Endpoint URI (Optional)</Label>
                                <Input id="endpoint_uri" name="endpoint_uri" placeholder="https://your-server.com/api/flow" />
                                <p className="text-xs text-muted-foreground">The endpoint to send flow data to.</p>
                            </div>
                        )}
                    </div>
                    <Separator/>
                    <div className="p-4 border rounded-md bg-muted/50">
                        {renderFormForCategory()}
                    </div>
                </CardContent>
            </Card>
            
            <Accordion type="single" collapsible>
                <AccordionItem value="json-editor">
                    <AccordionTrigger>
                        <div className="flex items-center gap-2">
                            <Code className="h-4 w-4"/>
                            Advanced: View Raw JSON
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                        <Textarea 
                            readOnly
                            className="font-mono text-xs min-h-[50vh] bg-background"
                            value={flowJson}
                        />
                    </AccordionContent>
                </AccordionItem>
            </Accordion>


            <div className="flex justify-end">
                <SubmitButton/>
            </div>
        </form>
    );
}
