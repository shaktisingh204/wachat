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
import { LoaderCircle, Megaphone, ArrowLeft, ArrowRight, AlertCircle, ShoppingBag, Send, Building, Target as TargetIcon, Upload, Check } from 'lucide-react';
import { handleCreateAdCampaign, getFacebookPagesForAdCreation, uploadAdImage } from '@/app/actions/ad-manager.actions';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import type { FacebookPage } from '@/lib/definitions';

const initialState: { message?: string; error?: string } = {
    message: undefined,
    error: undefined,
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
    const [state, formAction] = useActionState(handleCreateAdCampaign, initialState);
    const { toast } = useToast();
    const router = useRouter();

    const [currentStep, setCurrentStep] = useState(1);
    const [adAccountId, setAdAccountId] = useState<string | null>(null);
    const [pages, setPages] = useState<FacebookPage[]>([]);
    const [isLoading, startLoading] = useTransition();
    const [isUploading, startUploading] = useTransition();

    const [formData, setFormData] = useState({
        facebookPageId: '',
        campaignName: 'New Campaign',
        dailyBudget: '100',
        adMessage: '',
        destinationUrl: '',
        targetCountry: 'IN',
        minAge: 18,
        maxAge: 65,
        imageHash: '',
        imageUrl: '',
    });

    useEffect(() => {
        const storedAdAccountId = localStorage.getItem('activeAdAccountId');
        setAdAccountId(storedAdAccountId);
        startLoading(async () => {
            const result = await getFacebookPagesForAdCreation();
            if (result.pages && result.pages.length > 0) {
                setPages(result.pages);
                setFormData(prev => ({ ...prev, facebookPageId: result.pages![0].id }));
            }
        });
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name: string, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    }

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const uploadData = new FormData();
        uploadData.append('file', file);

        startUploading(async () => {
            const result = await uploadAdImage(uploadData);
            if (result.error) {
                toast({ title: 'Upload Failed', description: result.error, variant: 'destructive' });
            } else if (result.imageHash) {
                setFormData(prev => ({
                    ...prev,
                    imageHash: result.imageHash!,
                    imageUrl: result.imageUrl || ''
                }));
                toast({ title: 'Image Uploaded', description: 'Ad creative ready.' });
            }
        });
    };

    const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, 4));
    const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            router.push('/dashboard/ad-manager/campaigns');
        }
        if (state.error) {
            toast({ title: 'Error Creating Ad', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router]);

    if (isLoading) {
        return <Skeleton className="h-96 w-full max-w-2xl mx-auto" />
    }

    if (!adAccountId) {
        return (
            <Alert variant="destructive" className="max-w-xl mx-auto">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Ad Account Selected</AlertTitle>
                <AlertDescription>
                    Please select an Ad Account from the Ad Accounts page before creating an ad.
                </AlertDescription>
            </Alert>
        )
    }

    const StepIcon = steps[currentStep - 1].icon;

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
                            <Input value="Traffic (Link Clicks)" disabled />
                            <p className="text-xs text-muted-foreground">Automatically optimized for driving traffic.</p>
                        </div>
                    </CardContent>
                );
            case 2:
                return (
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="dailyBudget">Daily Budget (Account Currency)</Label>
                            <Input id="dailyBudget" name="dailyBudget" type="number" value={formData.dailyBudget} onChange={handleInputChange} required step="1" />
                        </div>
                        <Separator />
                        <div className="space-y-4">
                            <h4 className="font-medium">Audience Targeting</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="targetCountry">Country</Label>
                                    <Select name="targetCountry" value={formData.targetCountry} onValueChange={(val) => handleSelectChange('targetCountry', val)}>
                                        <SelectTrigger><SelectValue placeholder="Select Country" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="IN">India</SelectItem>
                                            <SelectItem value="US">United States</SelectItem>
                                            <SelectItem value="GB">United Kingdom</SelectItem>
                                            <SelectItem value="AE">United Arab Emirates</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Min Age: {formData.minAge}</Label>
                                    <Slider
                                        defaultValue={[formData.minAge]}
                                        max={65}
                                        min={18}
                                        step={1}
                                        onValueChange={(val) => setFormData(prev => ({ ...prev, minAge: val[0] }))}
                                    />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                );
            case 3:
                return (
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="facebookPageId">Facebook Page</Label>
                            <Select name="facebookPageId" value={formData.facebookPageId} onValueChange={(val) => handleSelectChange('facebookPageId', val)}>
                                <SelectTrigger><SelectValue placeholder="Select a page..." /></SelectTrigger>
                                <SelectContent>
                                    {pages.map(page => (
                                        <SelectItem key={page.id} value={page.id}>{page.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="imageUpload">Ad Image</Label>
                            <div className="flex items-center gap-4">
                                <Button type="button" variant="outline" className="relative cursor-pointer" disabled={isUploading}>
                                    {isUploading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                    Upload Image
                                    <input
                                        id="imageUpload"
                                        type="file"
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        accept="image/*"
                                        onChange={handleImageUpload}
                                    />
                                </Button>
                                {formData.imageUrl && (
                                    <div className="flex items-center text-green-600 space-x-2">
                                        <Check className="h-4 w-4" />
                                        <span className="text-sm">Uploaded!</span>
                                        <img src={formData.imageUrl} alt="Ad Preview" className="h-10 w-10 object-cover rounded border" />
                                    </div>
                                )}
                            </div>
                            {!formData.imageUrl && <p className="text-xs text-muted-foreground">Upload an image for your ad creative.</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="adMessage">Primary Text</Label>
                            <Textarea id="adMessage" name="adMessage" value={formData.adMessage} onChange={handleInputChange} placeholder="Ad copy goes here..." required className="min-h-24" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="destinationUrl">Destination URL</Label>
                            <Input id="destinationUrl" name="destinationUrl" type="url" value={formData.destinationUrl} onChange={handleInputChange} placeholder="https://..." required />
                        </div>
                    </CardContent>
                );
            case 4:
                return (
                    <CardContent className="space-y-4">
                        <h3 className="font-semibold">Review Your Campaign</h3>
                        <div className="p-4 border rounded-lg space-y-3 text-sm">
                            <div className="flex justify-between"><span className="text-muted-foreground">Campaign:</span><strong>{formData.campaignName}</strong></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Budget:</span><strong>{formData.dailyBudget}</strong></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Targeting:</span><strong>{formData.targetCountry}, {formData.minAge}+</strong></div>
                            <div className="flex justify-between items-start"><span className="text-muted-foreground">URL:</span><strong className="text-right truncate max-w-[200px]">{formData.destinationUrl}</strong></div>

                            {formData.imageUrl && (
                                <div className="mt-4">
                                    <span className="text-muted-foreground block mb-2">Creative Preview:</span>
                                    <div className="border rounded bg-muted/20 p-2 flex gap-3">
                                        <img src={formData.imageUrl} className="h-16 w-16 object-cover rounded" />
                                        <p className="text-xs text-muted-foreground italic line-clamp-3">"{formData.adMessage}"</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                );
            default:
                return null;
        }
    }


    return (
        <div className="max-w-2xl mx-auto">
            <Button variant="ghost" asChild className="mb-4 -ml-4">
                <Link href="/dashboard/ad-manager/campaigns"><ArrowLeft className="mr-2 h-4 w-4" />Back to Ads Manager</Link>
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

            <Card>
                <form action={formAction}>
                    <input type="hidden" name="adAccountId" value={adAccountId || ''} />
                    <input type="hidden" name="facebookPageId" value={formData.facebookPageId} />
                    <input type="hidden" name="campaignName" value={formData.campaignName} />
                    <input type="hidden" name="dailyBudget" value={formData.dailyBudget} />
                    <input type="hidden" name="adMessage" value={formData.adMessage} />
                    <input type="hidden" name="destinationUrl" value={formData.destinationUrl} />
                    <input type="hidden" name="targetCountry" value={formData.targetCountry} />
                    <input type="hidden" name="minAge" value={formData.minAge} />
                    <input type="hidden" name="imageHash" value={formData.imageHash} />

                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            {StepIcon && <StepIcon className="h-6 w-6" />}
                            Step {currentStep}: {steps[currentStep - 1].name}
                        </CardTitle>
                        <CardDescription>
                            {steps[currentStep - 1].description}
                        </CardDescription>
                    </CardHeader>

                    {renderStepContent()}

                    <CardFooter className="flex justify-between">
                        <Button type="button" variant="outline" onClick={prevStep} disabled={currentStep === 1}>Previous</Button>
                        {currentStep < 4 ? (
                            <Button type="button" onClick={nextStep} disabled={currentStep === 3 && !formData.imageHash}>
                                {currentStep === 3 && !formData.imageHash ? 'Upload Image Required' : 'Next'}
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        ) : (
                            <SubmitButton disabled={!formData.imageHash} />
                        )}
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
