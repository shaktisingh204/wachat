'use client';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  IconButton,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/sabcrm/20ui';
import {
  Copy,
  ExternalLink,
  Send,
  ShieldCheck,
} from 'lucide-react';

import * as React from 'react';

import { AmBreadcrumb, AmHeader } from '@/app/dashboard/ad-manager/_components/am-page-shell';
import { useToast } from '@/hooks/use-toast';
import { useAdManager } from '@/context/ad-manager-context';
import { listPixels } from '@/app/actions/ad-manager.actions';
import { sendTestConversionEvent } from '@/app/actions/ad-manager-features.actions';

const getSamplePayload = (timestamp: number) => `{
  "event_name": "Purchase",
  "event_time": ${timestamp},
  "action_source": "website",
  "event_source_url": "https://example.com/thank-you",
  "user_data": {
    "em": "<SHA256_hashed_email>",
    "ph": "<SHA256_hashed_phone>",
    "client_ip_address": "1.2.3.4",
    "client_user_agent": "Mozilla/5.0 ..."
  },
  "custom_data": {
    "currency": "USD",
    "value": 29.99
  }
}`;

export default function CapiPage() {
    const { toast } = useToast();
    const { activeAccount } = useAdManager();
    const [pixels, setPixels] = React.useState<any[]>([]);
    const [selectedPixelId, setSelectedPixelId] = React.useState<string>('');
    const [testEventName, setTestEventName] = React.useState<string>('PageView');
    const [sendingTest, setSendingTest] = React.useState(false);
    const [samplePayload, setSamplePayload] = React.useState<string>(getSamplePayload(0));

    React.useEffect(() => {
        setSamplePayload(getSamplePayload(Math.floor(Date.now() / 1000)));
        if (!activeAccount) return;
        (async () => {
            const res = await listPixels(activeAccount.account_id);
            setPixels(res.data || []);
            if (res.data?.[0]) setSelectedPixelId(res.data[0].id);
        })();
    }, [activeAccount]);

    const copy = (s: string) => {
        navigator.clipboard.writeText(s);
        toast({ title: 'Copied to clipboard' });
    };

    const endpoint = selectedPixelId
        ? `https://graph.facebook.com/v23.0/${selectedPixelId}/events`
        : 'https://graph.facebook.com/v23.0/{pixel_id}/events';

    return (
        <div className="space-y-6 max-w-4xl">
            <AmBreadcrumb page="Conversions API" />
            <AmHeader
                title="Conversions API (CAPI)"
                description="Send server-side events to Meta for privacy-safe conversion tracking. Bypasses iOS 14+ and ad-blocker signal loss."
                actions={
                    <Badge tone="neutral" kind="solid">
                        <ShieldCheck className="h-3 w-3 mr-1" aria-hidden="true" /> Server-side
                    </Badge>
                }
            />

            <Alert tone="info" icon={ShieldCheck}>
                <AlertTitle>Why CAPI?</AlertTitle>
                <AlertDescription>
                    Meta Pixel alone loses about 30% of events on modern browsers. CAPI closes that gap by sending events server-to-server,
                    and lets you match purchase revenue to ads with near-perfect attribution.
                </AlertDescription>
            </Alert>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">1. Pick a pixel</CardTitle>
                </CardHeader>
                <CardBody className="space-y-2">
                    {pixels.length === 0 ? (
                        <EmptyState
                            size="sm"
                            title="No pixels yet"
                            description="Create one from Pixels and datasets first."
                        />
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {pixels.map((p) => (
                                <Button
                                    key={p.id}
                                    size="sm"
                                    variant={p.id === selectedPixelId ? 'primary' : 'secondary'}
                                    aria-pressed={p.id === selectedPixelId}
                                    onClick={() => setSelectedPixelId(p.id)}
                                >
                                    {p.name}
                                </Button>
                            ))}
                        </div>
                    )}
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">2. Endpoint</CardTitle>
                </CardHeader>
                <CardBody>
                    <div className="flex items-center gap-2 bg-[var(--st-bg-muted)] p-2.5 rounded-[var(--st-radius)] font-mono text-xs">
                        <span className="flex-1 break-all">{endpoint}</span>
                        <IconButton
                            label="Copy endpoint URL"
                            icon={Copy}
                            size="sm"
                            onClick={() => copy(endpoint)}
                        />
                    </div>
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">3. Sample event payload</CardTitle>
                </CardHeader>
                <CardBody>
                    <pre className="bg-[var(--st-bg-muted)] p-3 rounded-[var(--st-radius)] text-xs overflow-x-auto">{samplePayload}</pre>
                    <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        iconLeft={Copy}
                        onClick={() => copy(samplePayload)}
                    >
                        Copy payload
                    </Button>
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">4. Send a test event from SabNode</CardTitle>
                </CardHeader>
                <CardBody className="space-y-4 text-sm">
                    <p>
                        SabNode provides a server action <code className="px-1 py-0.5 bg-[var(--st-bg-muted)] rounded-[var(--st-radius-sm)]">sendConversionApiEvent</code> you can
                        call from your e-commerce checkout, CRM webhook, or backend.
                    </p>
                    <div className="flex items-end gap-3">
                        <Field label="Event name" className="w-[180px]">
                            <Select value={testEventName} onValueChange={setTestEventName}>
                                <SelectTrigger aria-label="Event name">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PageView">PageView</SelectItem>
                                    <SelectItem value="Purchase">Purchase</SelectItem>
                                    <SelectItem value="Lead">Lead</SelectItem>
                                    <SelectItem value="AddToCart">AddToCart</SelectItem>
                                </SelectContent>
                            </Select>
                        </Field>
                        <Button
                            variant="primary"
                            iconLeft={Send}
                            loading={sendingTest}
                            disabled={!selectedPixelId || sendingTest}
                            onClick={async () => {
                                if (!selectedPixelId) return;
                                setSendingTest(true);
                                const res = await sendTestConversionEvent(selectedPixelId, testEventName);
                                setSendingTest(false);
                                if (res.error) {
                                    toast({ title: 'Test event failed', description: res.error, variant: 'destructive' });
                                } else {
                                    toast({ title: 'Test event sent', description: `${testEventName} event sent to pixel ${selectedPixelId}` });
                                }
                            }}
                        >
                            {sendingTest ? 'Sending...' : 'Send Test Event'}
                        </Button>
                    </div>
                    <Button
                        variant="outline"
                        iconRight={ExternalLink}
                        onClick={() =>
                            window.open(
                                'https://developers.facebook.com/docs/marketing-api/conversions-api',
                                '_blank',
                                'noreferrer',
                            )
                        }
                    >
                        Read Meta CAPI docs
                    </Button>
                </CardBody>
            </Card>
        </div>
    );
}
