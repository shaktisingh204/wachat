
'use client';

import { useActionState, useEffect, useState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, LoaderCircle, Save, AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

const defaultFlowJson = `{
  "version": "3.0",
  "data_api_version": "3.0",
  "routing_model": {},
  "screens": [
    {
      "id": "WELCOME_SCREEN",
      "title": "Welcome Screen",
      "data": {
        "headline": {
          "type": "TEXT",
          "text": "Welcome! Please tap below to continue."
        }
      },
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextHeadline",
            "text": "Welcome! Please tap below to continue."
          },
          {
            "type": "Footer",
            "label": "Continue",
            "on_click_action": {
              "name": "navigate",
              "payload": {
                "screen": "FORM_SCREEN"
              }
            }
          }
        ]
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
                <p className="text-muted-foreground mt-2">Define your interactive flow using the official Flow JSON structure.</p>
            </div>
            
            <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Advanced Mode</AlertTitle>
                <AlertDescription>
                   This editor allows you to create any type of flow by providing the raw JSON. For documentation and examples, please refer to our <Link href="/dashboard/flows/docs" className="text-primary hover:underline">API Docs</Link>.
                </AlertDescription>
            </Alert>

            <Card>
                <CardHeader>
                    <CardTitle>Flow Details</CardTitle>
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
                            <Input id="categories" name="categories" defaultValue="LEAD_GENERATION" placeholder="e.g., LEAD_GENERATION,SURVEY" required/>
                             <p className="text-xs text-muted-foreground">Comma-separated list of valid categories.</p>
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="endpoint_uri">Endpoint URI (Optional)</Label>
                        <Input id="endpoint_uri" name="endpoint_uri" placeholder="https://your-server.com/api/whatsapp-flow" />
                        <p className="text-xs text-muted-foreground">Required for data exchange flows that need to communicate with your server.</p>
                    </div>
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle>Flow JSON</CardTitle>
                    <CardDescription>
                        Define the screens and logic of your flow.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Textarea 
                        name="flow_data"
                        required
                        className="font-mono text-xs min-h-[50vh]"
                        defaultValue={defaultFlowJson}
                    />
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <SubmitButton />
            </div>
        </form>
    );
}
