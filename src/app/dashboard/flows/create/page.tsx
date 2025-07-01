

'use client';

import { useActionState, useEffect, useState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, LoaderCircle, Save, AlertCircle, Info, UserRound, Mail, Phone, MessageSquareText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { saveMetaFlow } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from '@/components/ui/separator';

const createFlowInitialState = {
  message: null,
  error: null,
};

function SubmitButton({ children }: { children: React.ReactNode }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {children}
        </Button>
    )
}

const categoriesList = [
    { id: 'LEAD_GENERATION', name: 'Lead Generation', desc: 'Collect user info like name, email, etc.' },
    { id: 'CUSTOMER_SUPPORT', name: 'Customer Support', desc: 'Structured support interactions.' },
    { id: 'APPOINTMENT_BOOKING', name: 'Appointment Booking', desc: 'Book or reschedule appointments.' },
    { id: 'PRODUCT_RECOMMENDATION', name: 'Product Recommendation', desc: 'Help users select or configure a product.' },
    { id: 'ORDER_TRACKING', name: 'Order Tracking', desc: 'Allow users to get delivery status.' },
    { id: 'ONBOARDING', name: 'Onboarding', desc: 'Multi-step guidance for new users.' },
    { id: 'FEEDBACK_COLLECTION', name: 'Feedback Collection', desc: 'Gather user feedback or ratings.' },
    { id: 'APPLICATION_PROCESS', name: 'Application Process', desc: 'Step-by-step for job or service applications.' },
    { id: 'SUBSCRIPTION_MANAGEMENT', name: 'Subscription Management', desc: 'Let users opt-in/out of updates.' },
    { id: 'SURVEY', name: 'Survey', desc: 'Simple questionnaire for research.' },
    { id: 'SIGN_UP', name: 'Sign Up', desc: 'User registration flows.' },
    { id: 'SIGN_IN', name: 'Sign In', desc: 'User authentication flows.' },
    { id: 'CONTACT_US', name: 'Contact Us', desc: 'General contact forms.' },
    { id: 'OTHER', name: 'Other', desc: 'A general-purpose category.' },
];


const defaultLeadGenJson = `{
  "version": "3.0",
  "data_api_version": "3.0",
  "routing_model": {},
  "screens": [
    {
      "id": "SIGN_UP",
      "title": "Sign Up",
      "data": {},
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextHeading",
            "text": "Welcome! Let's get your information."
          },
          {
            "type": "TextInput",
            "label": "Full Name",
            "name": "name",
            "required": true
          },
          {
            "type": "TextInput",
            "label": "Email",
            "name": "email",
            "input-type": "email",
            "required": false
          },
          {
            "type": "Footer",
            "label": "Submit",
            "on-click-action": {
              "name": "complete",
              "payload": {}
            }
          }
        ]
      }
    }
  ]
}`;

