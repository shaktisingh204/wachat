
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
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { saveMetaFlow } from '@/app/actions/meta-flow.actions';

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
        { id: 'loan_credit', name: 'Get leads for a pre-approved loan/credit card', category: 'LEAD_GENERATION', description: 'Capture leads for financial products.'},
        { id: 'insurance_quote', name: 'Provide insurance quote', category: 'LEAD_GENERATION', description: 'Collect details to provide an insurance quote.'},
        { id: 'personalized_offer', name: 'Capture interest for a personalised offer', category: 'LEAD_GENERATION', description: 'Gather user preferences for a custom offer.'},
        { id: 'sign_in_up', name: 'Account sign-in/sign-up', category: 'SIGN_UP', description: 'A form for user registration or login.'},
        { id: 'appointment', name: 'Appointment booking', category: 'APPOINTMENT_BOOKING', description: 'Allow users to book appointments.'},
    ]
};

// --- Form Components for each template ---

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
    const [options, setOptions] = useState([
        {id: '5', title: 'Excellent'}, {id: '4', title: 'Good'}, {id: '3', title: 'Average'}, {id: '2', title: 'Poor'}, {id: '1', title: 'Very Poor'}
    ]);

    useEffect(() => {
        const json = {
            version: "3.0", data_api_version: "3.0", routing_model: {},
            screens: [{
                id: "FEEDBACK_SCREEN", title, data: {},
                layout: { type: 'SingleColumnLayout', children: [
                    { type: 'Form', name: 'feedback_form', children: [
                        { type: 'TextHeading', text: question },
                        { type: 'RadioButtons', name: 'rating', 'data-source': options, required: true },
                        { type: 'TextInput', name: 'comments', label: 'Additional Comments', required: false },
                        { type: 'Footer', label: 'Submit Feedback', 'on-click-action': { name: 'complete' } }
                    ] }
                ] }
            }]
        };
        onJsonChange(JSON.stringify(json, null, 2));
    }, [title, question, options, onJsonChange]);

    const handleOptionChange = (index: number, value: string) => {
        const newOptions = [...options];
        newOptions[index].title = value;
        setOptions(newOptions);
    };

    return (
        <div className="space-y-4">
            <div className="space-y-2"><Label>Screen Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
            <div className="space-y-2"><Label>Feedback Question</Label><Input value={question} onChange={e => setQuestion(e.target.value)} /></div>
            <div className="space-y-2">
                <Label>Rating Options</Label>
                <div className="space-y-2">
                    {options.map((opt, i) => <Input key={opt.id} value={opt.title} onChange={e => handleOptionChange(i, e.target.value)} />)}
                </div>
            </div>
        </div>
    );
};

const AppointmentForm = ({ onJsonChange }: { onJsonChange: (json: string) => void }) => {
    const [title, setTitle] = useState('Book an Appointment');
    const [dateLabel, setDateLabel] = useState('Select a Date');
    const [timeLabel, setTimeLabel] = useState('Select a Time Slot');
    const [timeSlots, setTimeSlots] = useState([
        {id: '0900', title: '09:00 AM'}, {id: '1100', title: '11:00 AM'}, {id: '1400', title: '02:00 PM'}, {id: '1600', title: '04:00 PM'}
    ]);

    useEffect(() => {
        const json = {
            version: "3.0", data_api_version: "3.0", routing_model: {},
            screens: [{
                id: "APPOINTMENT_SCREEN", title, data: {},
                layout: { type: 'SingleColumnLayout', children: [
                    { type: 'Form', name: 'appointment_form', children: [
                        { type: 'TextHeading', text: title },
                        { type: 'DatePicker', name: 'appointment_date', label: dateLabel, required: true },
                        { type: 'Dropdown', name: 'appointment_time', label: timeLabel, required: true, 'data-source': timeSlots},
                        { type: 'TextInput', name: 'notes', label: 'Notes (optional)' },
                        { type: 'Footer', label: 'Book Appointment', 'on-click-action': { name: 'complete', payload: { _endpoint: true } } }
                    ] }
                ] }
            }]
        };
        onJsonChange(JSON.stringify(json, null, 2));
    }, [title, dateLabel, timeLabel, timeSlots, onJsonChange]);

    const handleSlotChange = (index: number, value: string) => {
        const newSlots = [...timeSlots];
        newSlots[index].title = value;
        newSlots[index].id = value.replace(/[^0-9]/g, ''); // Simple ID generation
        setTimeSlots(newSlots);
    };

    const addSlot = () => setTimeSlots([...timeSlots, {id: `${Date.now()}`, title: ''}]);
    const removeSlot = (index: number) => setTimeSlots(timeSlots.filter((_, i) => i !== index));

    return (
        <div className="space-y-4">
            <div className="space-y-2"><Label>Screen Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
            <div className="space-y-2"><Label>Date Picker Label</Label><Input value={dateLabel} onChange={e => setDateLabel(e.target.value)} /></div>
            <div className="space-y-2">
                <Label>Time Slot Options</Label>
                <div className="space-y-2">
                    {timeSlots.map((slot, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <Input value={slot.title} onChange={e => handleSlotChange(i, e.target.value)} />
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeSlot(i)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                        </div>
                    ))}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addSlot} className="mt-2"><Plus className="mr-2 h-4 w-4"/>Add Time Slot</Button>
            </div>
        </div>
    );
};

