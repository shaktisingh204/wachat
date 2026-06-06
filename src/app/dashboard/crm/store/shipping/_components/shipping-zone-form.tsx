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
  Plus,
  Save,
  Trash2 } from 'lucide-react';

/**
 * Shared client form for create + edit shipping zone.
 *
 * Countries / states are free-text comma-separated ISO-2 codes — no
 * geo picker yet. Methods are a small inline list editor (name + kind
 * + rate + freeAbove).
 */

import { saveShippingZone } from '@/app/actions/crm-store.actions';

const initialState: { message?: string; error?: string; id?: string } = {};

const STATUSES = [
    { value: 'draft', label: 'Draft' },
    { value: 'active', label: 'Active' },
    { value: 'archived', label: 'Archived' },
];

const METHOD_KINDS = [
    { value: 'flat', label: 'Flat rate' },
    { value: 'weight', label: 'Per-weight' },
    { value: 'free', label: 'Free' },
    { value: 'custom', label: 'Custom' },
];

interface MethodRow {
    name: string;
    kind: string;
    rate: string;
    freeAboveSubtotal: string;
}

function emptyMethod(): MethodRow {
    return { name: '', kind: 'flat', rate: '', freeAboveSubtotal: '' };
}

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

export interface ShippingZoneFormProps {
    initial?: Record<string, unknown> | null;
    zoneId?: string;
    defaultStorefrontId?: string | null;
}

