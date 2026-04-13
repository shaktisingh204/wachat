'use client';

import * as React from 'react';
import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { type LucideIcon } from 'lucide-react';

export interface TelegramPlaceholderProps {
    title: string;
    description: string;
    icon: LucideIcon;
    bullets?: string[];
    ctaLabel?: string;
    ctaHref?: string;
    docsHref?: string;
    badge?: string;
}

export function TelegramPlaceholder({
    title,
    description,
    icon: Icon,
    bullets,
    ctaLabel,
    ctaHref,
    docsHref,
    badge = 'Coming soon',
}: TelegramPlaceholderProps) {
    return (
        <div className="flex flex-col gap-6 clay-enter">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                    <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                        style={{
                            background: 'linear-gradient(135deg, #37BBFE 0%, #007DBB 100%)',
                            boxShadow: '0 10px 28px rgba(0, 125, 187, 0.25)',
                        }}
                    >
                        <Icon className="h-6 w-6 text-white" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-clay-ink">
                                {title}
                            </h1>
                            {badge ? <ClayBadge tone="neutral">{badge}</ClayBadge> : null}
                        </div>
                        <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-clay-ink-muted">
                            {description}
                        </p>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {docsHref ? (
                        <ClayButton
                            variant="pill"
                            size="sm"
                            onClick={() => window.open(docsHref, '_blank', 'noopener,noreferrer')}
                        >
                            Docs
                        </ClayButton>
                    ) : null}
                    {ctaLabel && ctaHref ? (
                        <ClayButton
                            variant="obsidian"
                            size="sm"
                            onClick={() => {
                                window.location.href = ctaHref;
                            }}
                        >
                            {ctaLabel}
                        </ClayButton>
                    ) : null}
                </div>
            </div>

            {bullets && bullets.length > 0 ? (
                <ClayCard variant="soft" padded>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-clay-ink-muted">
                        What this will do
                    </p>
                    <ul className="mt-3 flex flex-col gap-2.5">
                        {bullets.map((b) => (
                            <li key={b} className="flex items-start gap-2 text-[13px] text-clay-ink">
                                <span
                                    className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full"
                                    style={{ background: '#37BBFE' }}
                                />
                                <span>{b}</span>
                            </li>
                        ))}
                    </ul>
                </ClayCard>
            ) : null}
        </div>
    );
}
