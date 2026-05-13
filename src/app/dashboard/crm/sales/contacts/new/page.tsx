'use client';

/**
 * New contact — `/dashboard/crm/sales/contacts/new`.
 *
 * Client form mirroring `/dashboard/crm/sales-crm/contacts/new`. Posts
 * to the canonical `addCrmContact` server action (which handles dual
 * Rust/Mongo dispatch internally), and on success routes back to the
 * sales/contacts list.
 */

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { ArrowLeft, LoaderCircle, Save, Users } from 'lucide-react';
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
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { addCrmContact } from '@/app/actions/crm.actions';

export const dynamic = 'force-dynamic';

const initialState: { message?: string; error?: string } = {};

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            Save contact
        </ZoruButton>
    );
}

export default function NewSalesContactPage() {
    const [state, formAction] = useActionState(addCrmContact, initialState);
    const router = useRouter();
    const { toast } = useZoruToast();

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Contact created', description: state.message });
            router.push('/dashboard/crm/sales/clients/contacts');
        }
        if (state?.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router]);

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="New Contact"
                subtitle="Add a person to your CRM contact book."
                icon={Users}
                actions={
                    <ZoruButton variant="ghost" asChild className="text-zoru-ink-muted hover:text-zoru-ink">
                        <Link href="/dashboard/crm/sales/clients/contacts">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back
                        </Link>
                    </ZoruButton>
                }
            />

            <ZoruCard className="p-6">
                <form action={formAction} className="flex flex-col gap-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="name">Full Name *</ZoruLabel>
                            <ZoruInput id="name" name="name" required />
                        </div>
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="email">Email *</ZoruLabel>
                            <ZoruInput id="email" name="email" type="email" required />
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="phone">Phone</ZoruLabel>
                            <ZoruInput id="phone" name="phone" />
                        </div>
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="company">Company</ZoruLabel>
                            <ZoruInput id="company" name="company" />
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="jobTitle">Job Title</ZoruLabel>
                            <ZoruInput id="jobTitle" name="jobTitle" />
                        </div>
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="owner">Owner</ZoruLabel>
                            <ZoruInput id="owner" name="owner" />
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="status">Status</ZoruLabel>
                            <ZoruSelect name="status" defaultValue="new_lead">
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
                            <ZoruSelect name="lifecycleStage">
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
                                defaultValue="0"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="source">Source</ZoruLabel>
                            <ZoruSelect name="source">
                                <ZoruSelectTrigger id="source">
                                    <ZoruSelectValue placeholder="Select source" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="website">Website</ZoruSelectItem>
                                    <ZoruSelectItem value="referral">Referral</ZoruSelectItem>
                                    <ZoruSelectItem value="social-media">Social Media</ZoruSelectItem>
                                    <ZoruSelectItem value="cold-outreach">
                                        Cold Outreach
                                    </ZoruSelectItem>
                                    <ZoruSelectItem value="event">Event</ZoruSelectItem>
                                    <ZoruSelectItem value="other">Other</ZoruSelectItem>
                                </ZoruSelectContent>
                            </ZoruSelect>
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="linkedinUrl">LinkedIn URL</ZoruLabel>
                            <ZoruInput id="linkedinUrl" name="linkedinUrl" />
                        </div>
                        <div className="space-y-1.5">
                            <ZoruLabel htmlFor="tags">Tags</ZoruLabel>
                            <ZoruInput
                                id="tags"
                                name="tags"
                                placeholder="Comma-separated tags"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <SubmitButton />
                    </div>
                </form>
            </ZoruCard>
        </div>
    );
}
