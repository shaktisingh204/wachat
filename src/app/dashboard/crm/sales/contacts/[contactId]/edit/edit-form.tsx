'use client';

/**
 * Client form island for the Edit Contact page. Posts to
 * `updateCrmContact` (dual Rust/Mongo dispatch handled by the action).
 */

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { ArrowLeft, LoaderCircle, Save } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
    ZoruButton,
    ZoruCard,
    ZoruInput,
    ZoruLabel,
    ZoruSelect,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
    useZoruToast,
} from '@/components/zoruui';
import { updateCrmContact } from '@/app/actions/crm.actions';
import { EntityFormField } from '@/components/crm/entity-form-field';

const initialState: { message?: string; error?: string; contactId?: string } = {};

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            Save changes
        </ZoruButton>
    );
}

export function EditContactForm({
    contactId,
    initial,
}: {
    contactId: string;
    initial: Record<string, any>;
}) {
    const [state, formAction] = useActionState(updateCrmContact, initialState);
    const router = useRouter();
    const { toast } = useZoruToast();

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Contact updated', description: state.message });
            router.push('/dashboard/crm/sales/clients/contacts');
        }
        if (state?.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router]);

    const tagsValue = Array.isArray(initial.tags) ? initial.tags.join(', ') : '';

    return (
        <ZoruCard className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                <input type="hidden" name="contactId" value={contactId} />

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="name">Full Name *</ZoruLabel>
                        <ZoruInput
                            id="name"
                            name="name"
                            required
                            defaultValue={initial.name ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="email">Email *</ZoruLabel>
                        <ZoruInput
                            id="email"
                            name="email"
                            type="email"
                            required
                            defaultValue={initial.email ?? ''}
                        />
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="phone">Phone</ZoruLabel>
                        <ZoruInput
                            id="phone"
                            name="phone"
                            defaultValue={initial.phone ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="company">Company</ZoruLabel>
                        <ZoruInput
                            id="company"
                            name="company"
                            defaultValue={initial.company ?? ''}
                        />
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="jobTitle">Job Title</ZoruLabel>
                        <EntityFormField
                            entity="jobTitle"
                            name="jobTitle"
                            initialId={initial.jobTitle ?? null}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="owner">Owner</ZoruLabel>
                        <EntityFormField
                            entity="user"
                            name="owner"
                            initialId={initial.owner ?? null}
                            placeholder="Sales rep"
                        />
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="status">Status</ZoruLabel>
                        <ZoruSelect
                            name="status"
                            defaultValue={initial.status ?? 'new_lead'}
                        >
                            <ZoruSelectTrigger id="status">
                                <ZoruSelectValue placeholder="Select status" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="new_lead">New lead</ZoruSelectItem>
                                <ZoruSelectItem value="contacted">Contacted</ZoruSelectItem>
                                <ZoruSelectItem value="qualified">Qualified</ZoruSelectItem>
                                <ZoruSelectItem value="unqualified">Unqualified</ZoruSelectItem>
                                <ZoruSelectItem value="customer">Customer</ZoruSelectItem>
                                <ZoruSelectItem value="imported">Imported</ZoruSelectItem>
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="lifecycleStage">Lifecycle Stage</ZoruLabel>
                        <ZoruSelect
                            name="lifecycleStage"
                            defaultValue={initial.lifecycleStage ?? undefined}
                        >
                            <ZoruSelectTrigger id="lifecycleStage">
                                <ZoruSelectValue placeholder="Select stage" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="subscriber">Subscriber</ZoruSelectItem>
                                <ZoruSelectItem value="lead">Lead</ZoruSelectItem>
                                <ZoruSelectItem value="marketing-qualified-lead">
                                    Marketing Qualified Lead
                                </ZoruSelectItem>
                                <ZoruSelectItem value="sales-qualified-lead">
                                    Sales Qualified Lead
                                </ZoruSelectItem>
                                <ZoruSelectItem value="opportunity">Opportunity</ZoruSelectItem>
                                <ZoruSelectItem value="customer">Customer</ZoruSelectItem>
                                <ZoruSelectItem value="evangelist">Evangelist</ZoruSelectItem>
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="leadScore">Lead Score</ZoruLabel>
                        <ZoruInput
                            id="leadScore"
                            name="leadScore"
                            type="number"
                            min="0"
                            max="100"
                            defaultValue={initial.leadScore ?? 0}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="source">Source</ZoruLabel>
                        <EntityFormField
                            entity="leadSource"
                            name="source"
                            initialId={initial.source ?? null}
                            placeholder="Select source"
                        />
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="linkedinUrl">LinkedIn URL</ZoruLabel>
                        <ZoruInput
                            id="linkedinUrl"
                            name="linkedinUrl"
                            defaultValue={initial.linkedinUrl ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="tags">Tags</ZoruLabel>
                        <ZoruInput
                            id="tags"
                            name="tags"
                            defaultValue={tagsValue}
                            placeholder="Comma-separated tags"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3 justify-end">
                    <ZoruButton variant="ghost" asChild>
                        <Link href="/dashboard/crm/sales/clients/contacts">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Cancel
                        </Link>
                    </ZoruButton>
                    <SubmitButton />
                </div>
            </form>
        </ZoruCard>
    );
}
