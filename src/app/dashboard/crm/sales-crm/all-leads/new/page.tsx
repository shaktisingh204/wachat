
'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoaderCircle, Save, ArrowLeft, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { addCrmLeadAndDeal } from '@/app/actions/crm-deals.actions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import { getCrmPipelines } from '@/app/actions/crm-pipelines.actions';
import type { WithId, CrmAccount, CrmPipeline, Tag, User } from '@/lib/definitions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { getSession } from '@/app/actions';
import { MultiSelectCombobox } from '@/components/wabasimplify/multi-select-combobox';

const initialState = { message: null, error: null };

const leadSources = [
    "Direct", "Quotation", "Self Lead", "Website", "Telephonic", "Social Media",
    "Referral", "Industry Expo", "Website Form", "IndiaMart Direct", 
    "IndiaMart Consumed Buy Lead", "IndiaMart Preferred Number Service", "Other",
    "IndiaMart Catalogue View", "IndiaMart Others", "Facebook Meta"
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="lg">
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
      Add Lead
    </Button>
  );
}

function NewLeadSkeleton() {
    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <Skeleton className="h-8 w-48" />
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-1/3" />
                    <Skeleton className="h-4 w-2/3" />
                </CardHeader>
                <CardContent className="space-y-6">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-10 w-full" />
                </CardContent>
                <CardFooter>
                    <Skeleton className="h-12 w-32" />
                </CardFooter>
            </Card>
        </div>
    )
}

export default function AddLeadPage() {
    const [state, formAction] = useActionState(addCrmLeadAndDeal, initialState);
    const router = useRouter();
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);
    const [isLoading, startLoading] = useTransition();

    const [accounts, setAccounts] = useState<WithId<CrmAccount>[]>([]);
    const [pipelines, setPipelines] = useState<CrmPipeline[]>([]);
    const [user, setUser] = useState<(Omit<User, 'password'> & { _id: string, tags?: Tag[] }) | null>(null);
    const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

    useEffect(() => {
        startLoading(async () => {
            const [accountsData, pipelinesData, sessionData] = await Promise.all([
                getCrmAccounts(),
                getCrmPipelines(),
                getSession(),
            ]);
            setAccounts(accountsData.accounts);
            setPipelines(pipelinesData);
            setUser(sessionData?.user || null);

            if(pipelinesData.length > 0) {
                setSelectedPipelineId(pipelinesData[0].id);
            }
        })
    }, []);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            router.push('/dashboard/crm/sales-crm/all-leads');
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router]);

    const selectedPipeline = pipelines.find(p => p.id === selectedPipelineId);
    
    if (isLoading) {
        return <NewLeadSkeleton />;
    }

    const tagOptions = (user?.tags || []).map(tag => ({
        value: tag._id,
        label: tag.name,
        color: tag.color,
    }));

    return (
        <div className="max-w-4xl mx-auto">
            <div>
                <Button variant="ghost" asChild className="mb-2 -ml-4">
                    <Link href="/dashboard/crm/sales-crm/all-leads"><ArrowLeft className="mr-2 h-4 w-4" />Back to All Leads</Link>
                </Button>
            </div>
            <form action={formAction} ref={formRef}>
                <input type="hidden" name="tagIds" value={selectedTagIds.join(',')} />
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <UserPlus className="h-6 w-6" />
                            Add New Lead
                        </CardTitle>
                        <CardDescription>Enter the details for your new lead and associated deal.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <h3 className="font-semibold text-lg border-b pb-2">Lead Details</h3>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="contactName">Contact Name *</Label>
                                <Input id="contactName" name="contactName" required placeholder="Full name of the lead contact" />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="email">Email *</Label>
                                <Input id="email" name="email" type="email" required placeholder="Email address of the lead" />
                            </div>
                        </div>
                         <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone</Label>
                                <div className="flex items-center">
                                    <span className="p-2 border rounded-l-md bg-muted">+91</span>
                                    <Input id="phone" name="phone" className="rounded-l-none" />
                                </div>
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="contactCountry">Contact Country *</Label>
                                <Select name="contactCountry" defaultValue="India" required>
                                    <SelectTrigger id="contactCountry"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="India">India</SelectItem>
                                        <SelectItem value="USA">United States</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <h3 className="font-semibold text-lg border-b pb-2 mt-6">Deal Details</h3>
                         <div className="space-y-2">
                            <Label htmlFor="organisation">Prospect Organisation *</Label>
                            <Select name="accountId" required>
                                <SelectTrigger id="organisation"><SelectValue placeholder="Select an existing company or type to create new..." /></SelectTrigger>
                                <SelectContent>
                                    {accounts.map(acc => <SelectItem key={acc._id.toString()} value={acc._id.toString()}>{acc.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="designation">Designation</Label>
                            <Input id="designation" name="jobTitle" placeholder="Designation, role or position of the lead" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="leadSubject">Lead Subject *</Label>
                            <Input id="leadSubject" name="name" required placeholder="e.g. Mobile App Development" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">Additional Description</Label>
                            <Textarea id="description" name="description" placeholder="Add all additional details, including links that may be helpful" />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="leadSource">Lead Source</Label>
                            <Select name="leadSource">
                                <SelectTrigger id="leadSource"><SelectValue placeholder="Select lead source..."/></SelectTrigger>
                                <SelectContent>
                                    {leadSources.map(source => (
                                        <SelectItem key={source} value={source}>{source}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="pipeline">Select Sales Pipeline *</Label>
                                <Select name="pipelineId" value={selectedPipelineId} onValueChange={setSelectedPipelineId} required>
                                    <SelectTrigger id="pipeline"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {pipelines.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="stage">Select Stage *</Label>
                                <Select name="stage" required>
                                    <SelectTrigger id="stage"><SelectValue placeholder="Select stage..." /></SelectTrigger>
                                    <SelectContent>
                                        {(selectedPipeline?.stages || []).map(stage => <SelectItem key={stage.id} value={stage.name}>{stage.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Labels</Label>
                             <MultiSelectCombobox 
                                options={tagOptions} 
                                selected={selectedTagIds}
                                onSelectionChange={setSelectedTagIds}
                                placeholder="Select labels..."
                            />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <SubmitButton />
                    </CardFooter>
                </Card>
            </form>
        </div>
    );
}
