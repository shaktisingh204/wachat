'use client';

import {
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruPageDescription,
  cn,
} from '@/components/zoruui';
import {
  useState } from 'react';

import { ApiKeyManager } from "./api-keys-manager";

const TABS = [
    { id: 'otp', label: 'Send OTP / Transactional' },
    { id: 'keys', label: 'API Keys' },
    { id: 'webhook', label: 'Webhooks' },
] as const;

type TabId = typeof TABS[number]['id'];

export default function SmsDeveloperPage() {
    const [tab, setTab] = useState<TabId>('otp');

    return (
        <div className="space-y-6">
            <ZoruPageHeader>
                <ZoruPageHeading>
                    <ZoruPageTitle>Developer API</ZoruPageTitle>
                    <ZoruPageDescription>Integrate SMS capabilities directly into your applications.</ZoruPageDescription>
                </ZoruPageHeading>
            </ZoruPageHeader>

            <div className="flex gap-1 rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-surface p-1 w-fit">
                {TABS.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => setTab(t.id)}
                        className={cn(
                            "rounded-[var(--zoru-radius-sm)] px-3 py-1.5 text-sm transition-colors",
                            tab === t.id
                                ? "bg-zoru-bg text-zoru-ink shadow-[var(--zoru-shadow-sm)]"
                                : "text-zoru-ink-muted hover:text-zoru-ink",
                        )}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === 'otp' && (
                <div className="space-y-4">
                    <ZoruCard className="p-0">
                        <ZoruCardHeader>
                            <ZoruCardTitle>Send Transactional SMS</ZoruCardTitle>
                            <ZoruCardDescription>Endpoint for sending high-priority OTPs or alerts.</ZoruCardDescription>
                        </ZoruCardHeader>
                        <ZoruCardContent className="space-y-4">
                            <div className="bg-zoru-surface-2 p-4 rounded-md font-mono text-sm relative">
                                <span className="text-zoru-info-ink">POST</span> /api/v1/sms/send
                                <div className="mt-2 text-zoru-ink-muted">
                                    {`{
  "to": "919876543210",
  "templateId": "your_dlt_template_id",
  "variables": ["123456"] // Maps to {#var#}
}`}
                                </div>
                            </div>
                            <p className="text-sm">Note: Authentication headers required (Bearer Token).</p>
                        </ZoruCardContent>
                    </ZoruCard>
                </div>
            )}

            {tab === 'keys' && <ApiKeyManager />}

            {tab === 'webhook' && (
                <ZoruCard className="p-0">
                    <ZoruCardHeader>
                        <ZoruCardTitle>Delivery Reports</ZoruCardTitle>
                        <ZoruCardDescription>Receive real-time updates on message status.</ZoruCardDescription>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <p className="text-sm mb-2">Configure your provider to send webhooks to:</p>
                        <div className="bg-zoru-surface-2 p-2 rounded-md font-mono text-sm inline-block">
                            https://sabnode.com/api/sms/webhook
                        </div>
                    </ZoruCardContent>
                </ZoruCard>
            )}
        </div>
    );
}
