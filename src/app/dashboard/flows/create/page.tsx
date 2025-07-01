
'use client';

import { useActionState, useEffect, useState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, LoaderCircle, Save, FileJson, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { saveMetaFlow } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
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

const templates = {
    withoutEndpoint: [
        { id: 'default', name: 'Default', category: 'OTHER', description: 'A simple, one-screen flow with a title and a completion button.'},
        { id: 'purchase_interest', name: 'Collect purchase interest', category: 'LEAD_GENERATION', description: 'Ask users which product they are interested in.'},
        { id: 'feedback', name: 'Get feedback', category: 'FEEDBACK_COLLECTION', description: 'A simple feedback form with a rating.'},
        { id: 'survey', name: 'Send a survey', category: 'SURVEY', description: 'Ask a few questions to survey your users.'},
        { id: 'support', name: 'Customer support', category: 'CUSTOMER_SUPPORT', description: 'Guide users through common support queries.'},
    ],
    withEndpoint: [
        { id: 'loan_credit', name: 'Get leads for a pre-approved loan/credit card', category: 'LEAD_GENERATION', description: 'Capture leads for financial products. Endpoint required.'},
        { id: 'insurance_quote', name: 'Provide insurance quote', category: 'LEAD_GENERATION', description: 'Collect details to provide an insurance quote. Endpoint required.'},
        { id: 'personalized_offer', name: 'Capture interest for a personalised offer', category: 'LEAD_GENERATION', description: 'Gather user preferences for a custom offer. Endpoint required.'},
        { id: 'sign_in_up', name: 'Account sign-in/sign-up', category: 'SIGN_UP', description: 'A form for user registration or login. Endpoint required.'},
        { id: 'appointment', name: 'Appointment booking', category: 'APPOINTMENT_BOOKING', description: 'Allow users to book appointments. Endpoint required.'},
    ]
};

// --- Template Specific Forms ---

const DefaultForm = ({ onJsonChange }: { onJsonChange: (json: string) => void }) => {
    const [title, setTitle] = useState('Hello World');
    const [body, setBody] = useState('Welcome to our flow.');
    const [buttonLabel, setButtonLabel] = useState('Complete');

    useEffect(() => {
        const json = {
            version: "3.0", data_api_version: "3.0", routing_model: {},
            screens: [{
                id: "WELCOME_SCREEN", title, data: {}, terminal: true, success: true,
                layout: { type: 'SingleColumnLayout', children: [
                    { type: 'TextHeading', text: title },
                    { type: 'TextBody', text: body },
                    { type: 'Footer', label: buttonLabel, 'on-click-action': { name: 'complete' } }
                ] }
            }]
        };
        onJsonChange(JSON.stringify(json, null, 2));
    }, [title, body, buttonLabel, onJsonChange]);

    return (
        <div className="space-y-4">
            <div className="space-y-2"><Label>Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
            <div className="space-y-2"><Label>Body</Label><Textarea value={body} onChange={e => setBody(e.target.value)} /></div>
            <div className="space-y-2"><Label>Button Label</Label><Input value={buttonLabel} onChange={e => setButtonLabel(e.target.value)} /></div>
        </div>
    );
};

const FeedbackForm = ({ onJsonChange }: { onJsonChange: (json: string) => void }) => {
    const [title, setTitle] = useState('Feedback');
    const [question, setQuestion] = useState('How would you rate your experience?');
    
    useEffect(() => {
        const json = {
            version: "3.0", data_api_version: "3.0", routing_model: {},
            screens: [{
                id: "FEEDBACK_SCREEN", title, data: {},
                layout: { type: 'SingleColumnLayout', children: [
                    { type: 'Form', name: 'feedback_form', children: [
                        { type: 'TextHeading', text: question },
                        { type: 'RadioButtons', name: 'rating', 'data-source': [
                            {id: '5', title: 'Excellent'}, {id: '4', title: 'Good'}, {id: '3', title: 'Average'}, {id: '2', title: 'Poor'}, {id: '1', title: 'Very Poor'}
                        ], required: true },
                        { type: 'TextInput', name: 'comments', label: 'Additional Comments', required: false },
                        { type: 'Footer', label: 'Submit Feedback', 'on-click-action': { name: 'complete' } }
                    ] }
                ] }
            }]
        };
        onJsonChange(JSON.stringify(json, null, 2));
    }, [title, question, onJsonChange]);

    return (
        <div className="space-y-4">
            <div className="space-y-2"><Label>Screen Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
            <div className="space-y-2"><Label>Feedback Question</Label><Input value={question} onChange={e => setQuestion(e.target.value)} /></div>
        </div>
    );
};

const AppointmentForm = ({ onJsonChange }: { onJsonChange: (json: string) => void }) => {
    const [title, setTitle] = useState('Book an Appointment');
    const [dateLabel, setDateLabel] = useState('Select a Date');
    const [timeLabel, setTimeLabel] = useState('Select a Time Slot');
    
    useEffect(() => {
        const json = {
            version: "3.0", data_api_version: "3.0", routing_model: {},
            screens: [{
                id: "APPOINTMENT_SCREEN", title, data: {},
                layout: { type: 'SingleColumnLayout', children: [
                    { type: 'Form', name: 'appointment_form', children: [
                        { type: 'TextHeading', text: title },
                        { type: 'DatePicker', name: 'appointment_date', label: dateLabel, required: true },
                        { type: 'Dropdown', name: 'appointment_time', label: timeLabel, required: true, 'data-source': [
                            {id: '0900', title: '09:00 AM'}, {id: '1100', title: '11:00 AM'}, {id: '1400', title: '02:00 PM'}, {id: '1600', title: '04:00 PM'}
                        ]},
                        { type: 'TextInput', name: 'notes', label: 'Notes (optional)' },
                        { type: 'Footer', label: 'Book Appointment', 'on-click-action': { name: 'complete', payload: { _endpoint: true } } }
                    ] }
                ] }
            }]
        };
        onJsonChange(JSON.stringify(json, null, 2));
    }, [title, dateLabel, timeLabel, onJsonChange]);

    return (
        <div className="space-y-4">
            <div className="space-y-2"><Label>Screen Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
            <div className="space-y-2"><Label>Date Picker Label</Label><Input value={dateLabel} onChange={e => setDateLabel(e.target.value)} /></div>
            <div className="space-y-2"><Label>Time Slot Label</Label><Input value={timeLabel} onChange={e => setTimeLabel(e.target.value)} /></div>
        </div>
    );
};

// ... add more form components for other templates here

const TemplateRenderer = ({ templateId, onJsonChange }: { templateId: string, onJsonChange: (json: string) => void }) => {
    switch (templateId) {
        case 'feedback': return <FeedbackForm onJsonChange={onJsonChange} />;
        case 'appointment': return <AppointmentForm onJsonChange={onJsonChange} />;
        // Add other cases here
        default: return <DefaultForm onJsonChange={onJsonChange} />;
    }
}

export default function CreateMetaFlowPage() {
    const [projectId, setProjectId] = useState<string | null>(null);
    const [isClient, setIsClient] = useState(false);
    const [state, formAction] = useActionState(saveMetaFlow, createFlowInitialState);
    const { toast } = useToast();
    const router = useRouter();

    const [activeTab, setActiveTab] = useState('without-endpoint');
    const [selectedTemplate, setSelectedTemplate] = useState('default');
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
    
    const activeTemplateList = activeTab === 'with-endpoint' ? templates.withEndpoint : templates.withoutEndpoint;

    useEffect(() => {
        setSelectedTemplate(activeTemplateList[0].id);
    }, [activeTab, activeTemplateList]);

    const currentTemplate = [...templates.withEndpoint, ...templates.withoutEndpoint].find(t => t.id === selectedTemplate);

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
            <input type="hidden" name="category" value={currentTemplate?.category || 'OTHER'} />
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
                      <TabsContent value="without-endpoint" className="pt-6 space-y-4">
                        <TemplateSelection templates={activeTemplateList} selected={selectedTemplate} onSelect={setSelectedTemplate}/>
                        <div className="p-4 border rounded-md">
                            <TemplateRenderer templateId={selectedTemplate} onJsonChange={setFlowJson} />
                        </div>
                      </TabsContent>
                      <TabsContent value="with-endpoint" className="pt-6 space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="endpoint_uri">Endpoint URI</Label>
                            <Input id="endpoint_uri" name="endpoint_uri" placeholder="https://your-server.com/api/flow" />
                            <p className="text-xs text-muted-foreground">The endpoint to send flow data to for processing.</p>
                          </div>
                          <TemplateSelection templates={activeTemplateList} selected={selectedTemplate} onSelect={setSelectedTemplate}/>
                          <div className="p-4 border rounded-md">
                            <TemplateRenderer templateId={selectedTemplate} onJsonChange={setFlowJson} />
                          </div>
                      </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            <Accordion type="single" collapsible>
                <AccordionItem value="json-preview">
                    <AccordionTrigger><div className="flex items-center gap-2"><FileJson className="h-4 w-4"/> View Generated JSON</div></AccordionTrigger>
                    <AccordionContent>
                        <pre className="p-4 bg-muted/50 rounded-md text-xs font-mono max-h-96 overflow-auto">{flowJson}</pre>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>

            <div className="flex justify-end">
                <SubmitButton/>
            </div>
        </form>
    );
}

function TemplateSelection({ templates, selected, onSelect }: { templates: any[], selected: string, onSelect: (id: string) => void }) {
    const current = templates.find(t => t.id === selected);
    return (
        <div className="space-y-2">
            <Label>Select a Template</Label>
            <Select value={selected} onValueChange={onSelect}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                    {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
            </Select>
            {current && <p className="text-sm text-muted-foreground">{current.description}</p>}
        </div>
    )
}
