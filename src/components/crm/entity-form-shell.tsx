'use client';

import { Button, Card, CardHeader, CardTitle, CardDescription, CardBody } from '@/components/sabcrm/20ui';
import {
  LoaderCircle } from 'lucide-react';
import { useFormStatus } from 'react-dom';

/**
 * <EntityFormShell /> — reusable form-page chrome for every CRM / HRM
 * `/new` and `/[id]/edit` route (per Phase 1A of the CRM frontend rebuild).
 *
 * - Wraps a single `<form action={action}>` around all sections so server
 *   actions Just Work; no client-side form library required.
 * - Each section renders as a `<Card>` with header + body.
 * - Sticky bottom bar renders cancel (when `cancelHref`) + submit. The
 *   submit button reflects pending state via `useFormStatus` from
 *   react-dom and swaps in a spinning `<LoaderCircle>` icon.
 * - Error / success messages render inline just above the sticky bar.
 *
 * @example
 * ```tsx
 * <EntityFormShell
 *   title="New invoice"
 *   subtitle="Create a sales invoice for a customer."
 *   action={createInvoiceAction}
 *   cancelHref="/dashboard/crm/sales/invoices"
 *   submitLabel="Create invoice"
 *   hiddenInputs={<input type="hidden" name="organisationId" value={orgId} />}
 *   sections={[
 *     {
 *       id: 'parties',
 *       title: 'Parties',
 *       description: 'Customer and billing details.',
 *       children: <PartiesSection />,
 *     },
 *     {
 *       id: 'lines',
 *       title: 'Line items',
 *       children: <LineItemsEditor />,
 *     },
 *   ]}
 *   error={state.error}
 *   message={state.message}
 * />
 * ```
 */

import * as React from 'react';
import Link from 'next/link';

/* ─── Types ──────────────────────────────────────────────────────────── */

export interface EntityFormShellSection {
    id: string;
    title: string;
    description?: string;
    children: React.ReactNode;
}

export interface EntityFormShellProps {
    /** Form-level title (rendered above sections). */
    title?: string;
    subtitle?: string;
    /** Wraps a <form action={action}>. Pass `action` here so the shell can render the submit button. */
    action: (formData: FormData) => Promise<unknown> | void;
    /** Sections list — rendered as Card each. */
    sections: EntityFormShellSection[];
    /** Submit button label (default: "Save"). */
    submitLabel?: string;
    /** Cancel button href (default: hide cancel). */
    cancelHref?: string;
    /** Error string — shown above sticky bar. */
    error?: string;
    /** Success message — shown above sticky bar. */
    message?: string;
    /** Optional dirty-prompt wiring — pass `true` to enable. (Implementation lives in DirtyFormPrompt; see batch2.) */
    dirtyPrompt?: boolean;
    /** Extra hidden inputs (e.g. id for edit). */
    hiddenInputs?: React.ReactNode;
}

/* ─── Submit button (uses useFormStatus, must live inside <form>) ────── */

interface SubmitButtonProps {
    label: string;
}

function SubmitButton({ label }: SubmitButtonProps): React.JSX.Element {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? (
                <>
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>Saving…</span>
                </>
            ) : (
                <span>{label}</span>
            )}
        </Button>
    );
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function EntityFormShell({
    title,
    subtitle,
    action,
    sections,
    submitLabel = 'Save',
    cancelHref,
    error,
    message,
    dirtyPrompt: _dirtyPrompt,
    hiddenInputs,
}: EntityFormShellProps): React.JSX.Element {
    // `dirtyPrompt` is intentionally captured but unused at this layer; the
    // actual <DirtyFormPrompt> wiring lands in a subsequent batch. We accept
    // the prop now so callers don't churn when it ships.
    void _dirtyPrompt;

    // React's `<form action>` typing wants `void | Promise<void>` — the spec
    // allows server actions that return arbitrary values (e.g. redirects or
    // result objects), so we adapt at the boundary.
    const formAction = async (formData: FormData): Promise<void> => {
        await action(formData);
    };

    return (
        <form action={formAction} className="flex w-full flex-col gap-6">
            {/* Header */}
            {(title || subtitle) && (
                <header className="flex flex-col gap-1">
                    {title ? (
                        <h1 className="text-2xl font-semibold text-[var(--st-text)]">{title}</h1>
                    ) : null}
                    {subtitle ? (
                        <p className="text-sm text-[var(--st-text-secondary)]">{subtitle}</p>
                    ) : null}
                </header>
            )}

            {hiddenInputs}

            {/* Sections */}
            <div className="flex flex-col gap-4">
                {sections.map((section) => (
                    <Card key={section.id} className="p-0">
                        <CardHeader>
                            <CardTitle>{section.title}</CardTitle>
                            {section.description ? (
                                <CardDescription>{section.description}</CardDescription>
                            ) : null}
                        </CardHeader>
                        <CardBody>{section.children}</CardBody>
                    </Card>
                ))}
            </div>

            {/* Inline error / success */}
            {error ? (
                <p
                    role="alert"
                    className="text-sm text-[var(--st-danger)]"
                >
                    {error}
                </p>
            ) : null}
            {message ? (
                <p
                    role="status"
                    className="text-sm text-[var(--st-status-ok)]"
                >
                    {message}
                </p>
            ) : null}

            {/* Sticky submit bar */}
            <div className="sticky bottom-0 bg-[var(--st-bg)] border-t border-[var(--st-border)] py-3">
                <div className="flex items-center justify-end gap-2">
                    {cancelHref ? (
                        <Button asChild variant="ghost">
                            <Link href={cancelHref}>Cancel</Link>
                        </Button>
                    ) : null}
                    <SubmitButton label={submitLabel} />
                </div>
            </div>
        </form>
    );
}
