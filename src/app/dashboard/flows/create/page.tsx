
'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, LoaderCircle, Save, AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { saveMetaFlow } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';


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

const exampleJson = `{
  "screens": [
    {
      "screen_id": "WELCOME",
      "title": "Welcome!",
      "data": {},
      "blocks": [
        {
          "block_type": "TEXT",
          "text": "Welcome to our lead capture form. Please provide your details."
        },
        {
          "block_type": "FOOTER",
          "text": "Tap Next to continue"
        }
      ],
      "layout_type": "SINGLE_COLUMN",
      "next_screen": "DETAILS_FORM"
    },
    {
      "screen_id": "DETAILS_FORM",
      "title": "Your Details",
      "data": {},
      "blocks": [
        {
          "block_type": "INPUT",
          "input_type": "TEXT",
          "name": "name",
          "label": "Full Name"
        },
        {
          "block_type": "INPUT",
          "input_type": "EMAIL",
          "name": "email",
          "label": "Email Address"
        }
      ],
      "layout_type": "SINGLE_COLUMN",
      "submit_button": {
        "label": "Submit",
        "action": {
          "type": "SUBMIT"
        }
      }
    }
  ]
}`;

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
                <p className="text-muted-foreground mt-2">Define your interactive flow using Meta's JSON structure.</p>
            </div>
            
            <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>About Meta Flows</AlertTitle>
                <AlertDescription>
                    Meta Flows allow you to build rich, native experiences within WhatsApp, like forms and appointment bookers. They are defined by a JSON structure of screens and blocks.
                    You can learn more at the official <a href="https://developers.facebook.com/docs/whatsapp/flows/reference/flowjson" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Meta Flows Reference</a>.
                </AlertDescription>
            </Alert>

            <Card>
                <CardHeader>
                    <CardTitle>Flow Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Flow Name</Label>
                            <Input id="name" name="name" placeholder="e.g., lead_capture_flow" required/>
                             <p className="text-xs text-muted-foreground">Lowercase letters and underscores only.</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="categories">Categories</Label>
                            <Input id="categories" name="categories" placeholder="e.g., LEAD_GENERATION, APPOINTMENT_BOOKING" defaultValue="LEAD_GENERATION" required/>
                             <p className="text-xs text-muted-foreground">Comma-separated list of valid categories.</p>
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="flow_data">Flow JSON Data</Label>
                        <Textarea id="flow_data" name="flow_data" placeholder="Paste your flow JSON here..." className="font-mono text-xs min-h-[400px]" defaultValue={exampleJson} required/>
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <SubmitButton />
            </div>
        </form>
    );
}
