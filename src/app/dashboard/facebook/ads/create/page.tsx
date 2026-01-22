
'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
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
import { LoaderCircle, Megaphone, ArrowLeft, ArrowRight, AlertCircle, ShoppingBag, Send, Building, Target as TargetIcon } from 'lucide-react';
import { handleCreateAdCampaign } from '@/app/actions/facebook.actions';
import { useToast } from '@/hooks/use-toast';
import { useProject } from '@/context/project-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

const initialState = {
  message: null,
  error: null,
};

const steps = [
    { id: 1, name: 'Campaign', description: 'Set your goal', icon: Megaphone },
    { id: 2, name: 'Ad Set', description: 'Define audience & budget', icon: TargetIcon },
    { id: 3, name: 'Ad Creative', description: 'Design your ad', icon: ShoppingBag },
    { id: 4, name: 'Review', description: 'Confirm and launch', icon: Send },
];


function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending || disabled} size="lg">
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

    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({
        campaignName: 'New Campaign',
        dailyBudget: '10',
        adMessage: '',
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, 4));
    const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));
    
    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
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

    const renderStepContent = () => {
        switch (currentStep) {
            case 1:
                return (
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="campaignName">Campaign Name</Label>
                            <Input id="campaignName" name="campaignName" value={formData.campaignName} onChange={handleInputChange} required />
                        </div>
                        <div className="space-y-2">
                            <Label>Campaign Objective</Label>
                            <Input value="Messages" disabled />
                            <p className="text-xs text-muted-foreground">For "Click to WhatsApp" ads, the objective is always set to Messages.</p>
                        </div>
                    </CardContent>
                );
            case 2:
                 return (
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="dailyBudget">Daily Budget (in Ad Account Currency)</Label>
                            <Input id="dailyBudget" name="dailyBudget" type="number" value={formData.dailyBudget} onChange={handleInputChange} required step="0.01" />
                        </div>
                        <Separator />
                        <div>
                            <h4 className="font-medium mb-2">Targeting</h4>
                            <p className="text-sm text-muted-foreground">Advanced targeting options can be configured in Meta Ads Manager after creation. For now, we will target India, ages 18+.</p>
                        </div>
                    </CardContent>
                );
            case 3:
                return (
                     <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="adMessage">Ad Primary Text</Label>
                            <Textarea id="adMessage" name="adMessage" value={formData.adMessage} onChange={handleInputChange} placeholder="Check out our amazing new product!" required className="min-h-40"/>
                        </div>
                        <div className="space-y-2">
                            <Label>Media</Label>
                            <div className="text-center p-8 bg-muted rounded-md text-muted-foreground">
                                <p>A placeholder image will be used. You can edit the ad creative in Ads Manager later.</p>
                            </div>
                        </div>
                    </CardContent>
                );
            case 4:
                return (
                    <CardContent className="space-y-4">
                        <h3 className="font-semibold">Review Your Campaign</h3>
                        <div className="p-4 border rounded-lg space-y-3">
                             <div className="flex justify-between"><span className="text-muted-foreground">Campaign Name:</span><strong>{formData.campaignName}</strong></div>
                             <div className="flex justify-between"><span className="text-muted-foreground">Daily Budget:</span><strong>{formData.dailyBudget}</strong></div>
                             <div className="flex justify-between items-start"><span className="text-muted-foreground">Ad Message:</span><p className="w-1/2 text-right">"{formData.adMessage}"</p></div>
                        </div>
                    </CardContent>
                );
            default:
                return null;
        }
    }

    const StepIcon = steps[currentStep - 1].icon;

    return (
        <div className="max-w-2xl mx-auto">
            <Button variant="ghost" asChild className="mb-4 -ml-4">
                <Link href="/dashboard/facebook/ads"><ArrowLeft className="mr-2 h-4 w-4" />Back to Ads Manager</Link>
            </Button>
            <div className="mb-8">
                 <ol className="flex items-center w-full">
                    {steps.map((step, index) => (
                        <li key={step.id} className={'flex w-full items-center'}>
                            <span className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${currentStep >= step.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                                <step.icon className="h-5 w-5" />
                            </span>
                             {index < steps.length - 1 && <div className={`flex-1 w-full h-1 ${currentStep > step.id ? 'bg-primary' : 'bg-muted'}`} />}
                        </li>
                    ))}
                </ol>
            </div>
            
            <form action={formAction}>
              <input type="hidden" name="projectId" value={activeProject?._id.toString() || ''} />
              <input type="hidden" name="campaignName" value={formData.campaignName} />
              <input type="hidden" name="dailyBudget" value={formData.dailyBudget} />
              <input type="hidden" name="adMessage" value={formData.adMessage} />
              <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><StepIcon className="h-6 w-6"/>Step {currentStep}: {steps[currentStep-1].name}</CardTitle>
                    <CardDescription>
                        {steps[currentStep-1].description}
                    </CardDescription>
                </CardHeader>
                 {!hasClickToWhatsAppSetup && (
                    <CardContent>
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>WhatsApp Project Required</AlertTitle>
                            <AlertDescription>
                            This ad creation tool is specifically for "Click-to-WhatsApp" ads and requires a project connected to a WhatsApp Business Account with at least one phone number.
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                 )}
                 
                 <div className={!hasClickToWhatsAppSetup ? 'opacity-50 pointer-events-none' : ''}>
                    {renderStepContent()}
                 </div>

                <CardFooter className="flex justify-between">
                    <Button type="button" variant="outline" onClick={prevStep} disabled={currentStep === 1}>Previous</Button>
                    {currentStep < 4 ? (
                        <Button type="button" onClick={nextStep} disabled={!hasClickToWhatsAppSetup}>Next<ArrowRight className="ml-2 h-4 w-4" /></Button>
                    ) : (
                        <SubmitButton disabled={!hasClickToWhatsAppSetup} />
                    )}
                </CardFooter>
              </Card>
            </form>
        </div>
    );
}

