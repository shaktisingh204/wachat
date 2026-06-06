'use client';

import { Badge, Button, Card, Input, Label, Select, Switch, Textarea, SelectContent, SelectItem, SelectTrigger, SelectValue, useToast } from '@/components/sabcrm/20ui';
import {
    ArrowLeft,
    LoaderCircle,
    Save,
    ShieldAlert,
    ChevronRight,
    CheckCircle2
} from 'lucide-react';

import * as React from 'react';
import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
    saveIntegration,
    type CrmIntegrationDoc,
} from '@/app/actions/crm-integrations.actions';

const BASE = '/dashboard/crm/integrations';

const PROVIDER_OPTIONS = [
    { value: 'slack', label: 'Slack' },
    { value: 'zapier', label: 'Zapier' },
    { value: 'webhook', label: 'Generic webhook' },
    { value: 'gmail', label: 'Gmail' },
    { value: 'outlook', label: 'Outlook' },
    { value: 'zoom', label: 'Zoom' },
    { value: 'teams', label: 'Microsoft Teams' },
    { value: 'stripe', label: 'Stripe' },
    { value: 'shopify', label: 'Shopify' },
    { value: 'mailchimp', label: 'Mailchimp' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'twilio', label: 'Twilio' },
    { value: 'hubspot', label: 'HubSpot' },
    { value: 'salesforce', label: 'Salesforce' },
    { value: 'other', label: 'Other' },
];

type SaveState = { message?: string; error?: string; id?: string };
const initialState: SaveState = {};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create integration'}
        </Button>
    );
}

