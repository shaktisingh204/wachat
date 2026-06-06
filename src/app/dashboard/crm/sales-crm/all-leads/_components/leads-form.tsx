'use client';

import {
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  DatePicker,
  Input,
  Label,
  Textarea,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useRouter } from 'next/navigation';

/**
 * <LeadForm> — shared client form for `/new` and `/[id]/edit`.
 *
 * Drives both the `addCrmLead` (create) and `updateCrmLead` (edit)
 * server actions. The same component handles "Save", "Save & New",
 * and "Save & Convert to Deal" via a small `intent` hidden input the
 * action ignores; the routing decision happens in this component on
 * the action's response.
 *
 * **Field name contract:** every named input matches what the actions
 * read via `formData.get(...)` — do not rename without touching
 * `src/app/actions/crm-leads.actions.ts`.
 */

import * as React from 'react';

import { EnumFormField } from '@/components/crm/enum-form-field';
import { LoaderCircle, Save } from 'lucide-react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { DirtyFormPrompt } from '@/components/crm/dirty-form-prompt';
import {
    addCrmLead,
    updateCrmLead,
} from '@/app/actions/crm-leads.actions';
import { convertLeadToAccount } from '@/app/actions/worksuite/conversions.actions';
import type { CrmLead, WithId } from '@/lib/definitions';

const LEAD_STATUSES = ['New', 'Contacted', 'Qualified', 'Unqualified', 'Converted'] as const;

interface LeadFormProps {
    mode: 'create' | 'edit';
    /** Existing lead, when mode === 'edit'. */
    initial?: WithId<CrmLead> | null;
    /** Pre-fill from a parent doc (form submission, contact, etc.). */
    prefill?: Partial<CrmLead> | null;
    /** Optional convert target — exposes a "Save & Convert" CTA. */
    showConvert?: boolean;
}

type ActionState = { message?: string; error?: string; leadId?: string };

