'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { saveSmsConfig } from '@/app/actions/sms-config.actions';
import { toast } from '@/hooks/use-toast';
import { LoaderCircle, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { SmsProviderConfig } from '@/lib/definitions';

const PROVIDERS = [
    { value: 'twilio', label: 'Twilio' },
    { value: 'msg91', label: 'MSG91 (India DLT)' },
    { value: 'aws-sns', label: 'AWS SNS' },
    { value: 'gupshup', label: 'Gupshup' },
    { value: 'plivo', label: 'Plivo' },
    { value: 'vonage', label: 'Vonage (Nexmo)' },
    { value: 'clicksend', label: 'ClickSend' },
    { value: 'messagebird', label: 'MessageBird' },
    { value: 'sinch', label: 'Sinch' },
    { value: 'kaleyra', label: 'Kaleyra' },
    { value: '2factor', label: '2Factor.in' },
    { value: 'fast2sms', label: 'Fast2SMS' },
    { value: 'infobip', label: 'Infobip' },
    { value: 'termii', label: 'Termii' },
    { value: 'telnyx', label: 'Telnyx' },
    { value: 'bandwidth', label: 'Bandwidth' },
    { value: 'cm-com', label: 'CM.com' },
    { value: 'textmagic', label: 'TextMagic' },
    { value: 'karix', label: 'Karix' },
    { value: 'textlocal', label: 'TextLocal' },
    { value: 'africastalking', label: 'Africastalking' },
    { value: 'bulksms', label: 'BulkSMS' },
    { value: 'generic', label: 'Generic HTTP (Custom)' },
];

const PROVIDER_FIELDS: Record<string, { key: string; label: string; type?: string; placeholder?: string }[]> = {
    twilio: [
        { key: 'accountSid', label: 'Account SID', placeholder: 'AC...' },
        { key: 'authToken', label: 'Auth Token', type: 'password' },
        { key: 'fromNumber', label: 'From Number', placeholder: '+1234567890' },
    ],
    msg91: [
        { key: 'authKey', label: 'Auth Key' },
        { key: 'senderId', label: 'Sender ID (6 chars)', placeholder: 'WACHAT' },
    ],
    'aws-sns': [
        { key: 'accessKeyId', label: 'Access Key ID' },
        { key: 'secretAccessKey', label: 'Secret Access Key', type: 'password' },
        { key: 'region', label: 'Region', placeholder: 'us-east-1' },
    ],
    gupshup: [
        { key: 'userId', label: 'User ID / Email' },
        { key: 'password', label: 'Password', type: 'password' },
    ],
    plivo: [
        { key: 'authId', label: 'Auth ID' },
        { key: 'authToken', label: 'Auth Token', type: 'password' },
        { key: 'src', label: 'Source (Sender ID)', placeholder: 'MyBrand' },
    ],
    vonage: [
        { key: 'apiKey', label: 'API Key' },
        { key: 'apiSecret', label: 'API Secret', type: 'password' },
        { key: 'from', label: 'From (Sender)', placeholder: 'BrandName' },
    ],
    // Generic fallback for others that typically use just an API Key and maybe a specific Sender ID
    // We can specialize these as needed.
    default: [
        { key: 'apiKey', label: 'API Key / Token', type: 'password' },
        { key: 'senderId', label: 'Sender ID', placeholder: 'Enter Sender ID' },
        { key: 'baseUrl', label: 'Base URL (Optional)', placeholder: 'https://api.provider.com/...' },
    ]
};

// Helper to get fields
const getFields = (provider: string) => {
    return PROVIDER_FIELDS[provider] || PROVIDER_FIELDS['default'];
};

interface ProviderConfigFormProps {
    initialConfig: SmsProviderConfig | null;
}

export function ProviderConfigForm({ initialConfig }: ProviderConfigFormProps) {
    const [selectedProvider, setSelectedProvider] = useState(initialConfig?.provider || 'twilio');
    const [isPending, startTransition] = useTransition();

    const handleSave = async (formData: FormData) => {
        startTransition(async () => {
            try {
                const res = await saveSmsConfig(formData);
                if (res.success) {
                    toast({
                        title: "Configuration Saved",
                        description: `Successfully updated ${selectedProvider} settings.`,
                        action: <CheckCircle2 className="h-5 w-5 text-green-500" />
                    });
                }
            } catch (e: any) {
                toast({
                    title: "Error",
                    description: e.message || "Failed to save configuration",
                    variant: "destructive"
                });
            }
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>SMS Provider Configuration</CardTitle>
                <CardDescription>Select and configure your SMS gateway.</CardDescription>
            </CardHeader>
            <form action={handleSave}>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label>Select Provider</Label>
                        <Select
                            name="provider"
                            value={selectedProvider}
                            onValueChange={setSelectedProvider}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select a provider" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                                {PROVIDERS.map(p => (
                                    <SelectItem key={p.value} value={p.value}>
                                        {p.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-4 border rounded-md p-4 bg-muted/20">
                        <h4 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-4">
                            {PROVIDERS.find(p => p.value === selectedProvider)?.label} Credentials
                        </h4>

                        <div className="grid gap-4">
                            {getFields(selectedProvider).map((field) => (
                                <div key={field.key} className="space-y-2">
                                    <Label htmlFor={field.key}>{field.label}</Label>
                                    <Input
                                        name={field.key}
                                        id={field.key}
                                        type={field.type || 'text'}
                                        placeholder={field.placeholder}
                                        defaultValue={initialConfig?.credentials?.[field.key] || ''}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="dlt-section" className="text-base">DLT Configuration (India)</Label>
                        </div>
                        <p className="text-xs text-muted-foreground -mt-3">
                            Required for providers like MSG91, 2Factor, Fast2SMS, etc. when sending to +91.
                        </p>
                        <div className="grid gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="principalEntityId">Principal Entity ID</Label>
                                <Input
                                    name="principalEntityId"
                                    id="principalEntityId"
                                    placeholder="1001xxxxxxxxxxxxxxxx"
                                    defaultValue={initialConfig?.dltPeId || ''}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2 pt-2">
                        <Switch id="isActive" name="isActive" defaultChecked={initialConfig?.isActive !== false} />
                        <Label htmlFor="isActive">Enable this provider</Label>
                    </div>

                </CardContent>
                <CardFooter>
                    <Button type="submit" className="w-full" disabled={isPending}>
                        {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Configuration
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}

