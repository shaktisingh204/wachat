'use client';

import {
  Button,
  Card,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Textarea,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft,
  LoaderCircle,
  Save,
  ImageIcon,
  X } from 'lucide-react';

/**
 * Shared client form for create + edit Storefront.
 *
 * Uses `<SabFilePickerButton>` for the logo (SabFiles policy — no free-
 * text URLs). The homepage-blocks editor is a JSON textarea for now;
 * the rich `<HomepageBlocksEditor>` is a follow-up.
 */

import { SabFilePickerButton } from '@/components/sabfiles';
import { saveStorefront } from '@/app/actions/crm-store.actions';

const initialState: { message?: string; error?: string; id?: string } = {};

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'AUD'];
const STATUSES = [
    { value: 'draft', label: 'Draft' },
    { value: 'published', label: 'Published' },
    { value: 'archived', label: 'Archived' },
];

function SubmitButton({ label }: { label: string }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" size="sm" disabled={pending}>
            {pending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
                <Save className="h-4 w-4" />
            )}
            {pending ? 'Saving…' : label}
        </Button>
    );
}

export interface StorefrontFormProps {
    initial?: Record<string, unknown> | null;
    storefrontId?: string;
}

export function StorefrontForm({ initial, storefrontId }: StorefrontFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const [state, formAction] = useActionState(saveStorefront, initialState);

    const initialBlocks = (() => {
        const raw = (initial?.homepageBlocks as unknown) ?? [];
        try {
            return JSON.stringify(raw, null, 2);
        } catch {
            return '[]';
        }
    })();

    const [logoUrl, setLogoUrl] = useState<string>(
        (initial?.logoUrl as string) ?? '',
    );
    const [logoName, setLogoName] = useState<string>('');
    const [currency, setCurrency] = useState<string>(
        (initial?.currency as string) ?? 'INR',
    );
    const [status, setStatus] = useState<string>(
        (initial?.status as string) ?? 'draft',
    );
    const [homepageBlocks, setHomepageBlocks] = useState<string>(initialBlocks);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Storefront saved', description: state.message });
            const nextId = state.id ?? storefrontId;
            if (nextId) {
                router.push(`/dashboard/crm/store/storefronts/${nextId}`);
            } else {
                router.push('/dashboard/crm/store/storefronts');
            }
        }
        if (state.error) {
            toast({
                title: 'Error',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, router, storefrontId]);

    return (
        <Card className="p-6">
            <form action={formAction} className="flex flex-col gap-5">
                {storefrontId ? (
                    <input
                        type="hidden"
                        name="storefrontId"
                        value={storefrontId}
                    />
                ) : null}
                <input type="hidden" name="currency" value={currency} />
                <input type="hidden" name="status" value={status} />
                <input type="hidden" name="logoUrl" value={logoUrl} />
                <input
                    type="hidden"
                    name="homepageBlocks"
                    value={homepageBlocks}
                />

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="name">
                            Name <span className="text-zoru-ink">*</span>
                        </Label>
                        <Input
                            id="name"
                            name="name"
                            type="text"
                            required
                            defaultValue={(initial?.name as string) ?? ''}
                            placeholder="My online store"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="slug">
                            Slug <span className="text-zoru-ink">*</span>
                        </Label>
                        <Input
                            id="slug"
                            name="slug"
                            type="text"
                            required
                            defaultValue={(initial?.slug as string) ?? ''}
                            placeholder="my-store"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="domain">Custom domain</Label>
                        <Input
                            id="domain"
                            name="domain"
                            type="text"
                            defaultValue={(initial?.domain as string) ?? ''}
                            placeholder="shop.example.com (optional)"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="currency-select">Currency</Label>
                        <Select value={currency} onValueChange={setCurrency}>
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
                        </Select>
                    </div>
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label>Logo</Label>
                    <div className="flex flex-wrap items-center gap-2">
                        <SabFilePickerButton
                            accept="image"
                            variant="outline"
                            onPick={(pick) => {
                                setLogoUrl(pick.url);
                                setLogoName(pick.name);
                            }}
                        >
                            <ImageIcon className="h-4 w-4" />
                            {logoUrl ? 'Replace logo' : 'Pick from SabFiles'}
                        </SabFilePickerButton>
                        {logoUrl ? (
                            <div className="flex items-center gap-1.5 rounded-full border border-zoru-line bg-zoru-surface px-3 py-0.5 text-[12px] text-zoru-ink">
                                <span className="max-w-[24ch] truncate">
                                    {logoName || logoUrl.split('/').pop() || 'logo'}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setLogoUrl('');
                                        setLogoName('');
                                    }}
                                    aria-label="Remove logo"
                                    className="text-zoru-ink-muted hover:text-zoru-ink"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="status-select">Status</Label>
                    <Select value={status} onValueChange={setStatus}>
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
                    </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="homepageBlocks">
                        Homepage blocks
                    </Label>
                    <p className="text-[12px] text-zoru-ink-muted">
                        Rich block editor coming — paste JSON for now.
                    </p>
                    <Textarea
                        id="homepageBlocks"
                        rows={8}
                        value={homepageBlocks}
                        onChange={(e) => setHomepageBlocks(e.target.value)}
                        className="font-mono text-[12px]"
                        placeholder='[{"type":"hero","title":"…"}]'
                    />
                </div>

                {state.error ? (
                    <p className="text-[13px] text-zoru-ink">{state.error}</p>
                ) : null}

                <div className="flex items-center gap-3">
                    <SubmitButton
                        label={storefrontId ? 'Save changes' : 'Create storefront'}
                    />
                    <Button variant="ghost" size="sm" asChild>
                        <Link
                            href={
                                storefrontId
                                    ? `/dashboard/crm/store/storefronts/${storefrontId}`
                                    : '/dashboard/crm/store/storefronts'
                            }
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Cancel
                        </Link>
                    </Button>
                </div>
            </form>
        </Card>
    );
}
