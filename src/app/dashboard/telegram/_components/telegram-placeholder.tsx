'use client';

import {
    Badge,
    Button,
    Card,
    Dot,
    PageActions,
    PageDescription,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
} from '@/components/sabcrm/20ui';
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
            <PageHeader>
                <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--st-radius-lg)] bg-[var(--st-text)] text-[var(--st-bg-secondary)]">
                        <Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
                    </div>
                    <PageHeaderHeading>
                        <div className="flex items-center gap-2">
                            <PageTitle>{title}</PageTitle>
                            {badge ? <Badge tone="neutral">{badge}</Badge> : null}
                        </div>
                        <PageDescription>{description}</PageDescription>
                    </PageHeaderHeading>
                </div>
                {docsHref || (ctaLabel && ctaHref) ? (
                    <PageActions>
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
                                variant="primary"
                                size="sm"
                                onClick={() => {
                                    window.location.href = ctaHref;
                                }}
                            >
                                {ctaLabel}
                            </Button>
                        ) : null}
                    </PageActions>
                ) : null}
            </PageHeader>

            {bullets && bullets.length > 0 ? (
                <Card padding="lg">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--st-text-secondary)]">
                        What this will do
                    </p>
                    <ul className="mt-3 flex flex-col gap-2.5">
                        {bullets.map((b) => (
                            <li key={b} className="flex items-start gap-2 text-[13px] text-[var(--st-text)]">
                                <Dot tone="neutral" className="mt-[7px] shrink-0" />
                                <span>{b}</span>
                            </li>
                        ))}
                    </ul>
                </Card>
            ) : null}
        </div>
    );
}