export function ShippingZoneForm({
    initial,
    zoneId,
    defaultStorefrontId,
}: ShippingZoneFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const [state, formAction] = useActionState(saveShippingZone, initialState);

    const [storefrontId, setStorefrontId] = useState<string>(
        ((initial?.storefrontId as { toString?: () => string }) ?
            String(initial?.storefrontId)
            : null) ??
            defaultStorefrontId ??
            '',
    );
    const [status, setStatus] = useState<string>(
        (initial?.status as string) ?? 'draft',
    );
    const [countriesText, setCountriesText] = useState<string>(
        Array.isArray(initial?.countries)
            ? (initial?.countries as unknown[]).map((c) => String(c)).join(', ')
            : '',
    );
    const [statesText, setStatesText] = useState<string>(
        Array.isArray(initial?.states)
            ? (initial?.states as unknown[]).map((s) => String(s)).join(', ')
            : '',
    );

    const initialMethods: MethodRow[] = (() => {
        const raw = initial?.methods;
        if (!Array.isArray(raw)) return [emptyMethod()];
        return (raw as Record<string, unknown>[]).map((m) => ({
            name: (m.name as string) ?? '',
            kind: (m.kind as string) ?? 'flat',
            rate: m.rate !== undefined && m.rate !== null ? String(m.rate) : '',
            freeAboveSubtotal:
                m.freeAboveSubtotal !== undefined &&
                m.freeAboveSubtotal !== null
                    ? String(m.freeAboveSubtotal)
                    : '',
        }));
    })();
    const [methods, setMethods] = useState<MethodRow[]>(initialMethods);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Shipping zone saved', description: state.message });
            const nextId = state.id ?? zoneId;
            if (nextId) {
                router.push(`/dashboard/crm/store/shipping/${nextId}`);
            } else {
                router.push('/dashboard/crm/store/shipping');
            }
        }
        if (state.error) {
            toast({
                title: 'Error',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, router, zoneId]);

    const methodsJson = JSON.stringify(
        methods
            .filter((m) => m.name.trim().length > 0)
            .map((m) => ({
                name: m.name.trim(),
                kind: m.kind,
                rate: parseFloat(m.rate) || 0,
                freeAboveSubtotal: m.freeAboveSubtotal
                    ? parseFloat(m.freeAboveSubtotal)
                    : null,
            })),
    );

    function updateMethod(index: number, patch: Partial<MethodRow>) {
        setMethods((prev) =>
            prev.map((m, i) => (i === index ? { ...m, ...patch } : m)),
        );
    }

    return (
        <Card className="p-6">
            <form action={formAction} className="flex flex-col gap-5">
                {zoneId ? (
                    <input type="hidden" name="zoneId" value={zoneId} />
                ) : null}
                <input
                    type="hidden"
                    name="storefrontId"
                    value={storefrontId}
                />
                <input type="hidden" name="status" value={status} />
                <input type="hidden" name="countries" value={countriesText} />
                <input type="hidden" name="states" value={statesText} />
                <input type="hidden" name="methods" value={methodsJson} />

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                        <Label>
                            Storefront <span className="text-zoru-ink">*</span>
                        </Label>
                        <Input
                            value={storefrontId}
                            onChange={(e) => setStorefrontId(e.target.value)}
                            placeholder="Storefront id"
                            required
                        />
                    </div>
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
                            placeholder="India - Standard"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="countriesField">Countries</Label>
                        <Input
                            id="countriesField"
                            value={countriesText}
                            onChange={(e) => setCountriesText(e.target.value)}
                            placeholder="IN, US, GB"
                        />
                        <p className="text-[11px] text-zoru-ink-muted">
                            Comma-separated ISO-2 codes.
                        </p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="statesField">States (optional)</Label>
                        <Input
                            id="statesField"
                            value={statesText}
                            onChange={(e) => setStatesText(e.target.value)}
                            placeholder="MH, KA, CA-ON"
                        />
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
                                    <ZoruSelectItem
                                        key={s.value}
                                        value={s.value}
                                    >
                                        {s.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </Select>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <Label>Methods</Label>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                setMethods((prev) => [...prev, emptyMethod()])
                            }
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Add method
                        </Button>
                    </div>
                    <div className="flex flex-col gap-3">
                        {methods.map((m, i) => (
                            <div
                                key={i}
                                className="grid grid-cols-1 gap-2 rounded-md border border-zoru-line p-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto]"
                            >
                                <Input
                                    placeholder="Method name"
                                    value={m.name}
                                    onChange={(e) =>
                                        updateMethod(i, { name: e.target.value })
                                    }
                                />
                                <Select
                                    value={m.kind}
                                    onValueChange={(v) =>
                                        updateMethod(i, { kind: v })
                                    }
                                >
                                    <ZoruSelectTrigger>
                                        <ZoruSelectValue placeholder="Kind" />
                                    </ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        {METHOD_KINDS.map((k) => (
                                            <ZoruSelectItem
                                                key={k.value}
                                                value={k.value}
                                            >
                                                {k.label}
                                            </ZoruSelectItem>
                                        ))}
                                    </ZoruSelectContent>
                                </Select>
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="Rate"
                                    value={m.rate}
                                    onChange={(e) =>
                                        updateMethod(i, { rate: e.target.value })
                                    }
                                />
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="Free above"
                                    value={m.freeAboveSubtotal}
                                    onChange={(e) =>
                                        updateMethod(i, {
                                            freeAboveSubtotal: e.target.value,
                                        })
                                    }
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                        setMethods((prev) =>
                                            prev.filter((_, j) => j !== i),
                                        )
                                    }
                                    aria-label="Remove method"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                        {methods.length === 0 ? (
                            <p className="text-[12.5px] text-zoru-ink-muted">
                                No shipping methods. Add at least one to start
                                offering this zone.
                            </p>
                        ) : null}
                    </div>
                </div>

                {state.error ? (
                    <p className="text-[13px] text-zoru-ink">{state.error}</p>
                ) : null}

                <div className="flex items-center gap-3">
                    <SubmitButton
                        label={zoneId ? 'Save changes' : 'Create zone'}
                    />
                    <Button variant="ghost" size="sm" asChild>
                        <Link
                            href={
                                zoneId
                                    ? `/dashboard/crm/store/shipping/${zoneId}`
                                    : '/dashboard/crm/store/shipping'
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
