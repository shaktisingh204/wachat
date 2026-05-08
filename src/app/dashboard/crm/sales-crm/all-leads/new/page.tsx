'use client';
import { ZoruButton, ZoruCard, ZoruDatePicker, ZoruInput, ZoruLabel, ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue, ZoruSeparator, ZoruSkeleton, ZoruTextarea, useZoruToast } from '@/components/zoruui';
import { useActionState, useEffect, useRef, useState, useTransition, useCallback } from 'react';
import { useFormStatus } from 'react-dom';

import { LoaderCircle, ArrowLeft, UserPlus } from 'lucide-react';

import { addCrmLead } from '@/app/actions/crm-leads.actions';
import { getCrmPipelines } from '@/app/actions/crm-pipelines.actions';
import { getSession } from '@/app/actions/user.actions';
import type { WithId, CrmPipeline, User } from '@/lib/definitions';
import { EntityPicker } from '@/components/crm/entity-picker';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
        <ZoruButton type="submit" size="lg" disabled={pending}>
            Add Lead
        </ZoruButton>
    );
}

function NewLeadPageSkeleton() {
    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <ZoruSkeleton className="h-8 w-48" />
            <ZoruCard>
                <ZoruSkeleton className="h-8 w-1/3" />
                <ZoruSkeleton className="mt-2 h-4 w-2/3" />
                <div className="mt-6 space-y-6">
                    <ZoruSkeleton className="h-10 w-full" />
                    <ZoruSkeleton className="h-10 w-full" />
                    <ZoruSkeleton className="h-24 w-full" />
                    <ZoruSkeleton className="h-10 w-full" />
                </div>
                <ZoruSkeleton className="mt-6 h-12 w-32" />
            </ZoruCard>
        </div>
    );
}

