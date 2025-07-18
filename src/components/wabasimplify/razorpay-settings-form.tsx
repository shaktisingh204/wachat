

'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoaderCircle, Save, Key } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { saveRazorpaySettings } from '@/app/actions/integrations.actions';
import type { WithId, Project } from '@/lib/definitions';

const initialState = { message: null, error: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save Razorpay Keys
    </Button>
  );
}

interface RazorpaySettingsFormProps {
  project: WithId<Project>;
}

export function RazorpaySettingsForm({ project }: RazorpaySettingsFormProps) {
    const [state, formAction] = useActionState(saveRazorpaySettings, initialState);
    const { toast } = useToast();
    
    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast]);

    return (
        <form action={formAction}>
            <input type="hidden" name="projectId" value={project._id.toString()} />
            <Card className="card-gradient card-gradient-blue">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Key className="h-5 w-5"/>
                        Razorpay Integration
                    </CardTitle>
                    <CardDescription>Enter your Razorpay API keys to enable payments.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="keyId">Key ID</Label>
                        <Input id="keyId" name="keyId" defaultValue={project.razorpaySettings?.keyId} placeholder="rzp_test_..." required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="keySecret">Key Secret</Label>
                        <Input id="keySecret" name="keySecret" type="password" defaultValue={project.razorpaySettings?.keySecret} placeholder="Your Key Secret" required />
                    </div>
                </CardContent>
                <CardFooter>
                    <SubmitButton />
                </CardFooter>
            </Card>
        </form>
    );
}
