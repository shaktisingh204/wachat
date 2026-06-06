'use client';

import { Badge, Card, CardBody, CardHeader, CardTitle } from '@/components/sabcrm/20ui';
/**
 * Body cards for the contact detail page (extracted to keep
 * `[contactId]/page.tsx` under the 600-line scope cap).
 *
 * Pure presentation — `<ContactDetailBody>` renders Overview · Address ·
 * Social · Notes · Attachments · Tags · Custom-fields cards from a
 * single hydrated contact and a small `formatStatusLabel` helper.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import type { CrmContact } from '@/lib/definitions';
import type { WithId } from 'mongodb';

interface ContactDetailBodyProps {
    contact: WithId<CrmContact>;
    contactId: string;
    formatStatusLabel: (s: string | undefined) => string;
}

export function ContactDetailBody({
    contact,
    contactId,
    formatStatusLabel,
}: ContactDetailBodyProps) {
    const anyContact = contact as unknown as Record<string, unknown>;
    const status = (contact.status as string) || 'new_lead';
    const extraNotes =
        typeof anyContact.notesText === 'string'
            ? (anyContact.notesText as string)
            : '';

    return (
        <>
            {/* ─── Overview ───────────────────────────────────────── */}
            <Card>
                <CardHeader>
                    <CardTitle>Overview</CardTitle>
                </CardHeader>
                <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Name" value={contact.name} />
                    <Field
                        label="Email"
                        value={
                            contact.email ? (
                                <a
                                    className="hover:underline"
                                    href={`mailto:${contact.email}`}
                                >
                                    {contact.email}
                                </a>
                            ) : (
                                '—'
                            )
                        }
                    />
                    <Field
                        label="Phone"
                        value={
                            contact.phone ? (
                                <a
                                    className="hover:underline"
                                    href={`tel:${contact.phone}`}
                                >
                                    {contact.phone}
                                </a>
                            ) : (
                                '—'
                            )
                        }
                    />
                    <Field
                        label="Mobile"
                        value={
                            (anyContact.mobile as string | undefined) ?? '—'
                        }
                    />
                    <Field label="Company" value={contact.company || '—'} />
                    <Field
                        label="Job title"
                        value={
                            contact.jobTitle ? (
                                <EntityPickerChip
                                    entity="jobTitle"
                                    id={contact.jobTitle}
                                    fallback={contact.jobTitle}
                                />
                            ) : (
                                '—'
                            )
                        }
                    />
                    <Field
                        label="Source"
                        value={
                            contact.leadSource ?? contact.source ? (
                                <Badge variant="secondary">
                                    {contact.leadSource ?? contact.source}
                                </Badge>
                            ) : (
                                '—'
                            )
                        }
                    />
                    <Field label="Timezone" value={contact.timezone || '—'} />
                    <Field
                        label="Date of birth"
                        value={
                            contact.dateOfBirth
                                ? new Date(
                                      contact.dateOfBirth,
                                  ).toLocaleDateString()
                                : '—'
                        }
                    />
                    <Field
                        label="Status"
                        value={
                            <StatusPill
                                label={formatStatusLabel(status)}
                                tone={statusToTone(status)}
                            />
                        }
                    />
                </CardBody>
            </Card>

            {/* ─── Address ────────────────────────────────────────── */}
            <Card>
                <CardHeader>
                    <CardTitle>Address</CardTitle>
                </CardHeader>
                <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Field
                        label="Country"
                        value={
                            (anyContact.country as string | undefined) ?? '—'
                        }
                    />
                    <Field
                        label="State"
                        value={(anyContact.state as string | undefined) ?? '—'}
                    />
                    <Field
                        label="City"
                        value={(anyContact.city as string | undefined) ?? '—'}
                    />
                </CardBody>
            </Card>

            {/* ─── Social ─────────────────────────────────────────── */}
            <Card>
                <CardHeader>
                    <CardTitle>Social</CardTitle>
                </CardHeader>
                <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Field
                        label="LinkedIn"
                        value={
                            contact.linkedinUrl ? (
                                <a
                                    className="hover:underline"
                                    href={contact.linkedinUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {contact.linkedinUrl}
                                </a>
                            ) : (
                                '—'
                            )
                        }
                    />
                    <Field
                        label="Twitter / X"
                        value={contact.twitterHandle || '—'}
                    />
                    <Field
                        label="Website"
                        value={
                            (anyContact.website as string | undefined) ? (
                                <a
                                    className="hover:underline"
                                    href={anyContact.website as string}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {anyContact.website as string}
                                </a>
                            ) : (
                                '—'
                            )
                        }
                    />
                </CardBody>
            </Card>

            {/* ─── Notes ──────────────────────────────────────────── */}
            <Card>
                <CardHeader>
                    <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardBody className="space-y-3">
                    {Array.isArray(contact.notes) && contact.notes.length > 0 ? (
                        <ol className="flex flex-col gap-3">
                            {contact.notes.map((n, i) => (
                                <li
                                    key={i}
                                    className="rounded-md border border-[var(--st-border)] p-3"
                                >
                                    <p className="text-[12.5px] text-[var(--st-text-secondary)]">
                                        {n.author} ·{' '}
                                        {n.createdAt
                                            ? new Date(
                                                  n.createdAt,
                                              ).toLocaleString()
                                            : ''}
                                    </p>
                                    <p className="mt-1 whitespace-pre-line text-sm text-[var(--st-text)]">
                                        {n.content}
                                    </p>
                                </li>
                            ))}
                        </ol>
                    ) : extraNotes ? (
                        <p className="whitespace-pre-line text-sm text-[var(--st-text)]">
                            {extraNotes}
                        </p>
                    ) : (
                        <p className="text-sm text-[var(--st-text-secondary)]">
                            No notes yet. Use{' '}
                            <Link
                                className="underline"
                                href={`/dashboard/crm/sales-crm/contacts/${contactId}/edit`}
                            >
                                Edit
                            </Link>{' '}
                            to add one.
                        </p>
                    )}
                    {/* TODO 1D.2: inline note composer + per-note edit/delete deferred —
                        the existing `addCrmContactNote` action covers append-only;
                        a dedicated composer dialog ships in a follow-up batch. */}
                </CardBody>
            </Card>

            {/* ─── Attachments ───────────────────────────────────── */}
            <Card>
                <CardHeader>
                    <CardTitle>Attachments</CardTitle>
                </CardHeader>
                <CardBody>
                    <p className="text-sm text-[var(--st-text-secondary)]">
                        No attachments yet.
                    </p>
                    {/* TODO 1D.2: inline SabFile picker + per-attachment preview deferred —
                        requires a `contact.attachments[]` field on CrmContact which
                        isn't part of the current type. Linkable via custom-fields once
                        the per-tenant schema ships. */}
                </CardBody>
            </Card>

            {/* ─── Tags ──────────────────────────────────────────── */}
            <Card>
                <CardHeader>
                    <CardTitle>Tags</CardTitle>
                </CardHeader>
                <CardBody>
                    {Array.isArray(contact.tags) && contact.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                            {contact.tags.map((t) => (
                                <Badge key={t} variant="secondary">
                                    {t}
                                </Badge>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-[var(--st-text-secondary)]">
                            No tags yet.
                        </p>
                    )}
                </CardBody>
            </Card>

            {/* ─── Custom fields ─────────────────────────────────── */}
            <Card>
                <CardHeader>
                    <CardTitle>Custom fields</CardTitle>
                </CardHeader>
                <CardBody>
                    <p className="text-sm text-[var(--st-text-secondary)]">
                        No custom fields configured for contacts.
                    </p>
                    {/* TODO 1D.2: render per-tenant custom fields from
                        `applyCustomFieldsToEntity('contact', …)` once the
                        read-side helper ships. */}
                </CardBody>
            </Card>
        </>
    );
}

function Field({
    label,
    value,
}: {
    label: string;
    value: React.ReactNode;
}) {
    return (
        <div className="space-y-0.5">
            <p className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                {label}
            </p>
            <div className="text-sm text-[var(--st-text)]">{value}</div>
        </div>
    );
}

export default ContactDetailBody;