const GenericFormBuilder = ({ onJsonChange, formTitle, formName, buttonLabel, initialFields, endpoint }: { onJsonChange: (json: string) => void, formTitle: string, formName: string, buttonLabel: string, initialFields: any[], endpoint?: boolean }) => {
    const [fields, setFields] = useState(initialFields);
    
    useEffect(() => {
        const action: any = { name: 'complete' };
        if (endpoint) {
            action.payload = { _endpoint: true };
        }
        const json = {
            version: "3.0", data_api_version: "3.0", routing_model: {},
            screens: [{
                id: `${formName.toUpperCase()}_SCREEN`, title: formTitle, data: {},
                layout: { type: 'SingleColumnLayout', children: [
                    { type: 'Form', name: formName, children: [
                        { type: 'TextHeading', text: formTitle },
                        ...fields,
                        { type: 'Footer', label: buttonLabel, 'on-click-action': action }
                    ] }
                ] }
            }]
        };
        onJsonChange(JSON.stringify(json, null, 2));
    }, [formTitle, formName, buttonLabel, fields, onJsonChange, endpoint]);

    return (
        <div className="p-4 border rounded-md bg-muted/50">
            <p className="text-sm text-muted-foreground">This template uses a pre-defined set of fields. To customize fields, use a different template or build your own flow logic.</p>
            <ul className="list-disc pl-5 mt-2 text-sm">
                {fields.map((f, i) => <li key={i}>{f.label || f.type}</li>)}
            </ul>
        </div>
    );
};

const PurchaseInterestForm = ({ onJsonChange }: { onJsonChange: (json: string) => void }) => {
    return <GenericFormBuilder 
        onJsonChange={onJsonChange} formTitle="Product Interest" formName="interest_form" buttonLabel="Submit"
        initialFields={[
            { type: 'TextInput', name: 'name', label: 'Full Name', required: true },
            { type: 'Dropdown', name: 'product', label: 'Which product are you interested in?', required: true, 'data-source': [{id: 'p1', title: 'Product A'}, {id: 'p2', title: 'Product B'}] },
        ]}
    />
};

const SurveyForm = ({ onJsonChange }: { onJsonChange: (json: string) => void }) => {
    return <GenericFormBuilder 
        onJsonChange={onJsonChange} formTitle="Customer Survey" formName="survey_form" buttonLabel="Submit Survey"
        initialFields={[
            { type: 'RadioButtons', name: 'satisfaction', label: 'Overall, how satisfied are you?', required: true, 'data-source': [{id: '5', title: 'Very Satisfied'}, {id: '3', title: 'Neutral'}, {id: '1', title: 'Very Unsatisfied'}] },
            { type: 'CheckboxGroup', name: 'features_used', label: 'Which features do you use?', required: true, 'data-source': [{id: 'f1', title: 'Feature X'}, {id: 'f2', title: 'Feature Y'}] },
        ]}
    />
};

const SupportForm = ({ onJsonChange }: { onJsonChange: (json: string) => void }) => {
    return <GenericFormBuilder 
        onJsonChange={onJsonChange} formTitle="Customer Support" formName="support_form" buttonLabel="Submit Request"
        initialFields={[
            { type: 'Dropdown', name: 'issue_type', label: 'What is your issue related to?', required: true, 'data-source': [{id: 'billing', title: 'Billing'}, {id: 'technical', title: 'Technical Support'}, {id: 'general', title: 'General Inquiry'}] },
            { type: 'TextInput', name: 'details', label: 'Please describe your issue', 'input-type': 'multiline', required: true },
        ]}
    />
};

const LoanCreditForm = ({ onJsonChange }: { onJsonChange: (json: string) => void }) => {
    return <GenericFormBuilder 
        onJsonChange={onJsonChange} formTitle="Loan Application" formName="loan_form" buttonLabel="Apply Now" endpoint={true}
        initialFields={[
            { type: 'TextInput', name: 'full_name', label: 'Full Name', required: true },
            { type: 'TextInput', name: 'email', label: 'Email Address', 'input-type': 'email', required: true },
            { type: 'TextInput', name: 'phone', label: 'Phone Number', 'input-type': 'phone', required: true },
            { type: 'TextInput', name: 'income', label: 'Annual Income', 'input-type': 'number', required: true },
            { type: 'OptIn', name: 'consent', label: 'I agree to the terms and conditions', required: true },
        ]}
    />
};

