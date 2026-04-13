'use client';

import { useActionState, useEffect, useRef, useState, useTransition, useCallback } from 'react';
import { useFormStatus } from 'react-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoaderCircle, ArrowLeft, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { addCrmLead } from '@/app/actions/crm-leads.actions';
import { getCrmPipelines } from '@/app/actions/crm-pipelines.actions';
import { getSession } from '@/app/actions/user.actions';
import type { WithId, CrmPipeline, User } from '@/lib/definitions';
import { SmartPipelineSelect } from '@/components/crm/sales-crm/smart-pipeline-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePicker } from '@/components/ui/date-picker';
import { Separator } from '@/components/ui/separator';

import { ClayButton, ClayCard } from '@/components/clay';

const initialState: { message?: string; error?: string; leadId?: string } = { message: undefined, error: undefined, leadId: undefined };

const leadStatuses = [
    "New", "Contacted", "Qualified", "Unqualified", "Converted",
];

const leadSources = [
    "Website", "Referral", "Cold Call", "Social Media", "Email Campaign", "Advertisement", "Partner", "Other",
];

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <ClayButton type="submit" variant="obsidian" size="lg" disabled={pending} leading={pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : undefined}>
            Add Lead
        </ClayButton>
    );
}

function NewLeadPageSkeleton() {
    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <Skeleton className="h-8 w-48" />
            <ClayCard>
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="mt-2 h-4 w-2/3" />
                <div className="mt-6 space-y-6">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
                <Skeleton className="mt-6 h-12 w-32" />
            </ClayCard>
        </div>
    );
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

            if (pipelinesData.length > 0 && !selectedPipelineId) {
                setSelectedPipelineId(pipelinesData[0].id);
            }
        });
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
                <Link href="/dashboard/crm/sales-crm/all-leads" className="inline-flex items-center gap-2 text-[13px] text-clay-ink-muted hover:text-clay-ink">
                    <ArrowLeft className="h-4 w-4" />Back to All Leads
                </Link>
            </div>
            <form action={formAction} ref={formRef}>
                <input type="hidden" name="nextFollowUp" value={nextFollowUp?.toISOString() || ''} />
                <ClayCard className="mt-4">
                    <div className="mb-6">
                        <h2 className="text-[20px] font-semibold text-clay-ink flex items-center gap-2">
                            <UserPlus className="h-5 w-5 text-clay-rose-ink" />
                            Add New Lead
                        </h2>
                        <p className="mt-0.5 text-[13px] text-clay-ink-muted">Enter the details for your new sales lead.</p>
                    </div>
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="title" className="text-clay-ink">Lead Title / Subject *</Label>
                            <Input id="title" name="title" required placeholder="e.g. Mobile App Development for Retail Client" className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]" />
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="value" className="text-clay-ink">Estimated Value</Label>
                                <Input id="value" name="value" type="number" placeholder="e.g. 50000" className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="currency" className="text-clay-ink">Currency</Label>
                                <Select name="currency" defaultValue="INR">
                                    <SelectTrigger id="currency"><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="INR">INR</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
                                </Select>
                            </div>
                        </div>
                        <Separator />
                        <h3 className="text-[15px] font-semibold text-clay-ink pb-2">Contact Information</h3>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="contactName" className="text-clay-ink">Contact Name *</Label>
                                <Input id="contactName" name="contactName" required placeholder="Full name of the lead contact" className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-clay-ink">Email *</Label>
                                <Input id="email" name="email" type="email" required placeholder="Email address of the lead" className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]" />
                            </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2"><Label htmlFor="phone" className="text-clay-ink">Phone</Label><Input id="phone" name="phone" className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]" /></div>
                            <div className="space-y-2"><Label htmlFor="company" className="text-clay-ink">Company</Label><Input id="company" name="company" className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]" /></div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2"><Label htmlFor="website" className="text-clay-ink">Website</Label><Input id="website" name="website" className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]" /></div>
                            <div className="space-y-2"><Label htmlFor="contactCountry" className="text-clay-ink">Contact Country</Label><Select name="contactCountry" defaultValue="India"><SelectTrigger id="contactCountry"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="India">India</SelectItem><SelectItem value="USA">United States</SelectItem></SelectContent></Select></div>
                        </div>
                        <Separator />
                        <h3 className="text-[15px] font-semibold text-clay-ink pb-2">Lead Status & Assignment</h3>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="source" className="text-clay-ink">Lead Source</Label>
                                <Select name="source">
                                    <SelectTrigger id="source"><SelectValue placeholder="Select lead source..." /></SelectTrigger>
                                    <SelectContent>
                                        {leadSources.map(source => (<SelectItem key={source} value={source}>{source}</SelectItem>))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="status" className="text-clay-ink">Lead Status</Label>
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
                                <Label htmlFor="pipelineId" className="text-clay-ink">Sales Pipeline</Label>
                                <input type="hidden" name="pipelineId" value={selectedPipelineId} />
                                <SmartPipelineSelect
                                    value={selectedPipelineId}
                                    onSelect={setSelectedPipelineId}
                                    initialOptions={pipelines.map(p => ({ value: p.id, label: p.name }))}
                                    onPipelineAdded={(newPipeline: CrmPipeline) => {
                                        setPipelines(prev => [...prev, newPipeline]);
                                        setSelectedPipelineId(newPipeline.id);
                                    }}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="stage" className="text-clay-ink">Pipeline Stage</Label>
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
                                <Label htmlFor="assignedTo" className="text-clay-ink">Assigned To</Label>
                                <Select name="assignedTo"><SelectTrigger id="assignedTo"><SelectValue placeholder="Unassigned" /></SelectTrigger><SelectContent>
                                    <SelectItem value={user._id.toString()}>Me ({user.name})</SelectItem>
                                </SelectContent></Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-clay-ink">Next Follow-up</Label>
                                <DatePicker date={nextFollowUp} setDate={setNextFollowUp} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description" className="text-clay-ink">Notes</Label>
                            <Textarea id="description" name="description" placeholder="Any additional notes or details about this lead..." />
                        </div>
                    </div>
                    <div className="mt-6">
                        <SubmitButton />
                    </div>
                </ClayCard>
            </form>
        </div>
    );
}
