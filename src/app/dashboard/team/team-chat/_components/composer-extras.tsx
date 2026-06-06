'use client';

/**
 * Composer overlays — @mention autocomplete + /slash command stub.
 * Wired by the parent: it owns the textarea / Input element and only
 * delegates suggestion picking + caret manipulation here.
 */
import * as React from 'react';

const SLASH_COMMANDS: { name: string; description: string }[] = [
    { name: '/me', description: 'Send a message as an action ("/me is shipping")' },
    { name: '/remind', description: 'Set a reminder (stub — no-op)' },
    { name: '/shrug', description: 'Append ¯\\_(ツ)_/¯' },
    { name: '/here', description: 'Notify everyone currently active' },
    { name: '/poll', description: 'Start a quick poll (stub — no-op)' },
];

export interface MentionCandidate {
    id: string;
    name: string;
    email?: string;
}

export interface ComposerExtrasProps {
    value: string;
    onPick: (next: string) => void;
    candidates: MentionCandidate[];
}

interface ParsedTrigger {
    kind: 'mention' | 'slash';
    query: string;
    /** Position of the trigger char (`@` or `/`). */
    triggerIndex: number;
    /** Caret position (after the query). */
    caretEnd: number;
}

function parseTrigger(value: string): ParsedTrigger | null {
    // Look at the trailing token.
    const trailing = value.match(/(^|\s)(@|\/)([\w-]*)$/);
    if (!trailing) return null;
    const triggerChar = trailing[2];
    const query = trailing[3] ?? '';
    const triggerIndex = value.length - query.length - 1;
    if (triggerChar === '/' && triggerIndex !== 0) return null; // slash must be the first char
    return {
        kind: triggerChar === '@' ? 'mention' : 'slash',
        query: query.toLowerCase(),
        triggerIndex,
        caretEnd: value.length,
    };
}

export function ComposerExtras({
    value,
    onPick,
    candidates,
}: ComposerExtrasProps) {
    const trigger = React.useMemo(() => parseTrigger(value), [value]);
    if (!trigger) return null;

    if (trigger.kind === 'slash') {
        const matches = SLASH_COMMANDS.filter((c) =>
            c.name.toLowerCase().includes(trigger.query),
        ).slice(0, 6);
        if (!matches.length) return null;
        return (
            <PopoverList>
                {matches.map((c) => (
                    <button
                        key={c.name}
                        type="button"
                        onClick={() => {
                            const before = value.slice(0, trigger.triggerIndex);
                            onPick(`${before}${c.name} `);
                        }}
                        className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-[var(--st-bg-muted)]"
                    >
                        <span className="font-medium text-[var(--st-text)]">{c.name}</span>
                        <span className="truncate text-[var(--st-text-secondary)]">{c.description}</span>
                    </button>
                ))}
            </PopoverList>
        );
    }

    const q = trigger.query;
    const matches = candidates
        .filter(
            (u) =>
                u.name.toLowerCase().includes(q) ||
                (u.email ?? '').toLowerCase().includes(q),
        )
        .slice(0, 6);
    if (!matches.length) return null;

    return (
        <PopoverList>
            {matches.map((u) => (
                <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                        const before = value.slice(0, trigger.triggerIndex);
                        onPick(`${before}@${u.name} `);
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-[var(--st-bg-muted)]"
                >
                    <span className="text-[var(--st-text)]">@{u.name}</span>
                    <span className="truncate text-[var(--st-text-secondary)]">{u.email}</span>
                </button>
            ))}
        </PopoverList>
    );
}

function PopoverList({ children }: { children: React.ReactNode }) {
    return (
        <div className="mb-2 max-h-[200px] overflow-auto rounded-md border border-[var(--st-border)] bg-[var(--st-bg)] p-1 shadow-md">
            {children}
        </div>
    );
}
