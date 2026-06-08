/**
 * SabBigin contact create form, intentionally minimal.
 *
 * Posts via the existing `addCrmContact` server action (the same one the
 * full CRM contact form uses). Only the essential micro-business fields
 * are surfaced: name, email, phone, company, job title. No custom fields,
 * no segment picker, no rich lifecycle controls, that is the whole point
 * of the SabBigin SKU.
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Briefcase, Building2, Mail, Phone, User } from 'lucide-react';

import {
    Button,
    Card,
    CardHeader,
    CardTitle,
    CardBody,
    CardFooter,
    Field,
    Input,
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
    PageActions,
    useToast,
} from '@/components/sabcrm/20ui';
import { addCrmContact } from '@/app/actions/crm.actions';

import { SabbiginNav } from '../../_components/sabbigin-shell';

const CONTACTS_HREF = '/dashboard/sabbigin/contacts';

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
                    tone: 'danger',
                });
                return;
            }
            toast({ title: 'Contact saved', tone: 'success' });
            router.push(CONTACTS_HREF);
        });
    }

    return (
        <div className="20ui flex w-full flex-col gap-5">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>SabBigin contact</PageEyebrow>
                    <PageTitle>New contact</PageTitle>
                    <PageDescription>
                        Capture the essentials now. You can add more in the full CRM later.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Button
                        variant="ghost"
                        size="sm"
                        iconLeft={ArrowLeft}
                        onClick={() => router.push(CONTACTS_HREF)}
                    >
                        Back
                    </Button>
                </PageActions>
            </PageHeader>

            <SabbiginNav active={CONTACTS_HREF} />

            <Card padding="none" className="max-w-2xl">
                <form action={handleSubmit}>
                    <CardHeader>
                        <CardTitle className="inline-flex items-center gap-2">
                            <User className="h-4 w-4 text-[var(--st-accent)]" strokeWidth={2} aria-hidden="true" />
                            Contact details
                        </CardTitle>
                    </CardHeader>
                    <CardBody className="grid grid-cols-1 gap-4 pt-0 sm:grid-cols-2">
                        <Field label="Name" required>
                            <Input name="name" type="text" iconLeft={User} placeholder="Aanya Sharma" />
                        </Field>
                        <Field label="Email" required>
                            <Input
                                name="email"
                                type="email"
                                iconLeft={Mail}
                                placeholder="aanya@example.com"
                            />
                        </Field>
                        <Field label="Phone">
                            <Input name="phone" type="text" iconLeft={Phone} placeholder="+91 98765 43210" />
                        </Field>
                        <Field label="Company">
                            <Input
                                name="company"
                                type="text"
                                iconLeft={Building2}
                                placeholder="Northwind Trading"
                            />
                        </Field>
                        <Field label="Job title" className="sm:col-span-2">
                            <Input
                                name="jobTitle"
                                type="text"
                                iconLeft={Briefcase}
                                placeholder="Head of operations"
                            />
                        </Field>
                    </CardBody>
                    <CardFooter className="justify-end gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(CONTACTS_HREF)}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" size="sm" loading={pending}>
                            {pending ? 'Saving' : 'Save contact'}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
