'use client';

import { Button, Card, CardBody, CardHeader, CardTitle, Alert, AlertDescription, AlertTitle, Badge, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui/compat';
import {
  ShieldCheck,
  Copy,
  ExternalLink,
  Send } from 'lucide-react';

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
                description="Send server-side events to Meta for privacy-safe conversion tracking. Bypasses iOS 14+ / ad-blocker signal loss."
                actions={
                    <Badge className="bg-[var(--st-text)] text-white">
                        <ShieldCheck className="h-3 w-3 mr-1" /> Server-side
                    </Badge>
                }
            />

            <Alert>
                <ShieldCheck className="h-4 w-4" />
                <AlertTitle>Why CAPI?</AlertTitle>
                <AlertDescription>
                    Meta Pixel alone loses ~30% of events on modern browsers. CAPI closes that gap by sending events server-to-server,
                    and lets you match purchase revenue to ads with near-perfect attribution.
                </AlertDescription>
            </Alert>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">1. Pick a pixel</CardTitle>
                </CardHeader>
                <CardBody className="space-y-2">
                    {pixels.length === 0 ? (
                        <p className="text-sm text-[var(--st-text-secondary)]">No pixels yet — create one from Pixels & datasets first.</p>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {pixels.map((p) => (
                                <button
                                    key={p.id}
                                    onClick={() => setSelectedPixelId(p.id)}
                                    className={`px-3 py-1.5 rounded-full text-xs border ${
                                        p.id === selectedPixelId ? 'bg-[var(--st-text)] text-white border-[var(--st-border)]' : ''
                                    }`}
                                >
                                    {p.name}
                                </button>
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
                    <div className="flex items-center gap-2 bg-[var(--st-bg-muted)] p-2.5 rounded font-mono text-xs">
                        <span className="flex-1 break-all">{endpoint}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copy(endpoint)}>
                            <Copy className="h-3 w-3" />
                        </Button>
                    </div>
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">3. Sample event payload</CardTitle>
                </CardHeader>
                <CardBody>
                    <pre className="bg-[var(--st-bg-muted)] p-3 rounded text-xs overflow-x-auto">{samplePayload}</pre>
                    <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => copy(samplePayload)}
                    >
                        <Copy className="h-3 w-3 mr-1" /> Copy payload
                    </Button>
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">4. Send a test event from SabNode</CardTitle>
                </CardHeader>
                <CardBody className="space-y-4 text-sm">
                    <p>
                        SabNode provides a server action <code className="px-1 py-0.5 bg-[var(--st-bg-muted)] rounded">sendConversionApiEvent</code> you can
                        call from your e-commerce checkout, CRM webhook, or backend.
                    </p>
                    <div className="flex items-end gap-3">
                        <div className="space-y-1.5">
                            <p className="text-xs font-medium text-[var(--st-text-secondary)]">Event name</p>
                            <Select value={testEventName} onValueChange={setTestEventName}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PageView">PageView</SelectItem>
                                    <SelectItem value="Purchase">Purchase</SelectItem>
                                    <SelectItem value="Lead">Lead</SelectItem>
                                    <SelectItem value="AddToCart">AddToCart</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
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
                            <Send className="h-4 w-4 mr-1" />
                            {sendingTest ? 'Sending...' : 'Send Test Event'}
                        </Button>
                    </div>
                    <Button variant="outline" asChild>
                        <a
                            href="https://developers.facebook.com/docs/marketing-api/conversions-api"
                            target="_blank"
                            rel="noreferrer"
                        >
                            Read Meta CAPI docs <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                    </Button>
                </CardBody>
            </Card>
        </div>
    );
}
