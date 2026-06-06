/**
 * SabBigin contact create form — intentionally minimal.
 *
 * Posts via the existing `addCrmContact` server action (the same one the
 * full CRM contact form uses). Only the essential micro-business fields
 * are surfaced: name, email, phone, company, job title. No custom fields,
 * no segment picker, no rich lifecycle controls — that's the whole point
 * of the SabBigin SKU.
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Button, Card, Input, Label, useToast } from '@/components/sabcrm/20ui/compat';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { addCrmContact } from '@/app/actions/crm.actions';

import { SabbiginNav } from '../../_components/sabbigin-shell';

export default function SabbiginNewContactPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [pending, startTransition] = React.useTransition();

    function handleSubmit(formData: FormData) {
        startTransition(async () => {
            const r = await addCrmContact(null, formData);
            if ((r as { error?: string }).error) {
                toast({
                    title: 'Could not save contact',
                    description: (r as { error?: string }).error,
                    variant: 'destructive',
                });
                return;
            }
            toast({ title: 'Contact saved' });
            router.push('/dashboard/sabbigin/contacts');
        });
    }

    return (
        <EntityListShell title="New contact" subtitle="Just the essentials.">
            <div className="flex flex-col gap-4">
                <SabbiginNav active="/dashboard/sabbigin/contacts" />
                <Button asChild variant="ghost" size="sm" className="self-start">
                    <Link href="/dashboard/sabbigin/contacts">
                        <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                        Back
                    </Link>
                </Button>

                <Card className="p-5">
                    <form action={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field name="name" label="Name" required />
                        <Field name="email" label="Email" type="email" required />
                        <Field name="phone" label="Phone" />
                        <Field name="company" label="Company" />
                        <Field name="jobTitle" label="Job title" />
                        <div className="sm:col-span-2 flex justify-end">
                            <Button type="submit" size="sm" disabled={pending}>
                                {pending ? 'Saving…' : 'Save contact'}
                            </Button>
                        </div>
                    </form>
                </Card>
            </div>
        </EntityListShell>
    );
}

function Field({
    name,
    label,
    type = 'text',
    required,
}: {
    name: string;
    label: string;
    type?: string;
    required?: boolean;
}) {
    return (
        <div className="flex flex-col gap-1">
            <Label htmlFor={name}>{label}</Label>
            <Input id={name} name={name} type={type} required={required} />
        </div>
    );
}
