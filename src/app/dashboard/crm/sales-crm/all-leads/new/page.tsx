
'use client';

import { useActionState, useEffect, useRef, useState, useTransition, useCallback } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoaderCircle, Save, ArrowLeft, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { addCrmLead } from '@/app/actions/crm-leads.actions.ts';
import { getCrmPipelines } from '@/app/actions/crm-pipelines.actions';
import { getSession } from '@/app/actions/index.ts';
import type { WithId, CrmPipeline, User } from '@/lib/definitions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePicker } from '@/components/ui/date-picker';

const initialState = { message: null, error: null };

const leadSources = [
    "Direct", "Quotation", "Self Lead", "Website", "Telephonic", "Social Media",
    "Referral", "Industry Expo", "Website Form", "IndiaMart Direct", 
    "IndiaMart Consumed Buy Lead", "IndiaMart Preferred Number Service", "Other",
    "IndiaMart Catalogue View", "IndiaMart Others", "Facebook Meta"
];

const leadStatuses = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Converted', 'Unqualified'];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="lg">
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
      Add Lead
    </Button>
  );
}

function NewLeadPageSkeleton() {
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
    const [state, formAction] = useActionState(addCrmLead, initialState);
    const router = useRouter();
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);
    const [isLoading, startLoading] = useTransition();

    const [pipelines, setPipelines] = useState<CrmPipeline[]>([]);
    const [user, setUser] = useState<WithId<User> | null>(null);
    const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
    const [nextFollowUp, setNextFollowUp] = useState<Date | undefined>();

    const fetchData = useCallback(() => {
        startLoading(async () => {
            const [pipelinesData, sessionData] = await Promise.all([
                getCrmPipelines(),
                getSession(),
            ]);
            setPipelines(pipelinesData);
            setUser(sessionData?.user || null);

            if(pipelinesData.length > 0 && !selectedPipelineId) {
                setSelectedPipelineId(pipelinesData[0].id);
            }
        })
    }, [selectedPipelineId]);
    
    useEffect(() => {
        fetchData();
    }, [fetchData]);

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
    
    if (isLoading || !user) {
        return <NewLeadPageSkeleton />;
    }

    return (
        <div className="max-w-4xl mx-auto">
            <div>
                <Button variant="ghost" asChild className="mb-2 -ml-4">
                    <Link href="/dashboard/crm/sales-crm/all-leads"><ArrowLeft className="mr-2 h-4 w-4" />Back to All Leads</Link>
                </Button>
            </div>
            <form action={formAction} ref={formRef}>
                <input type="hidden" name="nextFollowUp" value={nextFollowUp?.toISOString() || ''} />
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <UserPlus className="h-6 w-6" />
                            Add New Lead
                        </CardTitle>
                        <CardDescription>Enter the details for your new sales lead.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="title">Lead Title / Subject *</Label>
                            <Input id="title" name="title" required placeholder="e.g. Mobile App Development for Retail Client" />
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                             <div className="space-y-2">
                                <Label htmlFor="value">Estimated Value</Label>
                                <Input id="value" name="value" type="number" placeholder="e.g. 50000" />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="currency">Currency</Label>
                                <Select name="currency" defaultValue="INR">
                                    <SelectTrigger id="currency"><SelectValue/></SelectTrigger>
                                    <SelectContent><SelectItem value="INR">INR</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
                                </Select>
                            </div>
                        </div>
                        <Separator />
                        <h3 className="font-semibold text-lg pb-2">Contact Information</h3>
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
                            <div className="space-y-2"><Label htmlFor="phone">Phone</Label><Input id="phone" name="phone" /></div>
                            <div className="space-y-2"><Label htmlFor="company">Company</Label><Input id="company" name="company" /></div>
                        </div>
                         <div className="grid md:grid-cols-2 gap-4">
                             <div className="space-y-2"><Label htmlFor="website">Website</Label><Input id="website" name="website" /></div>
                            <div className="space-y-2"><Label htmlFor="contactCountry">Contact Country</Label><Select name="contactCountry" defaultValue="India"><SelectTrigger id="contactCountry"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="India">India</SelectItem><SelectItem value="USA">United States</SelectItem></SelectContent></Select></div>
                        </div>
                         <Separator />
                         <h3 className="font-semibold text-lg pb-2">Lead Status & Assignment</h3>
                          <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="source">Lead Source</Label>
                                <Select name="source">
                                    <SelectTrigger id="source"><SelectValue placeholder="Select lead source..."/></SelectTrigger>
                                    <SelectContent>
                                        {leadSources.map(source => (<SelectItem key={source} value={source}>{source}</SelectItem>))}
                                    </SelectContent>
                                </Select>
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="status">Lead Status</Label>
                                <Select name="status" defaultValue="New">
                                    <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {leadStatuses.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="pipelineId">Sales Pipeline</Label>
                                <Select name="pipelineId" value={selectedPipelineId} onValueChange={setSelectedPipelineId}>
                                    <SelectTrigger id="pipeline"><SelectValue placeholder="Select a pipeline..."/></SelectTrigger>
                                    <SelectContent>
                                        {pipelines.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="stage">Pipeline Stage</Label>
                                <Select name="stage">
                                    <SelectTrigger id="stage"><SelectValue placeholder="Select stage..." /></SelectTrigger>
                                    <SelectContent>
                                        {(selectedPipeline?.stages || []).map(stage => <SelectItem key={stage.id} value={stage.name}>{stage.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                         <div className="grid md:grid-cols-2 gap-4">
                             <div className="space-y-2">
                                <Label htmlFor="assignedTo">Assigned To</Label>
                                <Select name="assignedTo"><SelectTrigger id="assignedTo"><SelectValue placeholder="Unassigned"/></SelectTrigger><SelectContent>
                                    <SelectItem value={user._id.toString()}>Me ({user.name})</SelectItem>
                                </SelectContent></Select>
                            </div>
                             <div className="space-y-2">
                                <Label>Next Follow-up</Label>
                                <DatePicker date={nextFollowUp} setDate={setNextFollowUp} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">Notes</Label>
                            <Textarea id="description" name="description" placeholder="Any additional notes or details about this lead..." />
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

