'use client';

import {
  ZoruButton,
  ZoruCard,
  ZoruCheckbox,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
  ImageIcon,
  LoaderCircle,
  Save,
  X,
  } from 'lucide-react';

/**
 * Shared client form for create + edit store Product.
 *
 * - Storefront picker via `<EntityFormField entity="storefront">` —
 *   the lookup-registry may not yet know the `storefront` key, so we
 *   fall back to a plain id text input wired through the same hidden
 *   field name. (Storefronts can also be passed via `?storefrontId=…`
 *   when arriving from the products list.)
 * - Linked CRM item via `<EntityFormField entity="item">`.
 * - Images: multi `<SabFilePickerButton>` round-trips.
 * - Tags: comma-separated free text (no chip picker yet).
 */

import { EntityFormField } from '@/components/crm/entity-form-field';
import { SabFilePickerButton } from '@/components/sabfiles';
import { saveProduct } from '@/app/actions/crm-store.actions';

const initialState: { message?: string; error?: string; id?: string } = {};

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'AUD'];
const STATUSES = [
    { value: 'draft', label: 'Draft' },
    { value: 'active', label: 'Active' },
    { value: 'archived', label: 'Archived' },
];

function SubmitButton({ label }: { label: string }) {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" size="sm" disabled={pending}>
            {pending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
                <Save className="h-4 w-4" />
            )}
            {pending ? 'Saving…' : label}
        </ZoruButton>
    );
}

export interface ProductFormProps {
    initial?: Record<string, unknown> | null;
    productId?: string;
    /** When set (typically from `?storefrontId=`), the storefront field starts pre-filled. */
    defaultStorefrontId?: string | null;
}

