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
  Save } from 'lucide-react';

/**
 * Shared client form for create + edit pricing rule.
 *
 * Conditions and applies-to are JSON textareas for this PR — a richer
 * editor will land alongside the storefront runtime.
 */

import { savePricingRule } from '@/app/actions/crm-store.actions';

const initialState: { message?: string; error?: string; id?: string } = {};

const KINDS = [
    { value: 'percent_off', label: 'Percent off' },
    { value: 'fixed_off', label: 'Fixed amount off' },
    { value: 'buy_x_get_y', label: 'Buy X get Y' },
    { value: 'bundle', label: 'Bundle' },
];

const STATUSES = [
    { value: 'draft', label: 'Draft' },
    { value: 'active', label: 'Active' },
    { value: 'archived', label: 'Archived' },
];

const APPLIES_TO_TARGETS = [
    { value: 'all', label: 'All products' },
    { value: 'products', label: 'Specific products' },
    { value: 'categories', label: 'Specific categories' },
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

function toDateInputValue(v: unknown): string {
    if (!v) return '';
    const d = new Date(v as string | number | Date);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

export interface PricingRuleFormProps {
    initial?: Record<string, unknown> | null;
    pricingRuleId?: string;
    defaultStorefrontId?: string | null;
}

export function PricingRuleForm({
    initial,
    pricingRuleId,
    defaultStorefrontId,
}: PricingRuleFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const [state, formAction] = useActionState(savePricingRule, initialState);

    const [storefrontId, setStorefrontId] = useState<string>(
        ((initial?.storefrontId as { toString?: () => string }) ?
            String(initial?.storefrontId)
            : null) ??
            defaultStorefrontId ??
            '',
    );
    const [kind, setKind] = useState<string>(
        (initial?.kind as string) ?? 'percent_off',
    );
    const [status, setStatus] = useState<string>(
        (initial?.status as string) ?? 'draft',
    );
    const initialAppliesTo = (initial?.appliesTo as Record<string, unknown>) ?? {
        target: 'all',
    };
    const [appliesToTarget, setAppliesToTarget] = useState<string>(
        (initialAppliesTo.target as string) ?? 'all',
    );
    const initialAppliesToIds = Array.isArray(initialAppliesTo.ids)
        ? (initialAppliesTo.ids as unknown[]).map((x) => String(x)).join(', ')
        : '';
    const [appliesToIdsText, setAppliesToIdsText] = useState<string>(
        initialAppliesToIds,
    );

    const initialConditions = (() => {
        try {
            return JSON.stringify(initial?.conditions ?? [], null, 2);
        } catch {
            return '[]';
        }
    })();
    const [conditions, setConditions] = useState<string>(initialConditions);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Pricing rule saved', description: state.message });
            const nextId = state.id ?? pricingRuleId;
            if (nextId) {
                router.push(`/dashboard/crm/store/pricing/${nextId}`);
            } else {
                router.push('/dashboard/crm/store/pricing');
            }
        }
        if (state.error) {
            toast({
                title: 'Error',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, router, pricingRuleId]);

    const appliesToJson = JSON.stringify({
        target: appliesToTarget,
        ids:
            appliesToTarget === 'all'
                ? []
                : appliesToIdsText
                      .split(',')
                      .map((s) => s.trim())
                      .filter((s) => s.length > 0),
    });

    return (
        <Card className="p-6">
            <form action={formAction} className="flex flex-col gap-5">
                {pricingRuleId ? (
                    <input
                        type="hidden"
                        name="pricingRuleId"
                        value={pricingRuleId}
                    />
                ) : null}
                <input
                    type="hidden"
                    name="storefrontId"
                    value={storefrontId}
                />
                <input type="hidden" name="kind" value={kind} />
                <input type="hidden" name="status" value={status} />
                <input type="hidden" name="appliesTo" value={appliesToJson} />
                <input type="hidden" name="conditions" value={conditions} />

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
                            placeholder="Summer sale 20% off"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="kind-select">Kind</Label>
                        <Select value={kind} onValueChange={setKind}>
                            <ZoruSelectTrigger id="kind-select">
                                <ZoruSelectValue placeholder="Kind" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {KINDS.map((k) => (
                                    <ZoruSelectItem key={k.value} value={k.value}>
                                        {k.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="value">Value</Label>
                        <Input
                            id="value"
                            name="value"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={
                                (initial?.value as number | undefined) ?? ''
                            }
                            placeholder={
                                kind === 'percent_off' ? 'e.g. 20' : 'e.g. 100'
                            }
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="priority">Priority</Label>
                        <Input
                            id="priority"
                            name="priority"
                            type="number"
                            min="0"
                            step="1"
                            defaultValue={
                                (initial?.priority as number | undefined) ?? 0
                            }
                        />
                        <p className="text-[11px] text-zoru-ink-muted">
                            Higher priority runs first.
                        </p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="status-select">Status</Label>
                        <Select value={status} onValueChange={setStatus}>
                            <ZoruSelectTrigger id="status-select">
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
                </div>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="startsAt">Starts at</Label>
                        <Input
                            id="startsAt"
                            name="startsAt"
                            type="date"
                            defaultValue={toDateInputValue(initial?.startsAt)}
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="endsAt">Ends at</Label>
                        <Input
                            id="endsAt"
                            name="endsAt"
                            type="date"
                            defaultValue={toDateInputValue(initial?.endsAt)}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="appliesToTarget">Applies to</Label>
                        <Select
                            value={appliesToTarget}
                            onValueChange={setAppliesToTarget}
                        >
                            <ZoruSelectTrigger id="appliesToTarget">
                                <ZoruSelectValue placeholder="Scope" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {APPLIES_TO_TARGETS.map((t) => (
                                    <ZoruSelectItem key={t.value} value={t.value}>
                                        {t.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </Select>
                    </div>
                    {appliesToTarget !== 'all' ? (
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="appliesToIds">
                                {appliesToTarget === 'products'
                                    ? 'Product ids'
                                    : 'Category ids'}
                            </Label>
                            <Input
                                id="appliesToIds"
                                value={appliesToIdsText}
                                onChange={(e) =>
                                    setAppliesToIdsText(e.target.value)
                                }
                                placeholder="id1, id2, id3"
                            />
                            <p className="text-[11px] text-zoru-ink-muted">
                                Comma-separated.
                            </p>
                        </div>
                    ) : null}
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="conditions">Conditions (JSON)</Label>
                    <p className="text-[11px] text-zoru-ink-muted">
                        Each: <code>{`{ "field":"subtotal","op":"gte","value":500 }`}</code>
                        . Rich editor coming.
                    </p>
                    <Textarea
                        id="conditions"
                        rows={6}
                        value={conditions}
                        onChange={(e) => setConditions(e.target.value)}
                        className="font-mono text-[12px]"
                    />
                </div>

                {state.error ? (
                    <p className="text-[13px] text-zoru-ink">{state.error}</p>
                ) : null}

                <div className="flex items-center gap-3">
                    <SubmitButton
                        label={pricingRuleId ? 'Save changes' : 'Create rule'}
                    />
                    <Button variant="ghost" size="sm" asChild>
                        <Link
                            href={
                                pricingRuleId
                                    ? `/dashboard/crm/store/pricing/${pricingRuleId}`
                                    : '/dashboard/crm/store/pricing'
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
