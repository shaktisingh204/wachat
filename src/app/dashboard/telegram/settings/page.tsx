'use client';

import { Settings } from 'lucide-react';
import { ZoruBadge, ZoruCard } from '@/components/zoruui';

const BULLETS = [
    'Default bot and fallback routing',
    'Business hours and away-message windows',
    'Agent assignment strategy (round-robin, load-balanced, skill-based)',
    'Message retention and GDPR export controls',
];

export default function TelegramSettingsPage() {
    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                    <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                        style={{
                            background: 'linear-gradient(135deg, #37BBFE 0%, #007DBB 100%)',
                            boxShadow: '0 10px 28px rgba(0, 125, 187, 0.25)',
                        }}
                    >
                        <Settings className="h-6 w-6 text-white" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h1 className="text-[22px] leading-tight text-zoru-ink">Settings</h1>
                            <ZoruBadge variant="ghost">Coming soon</ZoruBadge>
                        </div>
                        <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-zoru-ink-muted">
                            Workspace-level Telegram preferences — default language, business hours, agent defaults, and data retention.
                        </p>
                    </div>
                </div>
            </div>
            <ZoruCard className="p-6">
                <p className="text-[11px] uppercase tracking-[0.12em] text-zoru-ink-muted">What this will do</p>
                <ul className="mt-3 flex flex-col gap-2.5">
                    {BULLETS.map((b) => (
                        <li key={b} className="flex items-start gap-2 text-[13px] text-zoru-ink">
                            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: '#37BBFE' }} />
                            <span>{b}</span>
                        </li>
                    ))}
                </ul>
            </ZoruCard>
        </div>
    );
}
