'use client';

/**
 * SabBigin products — editable list + create/edit Modal (client island).
 *
 * The server page passes a serialised product list. This island renders the
 * table (row-click opens the edit Modal) and a "New product" button (opens
 * the create Modal). Both create and edit post through the lean SabBigin
 * product actions, which write only name/sku/price/currency/description to
 * `crm_products`. On success we refresh the route so the server re-reads.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Package, Plus, Tag } from 'lucide-react';

import {
    Button,
    Card,
    EmptyState,
    Field,
    Input,
    Modal,
    SelectField,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
    Textarea,
    toast,
} from '@/components/sabcrm/20ui';
import {
    createSabbiginProduct,
    updateSabbiginProduct,
} from '@/app/actions/sabbigin-products.actions';
import { formatCurrency } from '@/components/sabbigin/lib/format';

export interface ProductRow {
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

const EMPTY: ProductRow = { _id: '', name: '', sku: '', price: 0, currency: 'INR', description: '' };

export function ProductsClient({ products }: { products: ProductRow[] }) {
    const router = useRouter();
    const [open, setOpen] = React.useState(false);
    const [editTarget, setEditTarget] = React.useState<ProductRow>(EMPTY);
    const [currency, setCurrency] = React.useState<string | null>('INR');
    const [pending, startTransition] = React.useTransition();

    const isEditing = editTarget._id !== '';

    function openCreate() {
        setEditTarget(EMPTY);
        setCurrency('INR');
        setOpen(true);
    }

    function openEdit(p: ProductRow) {
        setEditTarget(p);
        setCurrency(p.currency || 'INR');
        setOpen(true);
    }

    function close() {
        if (!pending) setOpen(false);
    }

    function handleSubmit(formData: FormData) {
        formData.set('currency', currency ?? 'INR');
        if (isEditing) formData.set('productId', editTarget._id);
        startTransition(async () => {
            const r = isEditing
                ? await updateSabbiginProduct(null, formData)
                : await createSabbiginProduct(null, formData);
            if (!r.ok) {
                toast.error({
                    title: isEditing ? 'Could not update product' : 'Could not create product',
                    description: r.error,
                });
                return;
            }
            toast.success({ title: isEditing ? 'Product updated' : 'Product created' });
            setOpen(false);
            router.refresh();
        });
    }

    return (
        <>
            <div className="flex justify-end">
                <Button variant="primary" size="sm" iconLeft={Plus} onClick={openCreate}>
                    New product
                </Button>
            </div>

            {products.length === 0 ? (
                <Card padding="none" className="flex min-h-[280px] items-center justify-center">
                    <EmptyState
                        icon={Package}
                        title="No products yet"
                        description="Add your first product to start building your catalogue."
                        action={
                            <Button variant="primary" size="sm" iconLeft={Plus} onClick={openCreate}>
                                New product
                            </Button>
                        }
                    />
                </Card>
            ) : (
                <Card padding="none" className="overflow-hidden">
                    <Table density="comfortable" hover>
                        <THead>
                            <Tr>
                                <Th>Name</Th>
                                <Th>SKU</Th>
                                <Th align="right">Price</Th>
                                <Th align="right">Edit</Th>
                            </Tr>
                        </THead>
                        <TBody>
                            {products.map((p) => (
                                <Tr key={p._id}>
                                    <Td>
                                        <button
                                            type="button"
                                            onClick={() => openEdit(p)}
                                            className="-mx-1 flex items-center gap-2.5 rounded-[var(--st-radius-sm)] px-1 py-0.5 text-left font-medium text-[var(--st-text)] transition-colors hover:text-[var(--st-accent)]"
                                        >
                                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
                                                <Package className="h-3.5 w-3.5" aria-hidden="true" />
                                            </span>
                                            <span className="truncate">{p.name || 'Product'}</span>
                                        </button>
                                    </Td>
                                    <Td className="text-[var(--st-text-secondary)]">
                                        <span className="inline-flex items-center gap-1.5 font-mono text-[12px]">
                                            {p.sku ? (
                                                <>
                                                    <Tag className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                                    {p.sku}
                                                </>
                                            ) : (
                                                'No SKU'
                                            )}
                                        </span>
                                    </Td>
                                    <Td align="right">
                                        <span className="font-semibold tabular-nums text-[var(--st-text)]">
                                            {formatCurrency(p.price, p.currency || 'INR')}
                                        </span>
                                    </Td>
                                    <Td align="right">
                                        <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                                            Edit
                                        </Button>
                                    </Td>
                                </Tr>
                            ))}
                        </TBody>
                    </Table>
                </Card>
            )}

            <Modal
                open={open}
                onClose={close}
                title={isEditing ? 'Edit product' : 'New product'}
                description={
                    isEditing
                        ? 'Update this product in your catalogue.'
                        : 'Add a product to your catalogue.'
                }
            >
                <form id="sabbigin-product-form" action={handleSubmit} className="flex flex-col gap-4">
                    <Field label="Product name" required>
                        <Input
                            name="name"
                            defaultValue={editTarget.name}
                            placeholder="e.g. Annual subscription"
                            required
                            autoFocus
                        />
                    </Field>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="SKU">
                            <Input name="sku" defaultValue={editTarget.sku} placeholder="SKU-001" />
                        </Field>
                        <Field label="Price">
                            <Input
                                name="price"
                                type="number"
                                min={0}
                                step="0.01"
                                defaultValue={editTarget.price || ''}
                                placeholder="0"
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
                        <Textarea
                            name="description"
                            defaultValue={editTarget.description}
                            placeholder="What is this product?"
                            rows={3}
                        />
                    </Field>

                    <div className="flex items-center justify-end gap-2 pt-1">
                        <Button type="button" variant="secondary" size="md" onClick={close} disabled={pending}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="primary" size="md" loading={pending}>
                            {isEditing ? 'Save changes' : 'Create product'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </>
    );
}
