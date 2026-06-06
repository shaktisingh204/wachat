'use client';

/**
 * TelegramProjectGate — shared "no project selected" banner.
 *
 * Drop this at the top of any Telegram dashboard page that hits the
 * Rust BFF with a projectId. When `activeProject` is non-null it
 * renders nothing; otherwise it explains *why* the page is empty and
 * sends the user to the Telegram project picker, preserving the
 * `?next=` return path so they land back here after picking.
 */

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, Info } from 'lucide-react';

import { useProject } from '@/context/project-context';

export interface TelegramProjectGateProps {
    /** Optional override; defaults to the current pathname. */
    nextPath?: string;
    /** Optional sentence to replace the default explainer. */
    explainer?: React.ReactNode;
}

export function TelegramProjectGate({
    nextPath,
    explainer,
}: TelegramProjectGateProps) {
    const { activeProject } = useProject();
    const pathname = usePathname();

    if (activeProject) return null;

    const target = nextPath ?? pathname ?? '/dashboard/telegram';
    const href = `/dashboard/telegram/projects?next=${encodeURIComponent(target)}`;

    return (
        <div
            className="flex items-start gap-3 rounded-2xl border p-4"
            style={{ borderColor: 'var(--zoru-line)', background: 'var(--zoru-surface-2)' }}
        >
            <Info className="mt-0.5 h-4 w-4 text-[var(--st-text)]" />
            <div className="flex-1 text-[12.5px] leading-relaxed text-[var(--st-text)]">
                {explainer ??
                    'Pick a Telegram project to see data here. Bots, chats, broadcasts, and rules are all scoped to a project.'}
                <div className="mt-2">
                    <Link
                        href={href}
                        className="inline-flex items-center gap-1 text-[var(--st-text)] underline underline-offset-2"
                    >
                        Choose a Telegram project{' '}
                        <ArrowRight className="h-3 w-3" />
                    </Link>
                </div>
            </div>
        </div>
    );
}

/**
 * Convenience hook for pages that need to early-return their own UI
 * but want a single source of truth for "is a project selected?".
 */
export function useTelegramProject() {
    const { activeProject, activeProjectId } = useProject();
    return {
        activeProject,
        projectId: activeProjectId,
        hasProject: !!activeProjectId,
    };
}