const CustomFlowTab = () => (
     <Card>
        <CardHeader>
            <CardTitle>Advanced Flow Creation</CardTitle>
            <CardDescription>
                Define your interactive flow using the official Flow JSON structure.
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="name">Flow Name</Label>
                <Input id="name" name="name" placeholder="e.g., lead_capture_flow" required/>
                    <p className="text-xs text-muted-foreground">Lowercase letters and underscores only.</p>
            </div>
            <div className="space-y-2">
                <Label>Categories (select at least one)</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 rounded-md border p-4 max-h-60 overflow-y-auto">
                    {categoriesList.map(cat => (
                        <div key={cat.id} className="flex items-start gap-2">
                            <Checkbox id={`cat-${cat.id}`} name="categories" value={cat.id} />
                            <div className="grid gap-1.5 leading-none">
                                <label htmlFor={`cat-${cat.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    {cat.name}
                                </label>
                                <p className="text-xs text-muted-foreground">{cat.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="endpoint_uri">Endpoint URI (Optional)</Label>
                <Input id="endpoint_uri" name="endpoint_uri" placeholder="https://your-server.com/api/whatsapp-flow" />
                <p className="text-xs text-muted-foreground">Required for data exchange flows that need to communicate with your server.</p>
            </div>
             <div className="space-y-2">
                <Label htmlFor="flow_data">Flow JSON</Label>
                 <Textarea 
                    name="flow_data"
                    required
                    className="font-mono text-xs min-h-[50vh]"
                    defaultValue={defaultLeadGenJson}
                />
            </div>
        </CardContent>
    </Card>
)

const LeadGenFlowTab = () => {
    const [fields, setFields] = useState({
        name: true,
        email: true,
        phone: false,
        custom: false
    })

    return (
        <Card>
            <CardHeader>
                <CardTitle>Lead Generation Form</CardTitle>
                <CardDescription>Quickly build a form to capture new leads inside WhatsApp.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="leadgen_name">Flow Name</Label>
                    <Input id="leadgen_name" name="leadgen_name" placeholder="e.g., spring_sale_leads" required defaultValue="lead_gen_form_1"/>
                    <p className="text-xs text-muted-foreground">Lowercase letters and underscores only.</p>
                </div>
                <Separator />
                 <div className="space-y-2">
                    <Label htmlFor="leadgen_welcome">Welcome Message</Label>
                    <Textarea id="leadgen_welcome" name="leadgen_welcome" placeholder="Welcome! Please fill out this short form to get started." defaultValue="Welcome! Please provide your details to continue." required />
                </div>
                <div className="space-y-4">
                    <Label>Form Fields to Include</Label>
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div className="flex items-center space-x-2 p-3 rounded-md border bg-muted/50">
                            <Checkbox id="includeName" name="includeName" defaultChecked={fields.name} onCheckedChange={(c) => setFields(f => ({...f, name: !!c}))}/>
                            <Label htmlFor="includeName" className="font-normal flex items-center gap-2"><UserRound className="h-4 w-4"/> Full Name</Label>
                        </div>
                         <div className="flex items-center space-x-2 p-3 rounded-md border bg-muted/50">
                            <Checkbox id="includeEmail" name="includeEmail" defaultChecked={fields.email} onCheckedChange={(c) => setFields(f => ({...f, email: !!c}))}/>
                            <Label htmlFor="includeEmail" className="font-normal flex items-center gap-2"><Mail className="h-4 w-4"/> Email Address</Label>
                        </div>
                         <div className="flex items-center space-x-2 p-3 rounded-md border bg-muted/50">
                            <Checkbox id="includePhone" name="includePhone" defaultChecked={fields.phone} onCheckedChange={(c) => setFields(f => ({...f, phone: !!c}))}/>
                            <Label htmlFor="includePhone" className="font-normal flex items-center gap-2"><Phone className="h-4 w-4"/> Phone Number</Label>
                        </div>
                         <div className="flex items-center space-x-2 p-3 rounded-md border bg-muted/50">
                            <Checkbox id="includeCustom" name="includeCustom" defaultChecked={fields.custom} onCheckedChange={(c) => setFields(f => ({...f, custom: !!c}))}/>
                            <Label htmlFor="includeCustom" className="font-normal flex items-center gap-2"><MessageSquareText className="h-4 w-4"/> Custom Question</Label>
                        </div>
                    </div>
                </div>

                {fields.custom && (
                    <div className="space-y-2 pl-4 border-l-2 border-primary">
                        <Label htmlFor="leadgen_custom_question_label">Custom Question Label</Label>
                        <Input id="leadgen_custom_question_label" name="leadgen_custom_question_label" placeholder="e.g., What product are you interested in?" />
                         <Label htmlFor="leadgen_custom_question_name">Custom Question Variable Name</Label>
                        <Input id="leadgen_custom_question_name" name="leadgen_custom_question_name" placeholder="e.g., product_interest" />
                        <p className="text-xs text-muted-foreground">This is the key used for the data, e.g. in webhooks. Lowercase and underscores only.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

const SignUpFlowTab = () => (
    <Card>
        <CardHeader>
            <CardTitle>Sign Up Form</CardTitle>
            <CardDescription>Create a simple sign-up form for new users.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="signup_name">Flow Name</Label>
                <Input id="signup_name" name="signup_name" placeholder="e.g., new_user_signup" required defaultValue="new_user_signup_1" />
                <p className="text-xs text-muted-foreground">Lowercase letters and underscores only.</p>
            </div>
            <Separator />
            <div className="space-y-2">
                <Label htmlFor="signup_welcome">Welcome Message</Label>
                <Textarea id="signup_welcome" name="signup_welcome" placeholder="Create your account to get started." defaultValue="Welcome! Please create your account to continue." required />
            </div>
            <div className="space-y-4">
                <Label>Form Fields</Label>
                <div className="space-y-2 text-sm text-muted-foreground">
                    <p>The sign-up form will include fields for: Full Name, Email, and Password.</p>
                </div>
            </div>
        </CardContent>
    </Card>
);

export default function CreateMetaFlowPage() {
    const [projectId, setProjectId] = useState<string | null>(null);
    const [isClient, setIsClient] = useState(false);
    const [state, formAction] = useActionState(saveMetaFlow, createFlowInitialState);
    const { toast } = useToast();
    const router = useRouter();

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
            <div>
                <Button variant="ghost" asChild className="mb-4 -ml-4">
                  <Link href="/dashboard/flows">
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Back to Meta Flows
                  </Link>
                </Button>
                <h1 className="text-3xl font-bold font-headline">Create New Meta Flow</h1>
                <p className="text-muted-foreground mt-2">Choose a template or build a custom flow using the advanced JSON editor.</p>
            </div>
            
             <Tabs defaultValue="lead_gen" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="lead_gen">Lead Generation</TabsTrigger>
                    <TabsTrigger value="sign_up">Sign Up</TabsTrigger>
                    <TabsTrigger value="custom">Custom (Advanced)</TabsTrigger>
                </TabsList>
                <TabsContent value="lead_gen" className="pt-4">
                     <input type="hidden" name="flowType" value="lead_gen" />
                     <LeadGenFlowTab />
                </TabsContent>
                 <TabsContent value="sign_up" className="pt-4">
                     <input type="hidden" name="flowType" value="sign_up" />
                     <SignUpFlowTab />
                </TabsContent>
                <TabsContent value="custom" className="pt-4">
                    <input type="hidden" name="flowType" value="custom" />
                    <CustomFlowTab />
                </TabsContent>
            </Tabs>
            

            <div className="flex justify-end">
                <SubmitButton>Save & Publish Flow</SubmitButton>
            </div>
        </form>
    );
}
