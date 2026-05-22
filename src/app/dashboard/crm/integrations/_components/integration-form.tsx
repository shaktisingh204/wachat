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
  Switch,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft,
  LoaderCircle,
  Save,
  ShieldAlert } from 'lucide-react';

/**
 * <IntegrationForm /> — create + edit form for `crm_integrations`.
 *
 * Binds to `saveIntegration` via `useActionState`. The `credentials`
 * textarea is intentionally a JSON blob and is shown as an empty box
 * on edit — typing new contents OVERWRITES the secrets; leaving it
 * blank keeps the current secrets untouched.
 *
 * Plaintext credentials are NEVER pre-filled here; the server only
 * returns `'***hidden***'`.
 */

import {
    saveIntegration,
    type CrmIntegrationDoc,
} from '@/app/actions/crm-integrations.actions';

const BASE = '/dashboard/crm/integrations';

const PROVIDER_OPTIONS: Array<{ value: string; label: string }> = [
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
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveIntegration, initialState);
    const [provider, setProvider] = useState<string>(
        initialData?.provider ?? 'webhook',
    );
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

    const configInitial = initialData?.config
        ? JSON.stringify(initialData.config, null, 2)
        : '{}';

    return (
        <Card className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input
                        type="hidden"
                        name="integrationId"
                        value={initialData!._id}
                    />
                ) : null}
                <input type="hidden" name="provider" value={provider} />
                <input
                    type="hidden"
                    name="isActive"
                    value={isActive ? 'on' : 'off'}
                />

                {/* Row 1: Name + Provider */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="name">Name *</Label>
                        <Input
                            id="name"
                            name="name"
                            required
                            placeholder="e.g. Ops Slack alerts"
                            defaultValue={initialData?.name ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="provider-trigger">Provider *</Label>
                        <Select value={provider} onValueChange={setProvider}>
                            <ZoruSelectTrigger id="provider-trigger">
                                <ZoruSelectValue placeholder="Pick a provider…" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {PROVIDER_OPTIONS.map((o) => (
                                    <ZoruSelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </Select>
                    </div>
                </div>

                {/* Row 2: Webhook URL */}
                <div className="space-y-1.5">
                    <Label htmlFor="webhookUrl">Webhook URL</Label>
                    <Input
                        id="webhookUrl"
                        name="webhookUrl"
                        type="url"
                        placeholder="https://hooks.example.com/services/…"
                        defaultValue={initialData?.webhookUrl ?? ''}
                    />
                </div>

                {/* Row 3: Config (JSON) */}
                <div className="space-y-1.5">
                    <Label htmlFor="config">Config (JSON)</Label>
                    <Textarea
                        id="config"
                        name="config"
                        rows={6}
                        defaultValue={configInitial}
                        spellCheck={false}
                        className="font-mono text-[12.5px]"
                        placeholder='{"channelId":"C123","region":"eu-west-1"}'
                    />
                    <p className="text-[12px] text-zoru-ink-muted">
                        Non-secret configuration. JSON object. Channel ids, region,
                        feature flags, etc.
                    </p>
                </div>

                {/* Row 4: Credentials (JSON) — never pre-filled */}
                <div className="space-y-1.5">
                    <Label htmlFor="credentials" className="flex items-center gap-1.5">
                        <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                        Credentials (JSON)
                    </Label>
                    <Textarea
                        id="credentials"
                        name="credentials"
                        rows={4}
                        spellCheck={false}
                        autoComplete="off"
                        className="font-mono text-[12.5px]"
                        placeholder={
                            isEditing
                                ? 'Leave blank to keep existing credentials. Paste JSON here to ROTATE.'
                                : '{"apiKey":"…","signingSecret":"…"}'
                        }
                    />
                    <p className="text-[12px] text-zoru-ink-muted">
                        Stored encrypted at rest. Never displayed back to the UI.
                        {isEditing
                            ? ' Leave this field blank to keep the current secrets.'
                            : null}
                    </p>
                </div>

                {/* Row 5: Active toggle */}
                <div className="flex items-center justify-between rounded-md border border-zoru-line bg-zoru-surface-2 px-3 py-2">
                    <div>
                        <Label htmlFor="isActive-toggle" className="cursor-pointer">
                            Active
                        </Label>
                        <p className="text-[12px] text-zoru-ink-muted">
                            Inactive integrations don't fire on webhooks or sync.
                        </p>
                    </div>
                    <Switch
                        id="isActive-toggle"
                        checked={isActive}
                        onCheckedChange={(v) => setIsActive(v === true)}
                    />
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
            </form>
        </Card>
    );
}
