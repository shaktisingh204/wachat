

'use client';

import { useActionState, useEffect, useState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, LoaderCircle, Save, Info, UserRound, Mail, Phone, MessageSquareText, Edit, Code, Star, CheckSquare, Calendar, ChevronsRight } from 'lucide-react';
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
    { id: 'LEAD_GENERATION', name: 'Lead Generation', desc: 'Collect user info like name, email, etc. Common in ads and sign-up.', endpoint: false },
    { id: 'SIGN_UP', name: 'Sign Up', desc: 'User registration flows.', endpoint: true },
    { id: 'SIGN_IN', name: 'Sign In', desc: 'User authentication flows.', endpoint: true },
    { id: 'APPOINTMENT_BOOKING', name: 'Appointment Booking', desc: 'Book or reschedule appointments. Often used in clinics, salons, etc.', endpoint: true },
    { id: 'PRODUCT_RECOMMENDATION', name: 'Product Recommendation', desc: 'Helps users select or configure a product (e.g., choose a phone model, size, etc.).', endpoint: false },
    { id: 'ORDER_TRACKING', name: 'Order Tracking', desc: 'Allow users to get delivery status or updates.', endpoint: true },
    { id: 'FEEDBACK_COLLECTION', name: 'Feedback Collection', desc: 'Survey-style flows to gather user feedback, ratings, or suggestions.', endpoint: false },
    { id: 'SURVEY', name: 'Survey', desc: 'Simple questionnaire for research, customer satisfaction, or reviews.', endpoint: false },
    { id: 'APPLICATION_PROCESS', name: 'Application Process', desc: 'Step-by-step input for job or service applications (e.g., loan, credit card, etc.).', endpoint: true },
    { id: 'SUBSCRIPTION_MANAGEMENT', name: 'Subscription Management', desc: 'Lets users opt-in/out of updates, notifications, or newsletters.', endpoint: false },
    { id: 'CONTACT_US', name: 'Contact Us', desc: 'General contact forms.', endpoint: false },
    { id: 'OTHER', name: 'Other (Custom JSON)', desc: 'A general-purpose category for advanced users.', endpoint: true },
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

function CustomJsonEditor({ json, onJsonChange, category }: { json: string; onJsonChange: (json: string) => void; category?: any }) {
    return (
        <div className="space-y-2">
            <Label htmlFor="flow_data">Flow JSON</Label>
            <Textarea 
                id="flow_data"
                name="flow_data_editor"
                required
                className="font-mono text-xs min-h-[50vh]"
                value={json}
                onChange={(e) => onJsonChange(e.target.value)}
            />
        </div>
    );
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
            default: return <CustomJsonEditor json={flowJson} onJsonChange={setFlowJson} />;
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
                                <Label htmlFor="endpoint_uri">Endpoint URI (Required)</Label>
                                <Input id="endpoint_uri" name="endpoint_uri" placeholder="https://your-server.com/api/flow" />
                                <p className="text-xs text-muted-foreground">This flow type requires a server endpoint to function.</p>
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
                            Advanced: View/Edit Raw JSON
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                        <CustomJsonEditor json={flowJson} onJsonChange={setFlowJson} />
                    </AccordionContent>
                </AccordionItem>
            </Accordion>


            <div className="flex justify-end">
                <SubmitButton/>
            </div>
        </form>
    );
}
