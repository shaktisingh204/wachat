'use client';

/**
 * SabBigin company create form (client island).
 *
 * Posts via the existing `addCrmAccount` server action — the same one the
 * full CRM account form uses — through `useActionState`. `addCrmAccount`
 * reads `businessName`/`name` plus industry/website/phone/city/country/
 * category/currency/logoUrl, returns `{ error?, message?, newClient? }`.
 *
 * The logo comes from SabFiles (no free-text URL paste) via SabFileUrlInput,
 * which renders a hidden `name="logoUrl"` input for the FormData.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Globe, MapPin, Phone, Save } from 'lucide-react';

import {
    Button,
    Card,
    CardHeader,
    CardTitle,
    CardBody,
    CardFooter,
    Field,
    Input,
    SelectField,
    toast,
} from '@/components/sabcrm/20ui';
import { SabFileUrlInput } from '@/components/sabfiles';
import { addCrmAccount } from '@/app/actions/crm-accounts.actions';

const COMPANIES_HREF = '/dashboard/sabbigin/companies';

const CATEGORY_OPTIONS = [
    { value: 'new', label: 'New' },
    { value: 'regular', label: 'Regular' },
    { value: 'key', label: 'Key account' },
    { value: 'strategic', label: 'Strategic' },
];

const CURRENCY_OPTIONS = [
    { value: 'INR', label: 'INR — Indian Rupee' },
    { value: 'USD', label: 'USD — US Dollar' },
    { value: 'EUR', label: 'EUR — Euro' },
    { value: 'GBP', label: 'GBP — British Pound' },
    { value: 'AED', label: 'AED — UAE Dirham' },
];

export function CompanyForm() {
    const router = useRouter();
    const [pending, startTransition] = React.useTransition();

    const [category, setCategory] = React.useState<string | null>('new');
    const [currency, setCurrency] = React.useState<string | null>('INR');
    const [logoUrl, setLogoUrl] = React.useState('');

    function handleSubmit(formData: FormData) {
        startTransition(async () => {
            const r = await addCrmAccount(null, formData);
            if (r.error) {
                toast.error({ title: 'Could not save company', description: r.error });
                return;
            }
            toast.success({
                title: 'Company saved',
                description: 'It is now in your account book.',
            });
            const newId = r.newClient?._id ? String(r.newClient._id) : null;
            router.push(newId ? `${COMPANIES_HREF}/${newId}` : COMPANIES_HREF);
            router.refresh();
        });
    }

    return (
        <form action={handleSubmit}>
            {/* SelectField is a button-based widget, so mirror its value into hidden inputs for FormData. */}
            <input type="hidden" name="category" value={category ?? ''} />
            <input type="hidden" name="currency" value={currency ?? ''} />

            <Card>
                <CardHeader>
                    <CardTitle>Company details</CardTitle>
                </CardHeader>
                <CardBody className="flex flex-col gap-4">
                    <Field label="Company name" required>
                        <Input
                            name="name"
                            placeholder="Acme Pvt Ltd"
                            iconLeft={Building2}
                            required
                            autoFocus
                        />
                    </Field>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="Industry">
                            <Input name="industry" placeholder="e.g. Manufacturing" />
                        </Field>
                        <Field label="Website">
                            <Input name="website" placeholder="https://acme.com" iconLeft={Globe} />
                        </Field>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="Phone">
                            <Input name="phone" placeholder="+91 98765 43210" iconLeft={Phone} />
                        </Field>
                        <Field label="City">
                            <Input name="city" placeholder="Mumbai" iconLeft={MapPin} />
                        </Field>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="Country">
                            <Input name="country" placeholder="India" />
                        </Field>
                        <Field label="Category">
                            <SelectField
                                value={category}
                                onChange={setCategory}
                                options={CATEGORY_OPTIONS}
                                placeholder="Select category"
                                aria-label="Category"
                            />
                        </Field>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="Currency">
                            <SelectField
                                value={currency}
                                onChange={setCurrency}
                                options={CURRENCY_OPTIONS}
                                placeholder="Select currency"
                                aria-label="Currency"
                            />
                        </Field>
                        <Field label="Logo" help="Pick from your SabFiles library or upload a new image.">
                            <SabFileUrlInput
                                name="logoUrl"
                                value={logoUrl}
                                onChange={setLogoUrl}
                                accept="image"
                                placeholder="No logo selected"
                                pickerTitle="Choose a company logo"
                            />
                        </Field>
                    </div>
                </CardBody>
                <CardFooter className="flex items-center justify-end gap-2">
                    <Button
                        type="button"
                        variant="secondary"
                        size="md"
                        onClick={() => router.push(COMPANIES_HREF)}
                        disabled={pending}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        size="md"
                        iconLeft={Save}
                        loading={pending}
                    >
                        Save company
                    </Button>
                </CardFooter>
            </Card>
        </form>
    );
}
