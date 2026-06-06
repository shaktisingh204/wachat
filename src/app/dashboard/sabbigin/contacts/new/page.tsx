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
import { ArrowLeft } from 'lucide-react';

import {
    Button,
    Card,
    CardBody,
    Field,
    Input,
    PageHeader,
    PageHeaderHeading,
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
        <div className="flex w-full flex-col gap-4">
            <SabbiginNav active={CONTACTS_HREF} />

            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>New contact</PageTitle>
                    <PageDescription>Just the essentials.</PageDescription>
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

            <Card>
                <CardBody>
                    <form
                        action={handleSubmit}
                        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
                    >
                        <Field label="Name" required>
                            <Input name="name" type="text" />
                        </Field>
                        <Field label="Email" required>
                            <Input name="email" type="email" />
                        </Field>
                        <Field label="Phone">
                            <Input name="phone" type="text" />
                        </Field>
                        <Field label="Company">
                            <Input name="company" type="text" />
                        </Field>
                        <Field label="Job title">
                            <Input name="jobTitle" type="text" />
                        </Field>
                        <div className="flex justify-end sm:col-span-2">
                            <Button type="submit" size="sm" loading={pending}>
                                {pending ? 'Saving' : 'Save contact'}
                            </Button>
                        </div>
                    </form>
                </CardBody>
            </Card>
        </div>
    );
}