export function ProductForm({
    initial,
    productId,
    defaultStorefrontId,
}: ProductFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const [state, formAction] = useActionState(saveProduct, initialState);

    const [storefrontId, setStorefrontId] = useState<string>(
        ((initial?.storefrontId as { toString?: () => string }) ?
            String(initial?.storefrontId)
            : null) ??
            defaultStorefrontId ??
            '',
    );
    const [itemId, setItemId] = useState<string>(
        ((initial?.itemId as { toString?: () => string }) ?
            String(initial?.itemId)
            : null) ?? '',
    );
    const [currency, setCurrency] = useState<string>(
        (initial?.currency as string) ?? 'INR',
    );
    const [status, setStatus] = useState<string>(
        (initial?.status as string) ?? 'draft',
    );
    const initialImages = Array.isArray(initial?.images)
        ? (initial?.images as Array<string | { url?: string }>).map((i) =>
              typeof i === 'string' ? i : i.url ?? '',
          ).filter(Boolean)
        : [];
    const [images, setImages] = useState<string[]>(initialImages);

    const initialCategories = Array.isArray(initial?.categories)
        ? (initial?.categories as unknown[]).map((c) => String(c))
        : [];
    const [categoriesText, setCategoriesText] = useState<string>(
        initialCategories.join(', '),
    );

    const initialTags = Array.isArray(initial?.tags)
        ? (initial?.tags as unknown[]).map((t) => String(t)).join(', ')
        : '';

    const [inventoryTracked, setInventoryTracked] = useState<boolean>(
        Boolean(initial?.inventoryTracked),
    );

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Product saved', description: state.message });
            const nextId = state.id ?? productId;
            if (nextId) {
                router.push(`/dashboard/crm/store/products/${nextId}`);
            } else {
                router.push('/dashboard/crm/store/products');
            }
        }
        if (state.error) {
            toast({
                title: 'Error',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, router, productId]);

    const imagesJson = JSON.stringify(images);
    const categoriesJson = JSON.stringify(
        categoriesText
            .split(',')
            .map((c) => c.trim())
            .filter((c) => c.length > 0),
    );

    return (
        <ZoruCard className="p-6">
            <form action={formAction} className="flex flex-col gap-5">
                {productId ? (
                    <input
                        type="hidden"
                        name="productId"
                        value={productId}
                    />
                ) : null}
                <input
                    type="hidden"
                    name="storefrontId"
                    value={storefrontId}
                />
                <input type="hidden" name="itemId" value={itemId} />
                <input type="hidden" name="currency" value={currency} />
                <input type="hidden" name="status" value={status} />
                <input type="hidden" name="images" value={imagesJson} />
                <input
                    type="hidden"
                    name="categories"
                    value={categoriesJson}
                />
                <input
                    type="hidden"
                    name="inventoryTracked"
                    value={inventoryTracked ? 'true' : 'false'}
                />

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                        <ZoruLabel>
                            Storefront <span className="text-red-500">*</span>
                        </ZoruLabel>
                        <ZoruInput
                            value={storefrontId}
                            onChange={(e) => setStorefrontId(e.target.value)}
                            placeholder="Storefront id"
                            required
                        />
                        <p className="text-[11px] text-zoru-ink-muted">
                            Paste the storefront id (visible in the URL of the
                            storefront detail page).
                        </p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <ZoruLabel>Linked CRM item</ZoruLabel>
                        <EntityFormField
                            entity="item"
                            name="itemId_picker"
                            initialId={itemId || null}
                            onChange={(id) => setItemId(id ?? '')}
                            placeholder="Pick a CRM item…"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <ZoruLabel htmlFor="sku">SKU</ZoruLabel>
                        <ZoruInput
                            id="sku"
                            name="sku"
                            type="text"
                            defaultValue={(initial?.sku as string) ?? ''}
                            placeholder="SKU-001"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <ZoruLabel htmlFor="title">
                            Title <span className="text-red-500">*</span>
                        </ZoruLabel>
                        <ZoruInput
                            id="title"
                            name="title"
                            type="text"
                            required
                            defaultValue={(initial?.title as string) ?? ''}
                            placeholder="Product title"
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-1.5">
                    <ZoruLabel htmlFor="description">Description</ZoruLabel>
                    <ZoruTextarea
                        id="description"
                        name="description"
                        rows={4}
                        defaultValue={(initial?.description as string) ?? ''}
                        placeholder="Short product description…"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <ZoruLabel>Images</ZoruLabel>
                    <div className="flex flex-wrap items-center gap-2">
                        <SabFilePickerButton
                            accept="image"
                            variant="outline"
                            onPick={(pick) => {
                                setImages((prev) =>
                                    prev.includes(pick.url)
                                        ? prev
                                        : [...prev, pick.url],
                                );
                            }}
                        >
                            <ImageIcon className="h-4 w-4" />
                            Add image
                        </SabFilePickerButton>
                        {images.map((url) => (
                            <div
                                key={url}
                                className="flex items-center gap-1.5 rounded-full border border-zoru-line bg-zoru-surface px-3 py-0.5 text-[12px] text-zoru-ink"
                            >
                                <span className="max-w-[22ch] truncate">
                                    {url.split('/').pop()}
                                </span>
                                <button
                                    type="button"
                                    aria-label="Remove image"
                                    onClick={() =>
                                        setImages((prev) =>
                                            prev.filter((u) => u !== url),
                                        )
                                    }
                                    className="text-zoru-ink-muted hover:text-zoru-ink"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                    <div className="flex flex-col gap-1.5">
                        <ZoruLabel htmlFor="price">Price</ZoruLabel>
                        <ZoruInput
                            id="price"
                            name="price"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={
                                (initial?.price as number | undefined) ?? ''
                            }
                            placeholder="0.00"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <ZoruLabel htmlFor="compareAtPrice">
                            Compare-at price
                        </ZoruLabel>
                        <ZoruInput
                            id="compareAtPrice"
                            name="compareAtPrice"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={
                                (initial?.compareAtPrice as number | undefined) ??
                                ''
                            }
                            placeholder="0.00 (optional)"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <ZoruLabel htmlFor="currency-select">Currency</ZoruLabel>
                        <ZoruSelect
                            value={currency}
                            onValueChange={setCurrency}
                        >
                            <ZoruSelectTrigger id="currency-select">
                                <ZoruSelectValue placeholder="Currency" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {CURRENCIES.map((c) => (
                                    <ZoruSelectItem key={c} value={c}>
                                        {c}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <ZoruCheckbox
                        id="inventoryTracked"
                        checked={inventoryTracked}
                        onCheckedChange={(checked) =>
                            setInventoryTracked(Boolean(checked))
                        }
                    />
                    <ZoruLabel
                        htmlFor="inventoryTracked"
                        className="cursor-pointer"
                    >
                        Track inventory for this product
                    </ZoruLabel>
                </div>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                        <ZoruLabel htmlFor="categoriesField">Categories</ZoruLabel>
                        <ZoruInput
                            id="categoriesField"
                            value={categoriesText}
                            onChange={(e) =>
                                setCategoriesText(e.target.value)
                            }
                            placeholder="apparel, men, summer"
                        />
                        <p className="text-[11px] text-zoru-ink-muted">
                            Comma-separated. Multi-picker coming soon.
                        </p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <ZoruLabel htmlFor="tags">Tags</ZoruLabel>
                        <ZoruInput
                            id="tags"
                            name="tags"
                            type="text"
                            defaultValue={initialTags}
                            placeholder="featured, new, sale"
                        />
                        <p className="text-[11px] text-zoru-ink-muted">
                            Comma-separated.
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-1.5">
                    <ZoruLabel htmlFor="status-select">Status</ZoruLabel>
                    <ZoruSelect value={status} onValueChange={setStatus}>
                        <ZoruSelectTrigger
                            id="status-select"
                            className="max-w-xs"
                        >
                            <ZoruSelectValue placeholder="Status" />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            {STATUSES.map((s) => (
                                <ZoruSelectItem key={s.value} value={s.value}>
                                    {s.label}
                                </ZoruSelectItem>
                            ))}
                        </ZoruSelectContent>
                    </ZoruSelect>
                </div>

                {state.error ? (
                    <p className="text-[13px] text-red-500">{state.error}</p>
                ) : null}

                <div className="flex items-center gap-3">
                    <SubmitButton
                        label={productId ? 'Save changes' : 'Create product'}
                    />
                    <ZoruButton variant="ghost" size="sm" asChild>
                        <Link
                            href={
                                productId
                                    ? `/dashboard/crm/store/products/${productId}`
                                    : '/dashboard/crm/store/products'
                            }
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Cancel
                        </Link>
                    </ZoruButton>
                </div>
            </form>
        </ZoruCard>
    );
}
