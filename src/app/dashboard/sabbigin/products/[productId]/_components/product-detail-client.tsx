'use client';

/**
 * SabBigin product detail (client island).
 *
 * View mode shows name / SKU / price / description. "Edit" reveals an inline
 * form posting through `updateSabbiginProduct` (lean SabBigin action writing
 * name/sku/price/currency/description to `crm_products`).
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Package, Pencil, Save, Tag, X } from 'lucide-react';

import {
    Button,
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    Field,
    Input,
    SelectField,
    Textarea,
    toast,
} from '@/components/sabcrm/20ui';
import { updateSabbiginProduct } from '@/app/actions/sabbigin-products.actions';
import { formatCurrency } from '@/components/sabbigin/lib/format';

export interface ProductDetail {
    _id: string;
    name: string;
    sku: string;
    price: number;
    currency: string;
    description: string;
}

const CURRENCY_OPTIONS = [
    { value: 'INR', label: 'INR — Indian Rupee' },
    { value: 'USD', label: 'USD — US Dollar' },
    { value: 'EUR', label: 'EUR — Euro' },
    { value: 'GBP', label: 'GBP — British Pound' },
    { value: 'AED', label: 'AED — UAE Dirham' },
];

export function ProductDetailClient({ initial }: { initial: ProductDetail }) {
    const router = useRouter();
    const [product, setProduct] = React.useState<ProductDetail>(initial);
    const [editing, setEditing] = React.useState(false);
    const [currency, setCurrency] = React.useState<string | null>(initial.currency || 'INR');
    const [pending, startTransition] = React.useTransition();

    function beginEdit() {
        setCurrency(product.currency || 'INR');
        setEditing(true);
    }

    function handleSubmit(formData: FormData) {
        formData.set('productId', product._id);
        formData.set('currency', currency ?? 'INR');
        startTransition(async () => {
            const r = await updateSabbiginProduct(null, formData);
            if (!r.ok) {
                toast.error({ title: 'Could not save', description: r.error });
                return;
            }
            if (r.product) setProduct({ ...r.product });
            setEditing(false);
            toast.success({ title: 'Product updated' });
            router.refresh();
        });
    }

    if (editing) {
        return (
            <form action={handleSubmit}>
                <Card>
                    <CardHeader>
                        <CardTitle>Edit product</CardTitle>
                    </CardHeader>
                    <CardBody className="flex flex-col gap-4">
                        <Field label="Product name" required>
                            <Input name="name" defaultValue={product.name} iconLeft={Package} required />
                        </Field>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Field label="SKU">
                                <Input name="sku" defaultValue={product.sku} iconLeft={Tag} />
                            </Field>
                            <Field label="Price">
                                <Input
                                    name="price"
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    defaultValue={product.price || ''}
                                />
                            </Field>
                        </div>
                        <Field label="Currency">
                            <SelectField
                                value={currency}
                                onChange={setCurrency}
                                options={CURRENCY_OPTIONS}
                                placeholder="Select currency"
                                aria-label="Currency"
                            />
                        </Field>
                        <Field label="Description">
                            <Textarea name="description" defaultValue={product.description} rows={3} />
                        </Field>
                    </CardBody>
                    <CardBody className="flex items-center justify-end gap-2 border-t border-[var(--st-border)]">
                        <Button
                            type="button"
                            variant="secondary"
                            size="md"
                            iconLeft={X}
                            onClick={() => setEditing(false)}
                            disabled={pending}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" variant="primary" size="md" iconLeft={Save} loading={pending}>
                            Save changes
                        </Button>
                    </CardBody>
                </Card>
            </form>
        );
    }

    return (
        <Card>
            <CardHeader className="flex items-center justify-between">
                <CardTitle>Details</CardTitle>
                <Button variant="secondary" size="sm" iconLeft={Pencil} onClick={beginEdit}>
                    Edit
                </Button>
            </CardHeader>
            <CardBody>
                <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                    <Row label="Name" value={product.name} />
                    <Row label="SKU" value={product.sku} mono />
                    <Row label="Price" value={formatCurrency(product.price, product.currency || 'INR')} />
                    <Row label="Currency" value={product.currency} />
                    <div className="sm:col-span-2">
                        <Row label="Description" value={product.description} />
                    </div>
                </dl>
            </CardBody>
        </Card>
    );
}

function Row({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
    return (
        <div className="flex flex-col gap-0.5">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
                {label}
            </dt>
            <dd className={`text-[14px] text-[var(--st-text)]${mono ? ' font-mono' : ''}`}>
                {value && value.trim() !== '' ? value : <span className="text-[var(--st-text-secondary)]">—</span>}
            </dd>
        </div>
    );
}