const InsuranceQuoteForm = ({ onJsonChange }: { onJsonChange: (json: string) => void }) => {
     return <GenericFormBuilder 
        onJsonChange={onJsonChange} formTitle="Insurance Quote" formName="quote_form" buttonLabel="Get Quote" endpoint={true}
        initialFields={[
            { type: 'Dropdown', name: 'insurance_type', label: 'Type of Insurance', required: true, 'data-source': [{id: 'health', title: 'Health'}, {id: 'auto', title: 'Auto'}, {id: 'home', title: 'Home'}] },
            { type: 'TextInput', name: 'zip_code', label: 'ZIP Code', 'input-type': 'number', required: true },
        ]}
    />
};

const PersonalizedOfferForm = ({ onJsonChange }: { onJsonChange: (json: string) => void }) => {
    return <GenericFormBuilder 
        onJsonChange={onJsonChange} formTitle="Personalized Offer" formName="offer_form" buttonLabel="Get My Offer" endpoint={true}
        initialFields={[
            { type: 'CheckboxGroup', name: 'interests', label: 'What are your interests?', required: true, 'data-source': [{id: 'sports', title: 'Sports'}, {id: 'tech', title: 'Technology'}, {id: 'travel', title: 'Travel'}] },
        ]}
    />
};

const SignInUpForm = ({ onJsonChange }: { onJsonChange: (json: string) => void }) => {
    return <GenericFormBuilder 
        onJsonChange={onJsonChange} formTitle="Create Your Account" formName="signup_form" buttonLabel="Sign Up" endpoint={true}
        initialFields={[
            { type: 'TextInput', name: 'email', label: 'Email Address', 'input-type': 'email', required: true },
            { type: 'TextInput', name: 'password', label: 'Password', 'input-type': 'password', required: true },
        ]}
    />
};


// --- Main Page Component ---

const TemplateRenderer = ({ templateId, onJsonChange }: { templateId: string, onJsonChange: (json: string) => void }) => {
    switch (templateId) {
        case 'feedback': return <FeedbackForm onJsonChange={onJsonChange} />;
        case 'appointment': return <AppointmentForm onJsonChange={onJsonChange} />;
        case 'purchase_interest': return <PurchaseInterestForm onJsonChange={onJsonChange} />;
        case 'survey': return <SurveyForm onJsonChange={onJsonChange} />;
        case 'support': return <SupportForm onJsonChange={onJsonChange} />;
        case 'loan_credit': return <LoanCreditForm onJsonChange={onJsonChange} />;
        case 'insurance_quote': return <InsuranceQuoteForm onJsonChange={onJsonChange} />;
        case 'personalized_offer': return <PersonalizedOfferForm onJsonChange={onJsonChange} />;
        case 'sign_in_up': return <SignInUpForm onJsonChange={onJsonChange} />;
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
    const [selectedTemplateId, setSelectedTemplateId] = useState('default');
    const [flowJson, setFlowJson] = useState('');

    useEffect(() => {
        setIsClient(true);
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
    }, []);
    
    // This effect safely resets the selected template when the tab changes
    useEffect(() => {
        if(activeTab === 'without-endpoint') {
            setSelectedTemplateId('default');
        } else {
            setSelectedTemplateId('loan_credit');
        }
    }, [activeTab]);

    useEffect(() => {
        if(state?.message) {
            toast({ title: 'Success', description: state.message });
            router.push('/dashboard/flows');
        }
        if(state?.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router]);
    
    // Stable callback to prevent re-renders
    const handleJsonChange = useCallback((json: string) => {
        setFlowJson(json);
    }, []);

    const activeTemplateList = activeTab === 'with-endpoint' ? templates.withEndpoint : templates.withoutEndpoint;
    const currentTemplate = activeTemplateList.find(t => t.id === selectedTemplateId);
    
    return (
        <form action={formAction} className="space-y-6">
            <input type="hidden" name="projectId" value={projectId || ''}/>
            <input type="hidden" name="category" value={currentTemplate?.category || 'OTHER'} />
            <input type="hidden" name="flow_data" value={flowJson} />
            {activeTab === 'with-endpoint' && <input type="hidden" name="endpoint_uri" value={(document.getElementById('endpoint_uri') as HTMLInputElement)?.value || ''}/>}

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
                <CardContent>
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

                      <div className="pt-6 space-y-4">
                          {activeTab === 'with-endpoint' && (
                            <div className="space-y-2">
                                <Label htmlFor="endpoint_uri">Endpoint URI</Label>
                                <Input id="endpoint_uri" name="endpoint_uri" placeholder="https://your-server.com/api/flow" required/>
                                <p className="text-xs text-muted-foreground">The endpoint to send flow data to for processing.</p>
                            </div>
                          )}

                           <div className="space-y-2">
                                <Label>Select a Template</Label>
                                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        {activeTemplateList.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                {currentTemplate && <p className="text-sm text-muted-foreground">{currentTemplate.description}</p>}
                            </div>

                          <div className="p-4 border rounded-md">
                            <TemplateRenderer templateId={selectedTemplateId} onJsonChange={handleJsonChange} />
                          </div>
                      </div>
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
