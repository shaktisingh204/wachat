
'use client';

import { useActionState, useEffect, useState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, LoaderCircle, Save, AlertCircle, Info, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { saveMetaFlow } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

type FormField = {
    id: number;
    name: string;
    label: string;
    type: 'TEXT' | 'EMAIL' | 'PHONE_NUMBER' | 'DATE';
};


export default function CreateMetaFlowPage() {
    const [projectId, setProjectId] = useState<string | null>(null);
    const [isClient, setIsClient] = useState(false);
    const [state, formAction] = useActionState(saveMetaFlow, createFlowInitialState);
    const { toast } = useToast();
    const router = useRouter();

    // Form State
    const [flowName, setFlowName] = useState('');
    const [categories, setCategories] = useState('LEAD_GENERATION');
    const [welcomeScreenText, setWelcomeScreenText] = useState('Welcome! Please tap the button below to provide your details so we can get in touch.');
    const [formScreenTitle, setFormScreenTitle] = useState('Your Details');
    const [formFields, setFormFields] = useState<FormField[]>([
        { id: 1, name: 'name', label: 'Full Name', type: 'TEXT' },
        { id: 2, name: 'email', label: 'Email Address', type: 'EMAIL' }
    ]);
    const [submitButtonLabel, setSubmitButtonLabel] = useState('Submit');

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

    const handleAddField = () => {
        setFormFields([...formFields, { id: Date.now(), name: '', label: '', type: 'TEXT' }]);
    };
    const handleRemoveField = (id: number) => {
        setFormFields(formFields.filter(f => f.id !== id));
    };
    const handleFieldChange = (id: number, field: 'name' | 'label' | 'type', value: string) => {
        setFormFields(formFields.map(f => (f.id === id ? { ...f, [field]: value } : f)));
    };

    const generateFlowJson = () => {
        const flowData = {
          version: '3.0',
          data_api_version: '3.0',
          routing_model: {
              SUBMIT: ['SUCCESS_SCREEN']
          },
          screens: [
            {
              id: "WELCOME_SCREEN",
              title: "Welcome",
              data: {
                  headline: {
                      type: 'TEXT',
                      text: welcomeScreenText,
                  },
              },
              terminal: false,
              next: "FORM_SCREEN"
            },
            {
              id: "FORM_SCREEN",
              title: formScreenTitle,
              data: {
                  ...formFields.reduce((acc, field) => {
                      acc[field.name] = {
                          type: field.type,
                          label: field.label,
                          required: true,
                      };
                      return acc;
                  }, {} as any)
              },
              layout: {
                  type: 'Form',
                  name: 'form_layout',
                  children: [
                      ...formFields.map(field => ({
                          type: 'TextInput',
                          name: field.name,
                          label: field.label,
                      })),
                      {
                          type: 'Button',
                          label: submitButtonLabel,
                          action: {
                              name: 'SUBMIT'
                          }
                      }
                  ]
              },
              terminal: false,
            },
            {
                id: 'SUCCESS_SCREEN',
                data: {
                    headline: {
                        type: 'TEXT',
                        text: 'Thank you!'
                    },
                    body: {
                        type: 'TEXT',
                        text: 'Your submission has been received.'
                    }
                },
                terminal: true
            }
          ]
        };
        return JSON.stringify(flowData, null, 2);
    }

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
            <input type="hidden" name="flow_data" value={generateFlowJson()} />
            <div>
                <Button variant="ghost" asChild className="mb-4 -ml-4">
                  <Link href="/dashboard/flows">
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Back to Meta Flows
                  </Link>
                </Button>
                <h1 className="text-3xl font-bold font-headline">Create New Meta Flow</h1>
                <p className="text-muted-foreground mt-2">Define your interactive flow using our guided builder.</p>
            </div>
            
            <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>About This Builder</AlertTitle>
                <AlertDescription>
                   This form helps you build a common "Lead Capture" flow. For more complex flows with branching logic or different screen types, you will need to use the official Meta Flow JSON structure.
                </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Flow Details</CardTitle>
                    </CardHeader>
                    <CardContent className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Flow Name</Label>
                            <Input id="name" name="name" placeholder="e.g., lead_capture_flow" value={flowName} onChange={e => setFlowName(e.target.value)} required/>
                             <p className="text-xs text-muted-foreground">Lowercase letters and underscores only.</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="categories">Categories</Label>
                            <Input id="categories" name="categories" placeholder="e.g., LEAD_GENERATION" value={categories} onChange={e => setCategories(e.target.value)} required/>
                             <p className="text-xs text-muted-foreground">Comma-separated list of valid categories.</p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Welcome Screen</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="welcomeText">Welcome Message</Label>
                            <Textarea id="welcomeText" value={welcomeScreenText} onChange={e => setWelcomeScreenText(e.target.value)} required className="min-h-32" />
                        </div>
                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader>
                        <CardTitle>Form Screen</CardTitle>
                        <CardDescription>Add the fields you want to collect from the user.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         <div className="space-y-2">
                            <Label htmlFor="formScreenTitle">Form Title</Label>
                            <Input id="formScreenTitle" value={formScreenTitle} onChange={e => setFormScreenTitle(e.target.value)} required />
                        </div>
                        <Separator />
                        <div className="space-y-2">
                            <Label>Form Fields</Label>
                            <div className="space-y-3">
                                {formFields.map(field => (
                                    <div key={field.id} className="p-3 border rounded-lg grid grid-cols-1 md:grid-cols-2 gap-3 relative">
                                        <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => handleRemoveField(field.id)}><Trash2 className="h-4 w-4"/></Button>
                                         <div className="space-y-1">
                                            <Label htmlFor={`label-${field.id}`} className="text-xs">Label</Label>
                                            <Input id={`label-${field.id}`} placeholder="Full Name" value={field.label} onChange={(e) => handleFieldChange(field.id, 'label', e.target.value)} />
                                         </div>
                                         <div className="space-y-1">
                                            <Label htmlFor={`name-${field.id}`} className="text-xs">Variable Name</Label>
                                            <Input id={`name-${field.id}`} placeholder="name" value={field.name} onChange={(e) => handleFieldChange(field.id, 'name', e.target.value)} />
                                         </div>
                                         <div className="space-y-1 md:col-span-2">
                                            <Label htmlFor={`type-${field.id}`} className="text-xs">Input Type</Label>
                                            <Select value={field.type} onValueChange={(v) => handleFieldChange(field.id, 'type', v)}>
                                                <SelectTrigger><SelectValue/></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="TEXT">Text</SelectItem>
                                                    <SelectItem value="EMAIL">Email</SelectItem>
                                                    <SelectItem value="PHONE_NUMBER">Phone</SelectItem>
                                                    <SelectItem value="DATE">Date</SelectItem>
                                                </SelectContent>
                                            </Select>
                                         </div>
                                    </div>
                                ))}
                            </div>
                            <Button type="button" variant="outline" size="sm" onClick={handleAddField} className="w-full"><Plus className="mr-2 h-4 w-4"/>Add Field</Button>
                        </div>
                        <Separator />
                         <div className="space-y-2">
                            <Label htmlFor="submitLabel">Submit Button Label</Label>
                            <Input id="submitLabel" value={submitButtonLabel} onChange={e => setSubmitButtonLabel(e.target.value)} required />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex justify-end">
                <SubmitButton />
            </div>
        </form>
    );
}