export function IntegrationForm({
    initialData,
}: {
    initialData?: CrmIntegrationDoc | null;
}) {
    const router = useRouter();
    const { toast } = useToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveIntegration, initialState);
    
    // Wizard state
    const [step, setStep] = useState(1);
    
    // Form fields
    const [name, setName] = useState(initialData?.name ?? '');
    const [provider, setProvider] = useState<string>(
        initialData?.provider ?? 'webhook',
    );
    const [webhookUrl, setWebhookUrl] = useState(initialData?.webhookUrl ?? '');
    const [configData, setConfigData] = useState(initialData?.config ? JSON.stringify(initialData.config, null, 2) : '{}');
    const [credentialsData, setCredentialsData] = useState('');
    const [isActive, setIsActive] = useState<boolean>(
        initialData?.isActive ?? true,
    );

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            router.push(BASE);
        }
        if (state?.error) {
            toast({
                title: 'Error',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, router]);

    const handleNext = () => setStep(s => s + 1);
    const handleBack = () => setStep(s => s - 1);

    const renderWizardStep1 = () => (
        <div className="space-y-6">
            <h3 className="text-lg font-medium text-[var(--st-text)]">Step 1: Choose Provider</h3>
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                    <Label htmlFor="provider-trigger">Provider *</Label>
                    <Select value={provider} onValueChange={setProvider}>
                        <SelectTrigger id="provider-trigger">
                            <SelectValue placeholder="Pick a provider…" />
                        </SelectTrigger>
                        <SelectContent>
                            {PROVIDER_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                        id="name"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g. Ops Slack alerts"
                    />
                </div>
            </div>
            <div className="flex justify-end pt-4">
                <Button type="button" onClick={handleNext} disabled={!name || !provider}>
                    Next <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
            </div>
        </div>
    );

    const renderWizardStep2 = () => (
        <div className="space-y-6">
            <h3 className="text-lg font-medium text-[var(--st-text)]">Step 2: API & Webhook Configuration</h3>
            <div className="space-y-4">
                <div className="space-y-1.5">
                    <Label htmlFor="webhookUrl">Webhook URL</Label>
                    <Input
                        id="webhookUrl"
                        type="url"
                        value={webhookUrl}
                        onChange={e => setWebhookUrl(e.target.value)}
                        placeholder="https://hooks.example.com/services/…"
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="config">Config (JSON)</Label>
                    <Textarea
                        id="config"
                        rows={6}
                        value={configData}
                        onChange={e => setConfigData(e.target.value)}
                        spellCheck={false}
                        className="font-mono text-[12.5px]"
                        placeholder='{"channelId":"C123","region":"eu-west-1"}'
                    />
                    <p className="text-[12px] text-[var(--st-text-secondary)]">
                        Non-secret configuration. JSON object. Channel ids, region, feature flags, etc.
                    </p>
                </div>
            </div>
            <div className="flex justify-between pt-4">
                <Button type="button" variant="outline" onClick={handleBack}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button type="button" onClick={handleNext}>
                    Next <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
            </div>
        </div>
    );

    const renderWizardStep3 = () => (
        <div className="space-y-6">
            <h3 className="text-lg font-medium text-[var(--st-text)]">Step 3: Secure Credentials</h3>
            <div className="space-y-1.5">
                <Label htmlFor="credentials" className="flex items-center gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5 text-[var(--st-text)]" />
                    Credentials (JSON)
                </Label>
                <Textarea
                    id="credentials"
                    rows={4}
                    value={credentialsData}
                    onChange={e => setCredentialsData(e.target.value)}
                    spellCheck={false}
                    autoComplete="off"
                    className="font-mono text-[12.5px]"
                    placeholder='{"apiKey":"…","signingSecret":"…"}'
                />
                <p className="text-[12px] text-[var(--st-text-secondary)]">
                    Stored encrypted at rest. Never displayed back to the UI.
                </p>
            </div>
            <div className="flex items-center justify-between rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2">
                <div>
                    <Label htmlFor="isActive-toggle" className="cursor-pointer">
                        Activate Immediately
                    </Label>
                    <p className="text-[12px] text-[var(--st-text-secondary)]">
                        Toggle on to enable this integration as soon as it is created.
                    </p>
                </div>
                <Switch
                    id="isActive-toggle"
                    checked={isActive}
                    onCheckedChange={(v) => setIsActive(v === true)}
                />
            </div>
            <div className="flex justify-between pt-4">
                <Button type="button" variant="outline" onClick={handleBack}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                {/* Submit the actual form values via hidden inputs and the main form action */}
                <SubmitButton isEditing={false} />
            </div>
        </div>
    );

    return (
        <Card className="p-6">
            {!isEditing && (
                <div className="mb-8 flex items-center justify-center space-x-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="flex items-center">
                            <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${step === i ? 'border-primary text-[var(--st-text)]' : step > i ? 'border-primary bg-[var(--st-text)] text-white' : 'border-[var(--st-border)] text-[var(--st-text-secondary)]'}`}>
                                {step > i ? <CheckCircle2 className="h-5 w-5" /> : <span className="text-sm font-semibold">{i}</span>}
                            </div>
                            {i < 3 && <div className={`h-1 w-12 mx-2 rounded ${step > i ? 'bg-[var(--st-text)]' : 'bg-[var(--st-border)]'}`} />}
                        </div>
                    ))}
                </div>
            )}
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input type="hidden" name="integrationId" value={initialData!._id} />
                ) : null}
                
                {/* Hidden inputs always reflect state for the Server Action */}
                <input type="hidden" name="provider" value={provider} />
                <input type="hidden" name="name" value={name} />
                <input type="hidden" name="webhookUrl" value={webhookUrl} />
                <input type="hidden" name="config" value={configData} />
                <input type="hidden" name="credentials" value={credentialsData} />
                <input type="hidden" name="isActive" value={isActive ? 'on' : 'off'} />

                {!isEditing ? (
                    <>
                        {step === 1 && renderWizardStep1()}
                        {step === 2 && renderWizardStep2()}
                        {step === 3 && renderWizardStep3()}
                    </>
                ) : (
                    <>
                        {/* Standard Edit Form */}
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="name">Name *</Label>
                                <Input id="name" value={name} onChange={e => setName(e.target.value)} required />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="provider-trigger">Provider *</Label>
                                <Select value={provider} onValueChange={setProvider}>
                                    <SelectTrigger id="provider-trigger">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PROVIDER_OPTIONS.map((o) => (
                                            <SelectItem key={o.value} value={o.value}>
                                                {o.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="webhookUrl">Webhook URL</Label>
                            <Input id="webhookUrl" type="url" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="config">Config (JSON)</Label>
                            <Textarea id="config" rows={6} value={configData} onChange={e => setConfigData(e.target.value)} spellCheck={false} className="font-mono text-[12.5px]" />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="credentials" className="flex items-center gap-1.5">
                                <ShieldAlert className="h-3.5 w-3.5 text-[var(--st-text)]" />
                                Credentials (JSON)
                            </Label>
                            <Textarea
                                id="credentials"
                                rows={4}
                                value={credentialsData}
                                onChange={e => setCredentialsData(e.target.value)}
                                spellCheck={false}
                                autoComplete="off"
                                className="font-mono text-[12.5px]"
                                placeholder='Leave blank to keep existing credentials. Paste JSON here to ROTATE.'
                            />
                        </div>

                        <div className="flex items-center justify-between rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2">
                            <div>
                                <Label htmlFor="isActive-toggle" className="cursor-pointer">Active</Label>
                            </div>
                            <Switch id="isActive-toggle" checked={isActive} onCheckedChange={(v) => setIsActive(v === true)} />
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                            <Button variant="ghost" asChild>
                                <Link href={BASE}>
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    Back to integrations
                                </Link>
                            </Button>
                            <SubmitButton isEditing={isEditing} />
                        </div>
                    </>
                )}
            </form>
        </Card>
    );
}
