'use client';

import { Badge, Button, Card } from '@/components/sabcrm/20ui/compat';
import * as React from 'react';

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
        <div className="flex flex-col gap-6">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                    <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                        style={{
                            background: 'var(--zoru-ink)',
                        }}
                    >
                        <Icon className="h-6 w-6" style={{ color: 'var(--zoru-surface)' }} strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h1 className="text-[22px] leading-tight text-zoru-ink">
                                {title}
                            </h1>
                            {badge ? <Badge variant="ghost">{badge}</Badge> : null}
                        </div>
                        <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-zoru-ink-muted">
                            {description}
                        </p>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {docsHref ? (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(docsHref, '_blank', 'noopener,noreferrer')}
                        >
                            Docs
                        </Button>
                    ) : null}
                    {ctaLabel && ctaHref ? (
                        <Button
                            size="sm"
                            onClick={() => {
                                window.location.href = ctaHref;
                            }}
                        >
                            {ctaLabel}
                        </Button>
                    ) : null}
                </div>
            </div>

            {bullets && bullets.length > 0 ? (
                <Card className="p-6">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-zoru-ink-muted">
                        What this will do
                    </p>
                    <ul className="mt-3 flex flex-col gap-2.5">
                        {bullets.map((b) => (
                            <li key={b} className="flex items-start gap-2 text-[13px] text-zoru-ink">
                                <span
                                    className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full"
                                    style={{ background: 'var(--zoru-ink)' }}
                                />
                                <span>{b}</span>
                            </li>
                        ))}
                    </ul>
                </Card>
            ) : null}
        </div>
    );
}
