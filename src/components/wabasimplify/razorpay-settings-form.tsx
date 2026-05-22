'use client';

import {
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
  Button,
  Input,
  Label,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useRef } from 'react';
import { useFormStatus } from 'react-dom';

import { LoaderCircle, Save, Key } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { saveRazorpaySettings } from '@/app/actions/integrations.actions';
import type { WithId, Project } from '@/lib/definitions';

const initialState = { message: null, error: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save Razorpay Keys
    </ZoruButton>
  );
}

interface RazorpaySettingsFormProps {
  project: WithId<Project>;
}

export function RazorpaySettingsForm({ project }: RazorpaySettingsFormProps) {
    const [state, formAction] = useActionState(saveRazorpaySettings as any, initialState as any);
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
            <ZoruCard className="card-gradient card-gradient-blue">
                <ZoruCardHeader>
                    <ZoruCardTitle className="flex items-center gap-2">
                        <Key className="h-5 w-5"/>
                        Razorpay Integration
                    </ZoruCardTitle>
                    <ZoruCardDescription>Enter your Razorpay API keys to enable payments.</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="space-y-4">
                    <div className="space-y-2">
                        <ZoruLabel htmlFor="keyId">Key ID</ZoruLabel>
                        <ZoruInput id="keyId" name="keyId" defaultValue={project.razorpaySettings?.keyId} placeholder="rzp_test_..." required />
                    </div>
                    <div className="space-y-2">
                        <ZoruLabel htmlFor="keySecret">Key Secret</ZoruLabel>
                        <ZoruInput id="keySecret" name="keySecret" type="password" defaultValue={project.razorpaySettings?.keySecret} placeholder="Your Key Secret" required />
                    </div>
                </ZoruCardContent>
                <ZoruCardFooter>
                    <SubmitButton />
                </ZoruCardFooter>
            </ZoruCard>
        </form>
    );
}
