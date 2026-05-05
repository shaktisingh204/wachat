'use client';

import { Inbox } from 'lucide-react';
import { ZoruBadge, ZoruButton, ZoruCard } from '@/components/zoruui';

const BULLETS = [
    'Connect via Settings → Business → Chatbots on a Premium account',
    'Manage Quick Replies, Greeting and Away messages programmatically',
    'Per-chat permissions with revocation support',
    'Only 1:1 chats — groups and channels are not included',
];

export default function TelegramBusinessInboxPage() {
    return (
        <div className="flex h-full w-full flex-col">
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
                            <Inbox className="h-6 w-6 text-white" strokeWidth={1.75} />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h1 className="text-[22px] leading-tight text-zoru-ink">Business Inbox</h1>
                                <ZoruBadge variant="ghost">Coming soon</ZoruBadge>
                            </div>
                            <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-zoru-ink-muted">
                                Handle chats on behalf of a Telegram Premium Business user. Your bot receives business_connection updates and can reply, edit, and delete messages.
                            </p>
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <ZoruButton
                            variant="outline"
                            size="sm"
                            onClick={() => window.open('https://core.telegram.org/bots/business', '_blank', 'noopener,noreferrer')}
                        >
                            Docs
                        </ZoruButton>
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
        </div>
    );
}