export default function AddLeadPage() {
    const [state, formAction] = useActionState(addCrmLead, initialState);
    const router = useRouter();
    const { toast } = useZoruToast();
    const formRef = useRef<HTMLFormElement>(null);
    const [isLoading, startLoading] = useTransition();

    const [pipelines, setPipelines] = useState<CrmPipeline[]>([]);
    const [user, setUser] = useState<WithId<User> | null>(null);
    const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
    const [assignedToId, setAssignedToId] = useState<string>('');
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
        <div className="max-w-4xl">
            <div>
                <Link href="/dashboard/crm/sales-crm/all-leads" className="inline-flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-4 w-4" />Back to All Leads
                </Link>
            </div>
            <form action={formAction} ref={formRef}>
                <input type="hidden" name="nextFollowUp" value={nextFollowUp?.toISOString() || ''} />
                <input type="hidden" name="assignedTo" value={assignedToId} />
                <ZoruCard className="mt-4">
                    <div className="mb-6">
                        <h2 className="text-[20px] font-semibold text-foreground flex items-center gap-2">
                            <UserPlus className="h-5 w-5 text-accent-foreground" />
                            Add New Lead
                        </h2>
                        <p className="mt-0.5 text-[13px] text-muted-foreground">Enter the details for your new sales lead.</p>
                    </div>
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <ZoruLabel htmlFor="title" className="text-foreground">Lead Title / Subject *</ZoruLabel>
                            <ZoruInput id="title" name="title" required placeholder="e.g. Mobile App Development for Retail Client" className="h-10 rounded-lg border-border bg-card text-[13px]" />
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="value" className="text-foreground">Estimated Value</ZoruLabel>
                                <ZoruInput id="value" name="value" type="number" min={0} step="0.01" placeholder="e.g. 50000" className="h-10 rounded-lg border-border bg-card text-[13px]" />
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="currency" className="text-foreground">Currency</ZoruLabel>
                                <ZoruSelect name="currency" defaultValue="INR">
                                    <ZoruSelectTrigger id="currency"><ZoruSelectValue /></ZoruSelectTrigger>
                                    <ZoruSelectContent><ZoruSelectItem value="INR">INR</ZoruSelectItem><ZoruSelectItem value="USD">USD</ZoruSelectItem></ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                        </div>
                        <ZoruSeparator />
                        <h3 className="text-[15px] font-semibold text-foreground pb-2">Contact Information</h3>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="contactName" className="text-foreground">Contact Name *</ZoruLabel>
                                <ZoruInput id="contactName" name="contactName" required placeholder="Full name of the lead contact" className="h-10 rounded-lg border-border bg-card text-[13px]" />
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="email" className="text-foreground">Email *</ZoruLabel>
                                <ZoruInput id="email" name="email" type="email" required placeholder="Email address of the lead" className="h-10 rounded-lg border-border bg-card text-[13px]" />
                            </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2"><ZoruLabel htmlFor="phone" className="text-foreground">Phone</ZoruLabel><ZoruInput id="phone" name="phone" className="h-10 rounded-lg border-border bg-card text-[13px]" /></div>
                            <div className="space-y-2"><ZoruLabel htmlFor="company" className="text-foreground">Company</ZoruLabel><ZoruInput id="company" name="company" className="h-10 rounded-lg border-border bg-card text-[13px]" /></div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2"><ZoruLabel htmlFor="website" className="text-foreground">Website</ZoruLabel><ZoruInput id="website" name="website" className="h-10 rounded-lg border-border bg-card text-[13px]" /></div>
                            <div className="space-y-2"><ZoruLabel htmlFor="contactCountry" className="text-foreground">Contact Country</ZoruLabel><ZoruSelect name="contactCountry" defaultValue="India"><ZoruSelectTrigger id="contactCountry"><ZoruSelectValue /></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="India">India</ZoruSelectItem><ZoruSelectItem value="USA">United States</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                        </div>
                        <ZoruSeparator />
                        <h3 className="text-[15px] font-semibold text-foreground pb-2">Lead Status & Assignment</h3>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="source" className="text-foreground">Lead Source</ZoruLabel>
                                <ZoruSelect name="source">
                                    <ZoruSelectTrigger id="source"><ZoruSelectValue placeholder="Select lead source..." /></ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        {leadSources.map(source => (<ZoruSelectItem key={source} value={source}>{source}</ZoruSelectItem>))}
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="status" className="text-foreground">Lead Status</ZoruLabel>
                                <ZoruSelect name="status" defaultValue="New">
                                    <ZoruSelectTrigger id="status"><ZoruSelectValue /></ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        {leadStatuses.map(s => (<ZoruSelectItem key={s} value={s}>{s}</ZoruSelectItem>))}
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="pipelineId" className="text-foreground">Sales Pipeline</ZoruLabel>
                                <input type="hidden" name="pipelineId" value={selectedPipelineId} />
                                <EntityPicker
                                    entity="pipeline"
                                    value={selectedPipelineId || null}
                                    placeholder="Select pipeline..."
                                    onChange={(next) => {
                                        const id = Array.isArray(next) ? next[0] ?? '' : (next ?? '');
                                        setSelectedPipelineId(id);
                                    }}
                                />
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="stage" className="text-foreground">Pipeline Stage</ZoruLabel>
                                <ZoruSelect name="stage">
                                    <ZoruSelectTrigger id="stage"><ZoruSelectValue placeholder="Select stage..." /></ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        {(selectedPipeline?.stages || []).map(stage => <ZoruSelectItem key={stage.id} value={stage.name}>{stage.name}</ZoruSelectItem>)}
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="assignedTo" className="text-foreground">Assigned To</ZoruLabel>
                                <EntityPicker
                                    entity="user"
                                    value={assignedToId || null}
                                    placeholder="Unassigned"
                                    onChange={(next) => {
                                        const id = Array.isArray(next) ? next[0] ?? '' : (next ?? '');
                                        setAssignedToId(id);
                                    }}
                                />
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel className="text-foreground">Next Follow-up</ZoruLabel>
                                <ZoruDatePicker value={nextFollowUp} onChange={setNextFollowUp} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <ZoruLabel htmlFor="description" className="text-foreground">Notes</ZoruLabel>
                            <ZoruTextarea id="description" name="description" placeholder="Any additional notes or details about this lead..." />
                        </div>
                    </div>
                    <div className="mt-6">
                        <SubmitButton />
                    </div>
                </ZoruCard>
            </form>
        </div>
    );
}