export function LeadForm({ mode, initial, prefill, showConvert = true }: LeadFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const formRef = React.useRef<HTMLFormElement>(null);

    const [pending, startTransition] = React.useTransition();
    const [dirty, setDirty] = React.useState(false);

    // Controlled state for cascaded / non-native inputs.
    const [pipelineId, setPipelineId] = React.useState<string>(
        initial?.pipelineId ?? prefill?.pipelineId ?? '',
    );
    const [stageId, setStageId] = React.useState<string>(
        initial?.stage ?? prefill?.stage ?? '',
    );
    const [assignedTo, setAssignedTo] = React.useState<string>(
        initial?.assignedTo ? String(initial.assignedTo) : '',
    );
    const [country, setCountry] = React.useState<string>(
        initial?.country ?? prefill?.country ?? '',
    );
    const [state, setState] = React.useState<string>(
        (initial as any)?.state ?? '',
    );
    const [followUp, setFollowUp] = React.useState<Date | undefined>(
        initial?.nextFollowUp ? new Date(initial.nextFollowUp) : undefined,
    );

    const submit = React.useCallback(
        async (intent: 'save' | 'save_new' | 'save_convert') => {
            if (!formRef.current) return;
            const fd = new FormData(formRef.current);
            startTransition(async () => {
                const state: ActionState =
                    mode === 'edit'
                        ? await updateCrmLead({}, fd)
                        : await addCrmLead({}, fd);

                if (state.error) {
                    toast({
                        title: 'Could not save',
                        description: state.error,
                        variant: 'destructive',
                    });
                    return;
                }

                setDirty(false);
                toast({ title: state.message ?? 'Saved', variant: 'default' });

                const newId = state.leadId ?? (initial?._id?.toString() ?? '');

                if (intent === 'save_new') {
                    router.push('/dashboard/crm/sales-crm/all-leads/new');
                    return;
                }
                if (intent === 'save_convert' && newId) {
                    const conv = await convertLeadToAccount(newId);
                    if (conv.success && conv.accountId) {
                        router.push(`/dashboard/crm/accounts/${conv.accountId}`);
                        return;
                    }
                    toast({
                        title: 'Conversion failed',
                        description: conv.error ?? 'Could not convert lead.',
                        variant: 'destructive',
                    });
                }
                if (newId) {
                    router.push(`/dashboard/crm/sales-crm/all-leads/${newId}`);
                } else {
                    router.push('/dashboard/crm/sales-crm/all-leads');
                }
            });
        },
        [mode, initial?._id, router, toast],
    );

    // Cmd/Ctrl+S → save.
    React.useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                void submit('save');
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [submit]);

    return (
        <form
            ref={formRef}
            onChange={() => setDirty(true)}
            onSubmit={(e) => {
                e.preventDefault();
                void submit('save');
            }}
            className="flex w-full flex-col gap-6 pb-24"
        >
            <DirtyFormPrompt dirty={dirty && !pending} />

            {/* Hidden helpers — kept inside the form so they ship in FormData. */}
            {mode === 'edit' && initial?._id ? (
                <input type="hidden" name="leadId" value={String(initial._id)} />
            ) : null}
            <input type="hidden" name="nextFollowUp" value={followUp?.toISOString() ?? ''} />

            {/* ─── Contact ────────────────────────────────────────────── */}
            <Card className="p-0">
                <ZoruCardHeader>
                    <ZoruCardTitle>Contact</ZoruCardTitle>
                    <ZoruCardDescription>
                        Who is the lead? Mark required (*) fields to save.
                    </ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="title">Lead Title *</Label>
                        <Input
                            id="title"
                            name="title"
                            required
                            defaultValue={initial?.title ?? prefill?.title ?? ''}
                            placeholder="e.g. Mobile App Development for Retail Client"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="contactName">Contact Name *</Label>
                        <Input
                            id="contactName"
                            name="contactName"
                            required
                            defaultValue={initial?.contactName ?? prefill?.contactName ?? ''}
                            placeholder="Full name"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            name="email"
                            defaultValue={initial?.email ?? prefill?.email ?? ''}
                            placeholder="contact@example.com"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="phone">Phone</Label>
                        <Input
                            id="phone"
                            name="phone"
                            defaultValue={initial?.phone ?? prefill?.phone ?? ''}
                            placeholder="+91 90000 00000"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="company">Company</Label>
                        <Input
                            id="company"
                            name="company"
                            defaultValue={initial?.company ?? prefill?.company ?? ''}
                            placeholder="Company name"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="website">Website</Label>
                        <Input
                            id="website"
                            name="website"
                            type="url"
                            defaultValue={initial?.website ?? prefill?.website ?? ''}
                            placeholder="https://example.com"
                        />
                    </div>
                </ZoruCardContent>
            </Card>

            {/* ─── Workflow ───────────────────────────────────────────── */}
            <Card className="p-0">
                <ZoruCardHeader>
                    <ZoruCardTitle>Workflow</ZoruCardTitle>
                    <ZoruCardDescription>
                        Status, source, and pipeline placement.
                    </ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label>Status</Label>
                        <EnumFormField
                            enumName="leadStatusLegacy"
                            name="status"
                            initialId={(initial?.status as string) ?? 'New'}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="source">Lead Source</Label>
                        <EntityFormField
                            entity="leadSource"
                            name="source"
                            initialId={initial?.source ?? prefill?.source ?? null}
                            placeholder="Select source…"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="pipelineId">Sales Pipeline</Label>
                        <EntityFormField
                            entity="pipeline"
                            name="pipelineId"
                            initialId={pipelineId || null}
                            placeholder="Select pipeline…"
                            onChange={(next) => {
                                setPipelineId(next ?? '');
                                setStageId(''); // reset stage when pipeline changes
                                setDirty(true);
                            }}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="stage">Pipeline Stage</Label>
                        <EntityFormField
                            entity="stage"
                            name="stage"
                            initialId={stageId || null}
                            placeholder={pipelineId ? 'Select stage…' : 'Pick a pipeline first'}
                            disabled={!pipelineId}
                            filter={pipelineId ? { pipelineId } : undefined}
                            onChange={(next) => {
                                setStageId(next ?? '');
                                setDirty(true);
                            }}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="assignedTo">Owner</Label>
                        <EntityFormField
                            entity="user"
                            name="assignedTo"
                            initialId={assignedTo || null}
                            placeholder="Unassigned"
                            onChange={(next) => {
                                setAssignedTo(next ?? '');
                                setDirty(true);
                            }}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="leadScore">Lead Score</Label>
                        <Input
                            id="leadScore"
                            name="leadScore"
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            defaultValue={
                                (initial as any)?.leadScore ?? (prefill as any)?.leadScore ?? ''
                            }
                            placeholder="0–100"
                        />
                    </div>
                </ZoruCardContent>
            </Card>

            {/* ─── Money ─────────────────────────────────────────────── */}
            <Card className="p-0">
                <ZoruCardHeader>
                    <ZoruCardTitle>Money</ZoruCardTitle>
                    <ZoruCardDescription>
                        Estimated deal value and close-date forecast.
                    </ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="value">Estimated Value</Label>
                        <Input
                            id="value"
                            name="value"
                            type="number"
                            min={0}
                            max={9999999999}
                            step="0.01"
                            defaultValue={initial?.value ?? prefill?.value ?? ''}
                            placeholder="0.00"
                            onInput={(e) => {
                                const el = e.currentTarget;
                                if (el.value && Number(el.value) > 9999999999) {
                                    el.value = '9999999999';
                                }
                            }}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="currency">Currency</Label>
                        <EntityFormField
                            entity="currency"
                            name="currency"
                            initialId={initial?.currency ?? prefill?.currency ?? 'INR'}
                            placeholder="Select currency…"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="probabilityPct">Probability %</Label>
                        <Input
                            id="probabilityPct"
                            name="probabilityPct"
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            defaultValue={
                                (initial as any)?.probabilityPct ?? ''
                            }
                            placeholder="0–100"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Next Follow-up</Label>
                        <DatePicker
                            value={followUp}
                            onChange={(d) => {
                                setFollowUp(d);
                                setDirty(true);
                            }}
                            placeholder="Pick follow-up date…"
                        />
                    </div>
                </ZoruCardContent>
            </Card>

            {/* ─── Address ───────────────────────────────────────────── */}
            <Card className="p-0">
                <ZoruCardHeader>
                    <ZoruCardTitle>Address</ZoruCardTitle>
                    <ZoruCardDescription>
                        Geography cascade: country → state → city.
                    </ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                        <Label htmlFor="country">Country</Label>
                        <EntityFormField
                            entity="country"
                            name="country"
                            initialId={country || 'India'}
                            onChange={(next) => {
                                setCountry(next ?? '');
                                setState('');
                                setDirty(true);
                            }}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="state">State</Label>
                        <EntityFormField
                            entity="state"
                            name="state"
                            initialId={state || null}
                            filter={country ? { countryCode: country } : undefined}
                            disabled={!country}
                            onChange={(next) => {
                                setState(next ?? '');
                                setDirty(true);
                            }}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="city">City</Label>
                        <EntityFormField
                            entity="city"
                            name="city"
                            initialId={(initial as any)?.city ?? null}
                            filter={
                                country
                                    ? {
                                          countryCode: country,
                                          ...(state
                                              ? { stateCode: state.includes(':') ? state.split(':')[1] : state }
                                              : {}),
                                      }
                                    : undefined
                            }
                            disabled={!country}
                        />
                    </div>
                </ZoruCardContent>
            </Card>

            {/* ─── Profile ───────────────────────────────────────────── */}
            <Card className="p-0">
                <ZoruCardHeader>
                    <ZoruCardTitle>Profile</ZoruCardTitle>
                    <ZoruCardDescription>
                        Industry classification and free-form notes.
                    </ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="industry">Industry</Label>
                        <EntityFormField
                            entity="industry"
                            name="industry"
                            initialId={(initial as any)?.industry ?? null}
                            placeholder="Select industry…"
                        />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="description">Notes</Label>
                        <Textarea
                            id="description"
                            name="description"
                            rows={4}
                            defaultValue={initial?.description ?? ''}
                            placeholder="Anything noteworthy about this lead…"
                        />
                    </div>
                </ZoruCardContent>
            </Card>

            {/* ─── Sticky action bar ─────────────────────────────────── */}
            <div className="sticky bottom-0 z-10 -mx-4 mt-2 border-t border-[var(--st-border)] bg-[var(--st-bg)]/95 px-4 py-3 backdrop-blur">
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => router.push('/dashboard/crm/sales-crm/all-leads')}
                        disabled={pending}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => void submit('save_new')}
                        disabled={pending}
                    >
                        Save &amp; New
                    </Button>
                    {showConvert ? (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => void submit('save_convert')}
                            disabled={pending}
                            title="Save and convert this lead into an account"
                        >
                            Save &amp; Convert
                        </Button>
                    ) : null}
                    <Button type="submit" disabled={pending}>
                        {pending ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                            <Save className="h-4 w-4" aria-hidden="true" />
                        )}
                        {mode === 'edit' ? 'Save changes' : 'Save lead'}
                    </Button>
                </div>
            </div>
        </form>
    );
}

export default LeadForm;
