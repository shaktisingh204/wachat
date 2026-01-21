'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
import { Textarea } from '@/components/ui/textarea';
import { LoaderCircle, Megaphone, ArrowLeft, AlertCircle } from 'lucide-react';
import { handleCreateAdCampaign } from '@/app/actions/facebook.actions';
import { useToast } from '@/hooks/use-toast';
import { useProject } from '@/context/project-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

const initialState = {
  message: null,
  error: null,
};

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? (
        <>
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          Creating...
        </>
      ) : (
        'Create Ad Campaign'
      )}
    </Button>
  );
}

export default function CreateAdPage() {
  const { activeProject, isLoadingProject } = useProject();
  const [state, formAction] = useActionState(handleCreateAdCampaign, initialState);
  const { toast } = useToast();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success!', description: state.message });
      formRef.current?.reset();
      router.push('/dashboard/facebook/ads');
    }
    if (state.error) {
      toast({ title: 'Error Creating Ad', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router]);
  
  if (isLoadingProject) {
    return <Skeleton className="h-96 w-full" />
  }

  if (!activeProject) {
      return (
          <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No Project Selected</AlertTitle>
              <AlertDescription>
                  Please select a project from the connections page before creating an ad.
              </AlertDescription>
          </Alert>
      )
  }

  const hasClickToWhatsAppSetup = !!(activeProject?.wabaId && activeProject.phoneNumbers && activeProject.phoneNumbers.length > 0);

  return (
    <div className="max-w-2xl mx-auto">
        <Button variant="ghost" asChild className="mb-4 -ml-4">
            <Link href="/dashboard/facebook/ads"><ArrowLeft className="mr-2 h-4 w-4" />Back to Ads Manager</Link>
        </Button>
        <form action={formAction} ref={formRef}>
          <input type="hidden" name="projectId" value={activeProject?._id.toString() || ''} />
          <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Megaphone className="h-6 w-6"/>Create New Ad Campaign</CardTitle>
                <CardDescription>
                Fill out the details below to launch a new Click-to-WhatsApp ad campaign.
                </CardDescription>
            </CardHeader>
             <CardContent className="space-y-6">
                {!hasClickToWhatsAppSetup && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>WhatsApp Project Required</AlertTitle>
                        <AlertDescription>
                        This feature is for "Click-to-WhatsApp" ads and requires a project connected to a WhatsApp Business Account with at least one phone number.
                        </AlertDescription>
                    </Alert>
                )}
                <div className="space-y-2">
                    <Label htmlFor="campaignName">Campaign Name</Label>
                    <Input id="campaignName" name="campaignName" placeholder="e.g., Summer Sale Promotion" required disabled={!hasClickToWhatsAppSetup} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="dailyBudget">Daily Budget (in Ad Account Currency)</Label>
                    <Input id="dailyBudget" name="dailyBudget" type="number" placeholder="10.00" required step="0.01" disabled={!hasClickToWhatsAppSetup} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="adMessage">Ad Primary Text</Label>
                    <Textarea id="adMessage" name="adMessage" placeholder="Check out our amazing new product!" required disabled={!hasClickToWhatsAppSetup} />
                </div>
            </CardContent>
            <CardFooter>
                 <SubmitButton disabled={!hasClickToWhatsAppSetup} />
            </CardFooter>
          </form>
        </Card>
    </div>
  );
}
