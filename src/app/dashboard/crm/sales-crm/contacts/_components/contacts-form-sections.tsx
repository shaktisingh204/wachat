'use client';

/**
 * Field-section sub-components for <ContactForm>, extracted to keep
 * `contacts-form.tsx` under the 600-line scope cap.
 *
 * Each section is a controlled fragment that receives the relevant
 * piece of form state from the parent. The hidden inputs that carry
 * the actual FormData keys (status, source, lifecycleStage, owner,
 * accountId, jobTitle, timezone) live in the parent so we don't
 * have to thread them through every section.
 */

import * as React from 'react';

import {
    ZoruCard,
    ZoruCardContent,
    ZoruCardDescription,
    ZoruCardHeader,
    ZoruCardTitle,
    ZoruDatePicker,
    ZoruInput,
    ZoruLabel,
    ZoruTextarea,
} from '@/components/zoruui';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';
import type { CrmContact } from '@/lib/definitions';
import type { WithId } from 'mongodb';

// Status / lifecycle catalogues moved to `crm-enums.ts` (contactStatus,
// lifecycleStage). The picker UX is unchanged.

interface BaseSectionProps {
    initial?: WithId<CrmContact> | null;
    onDirty: () => void;
}

/* ─── Personal ──────────────────────────────────────────────────────── */

interface PersonalSectionProps extends BaseSectionProps {
    firstName: string;
    setFirstName: (v: string) => void;
    lastName: string;
    setLastName: (v: string) => void;
    salutation: string;
    setSalutation: (v: string) => void;
    displayName: string;
    setDisplayName: (v: string) => void;
    jobTitle: string;
    setJobTitle: (v: string) => void;
    timezone: string;
    setTimezone: (v: string) => void;
    language: string;
    setLanguage: (v: string) => void;
    dob: Date | undefined;
    setDob: (d: Date | undefined) => void;
    prefillEmail?: string;
    prefillPhone?: string;
}

export function PersonalSection({
    initial,
    onDirty,
    firstName,
    setFirstName,
    lastName,
    setLastName,
    salutation,
    setSalutation,
    displayName,
    setDisplayName,
    jobTitle,
    setJobTitle,
    timezone,
    setTimezone,
    language,
    setLanguage,
    dob,
    setDob,
    prefillEmail,
    prefillPhone,
}: PersonalSectionProps) {
    const anyInitial = initial as unknown as Record<string, string | undefined>;
    return (
        <ZoruCard className="p-0">
            <ZoruCardHeader>
                <ZoruCardTitle>Personal</ZoruCardTitle>
                <ZoruCardDescription>
                    Identity, role, and locale. Required fields marked with *.
                </ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <ZoruLabel htmlFor="firstName">First name *</ZoruLabel>
                    <ZoruInput
                        id="firstName"
                        value={firstName}
                        onChange={(e) => {
                            setFirstName(e.target.value);
                            onDirty();
                        }}
                        placeholder="Priya"
                        required
                    />
                </div>
                <div className="space-y-2">
                    <ZoruLabel htmlFor="lastName">Last name</ZoruLabel>
                    <ZoruInput
                        id="lastName"
                        value={lastName}
                        onChange={(e) => {
                            setLastName(e.target.value);
                            onDirty();
                        }}
                        placeholder="Sharma"
                    />
                </div>
                <div className="space-y-2">
                    <ZoruLabel htmlFor="salutation">Salutation</ZoruLabel>
                    <EntityFormField
                        entity="salutation"
                        name="salutation"
                        initialId={salutation || null}
                        placeholder="Mr / Ms / Dr…"
                        onChange={(next) => {
                            setSalutation(next ?? '');
                            onDirty();
                        }}
                    />
                </div>
                <div className="space-y-2">
                    <ZoruLabel htmlFor="displayName">Display name</ZoruLabel>
                    <ZoruInput
                        id="displayName"
                        value={displayName}
                        onChange={(e) => {
                            setDisplayName(e.target.value);
                            onDirty();
                        }}
                        placeholder="Override how this contact is shown"
                    />
                </div>
                <div className="space-y-2">
                    <ZoruLabel htmlFor="jobTitleField">Job title</ZoruLabel>
                    <EntityFormField
                        entity="jobTitle"
                        name="jobTitleField"
                        initialId={jobTitle || null}
                        placeholder="VP Sales"
                        onChange={(next) => {
                            setJobTitle(next ?? '');
                            onDirty();
                        }}
                    />
                </div>
                <div className="space-y-2">
                    <ZoruLabel htmlFor="email">Email *</ZoruLabel>
                    <ZoruInput
                        id="email"
                        name="email"
                        type="email"
                        required
                        defaultValue={initial?.email ?? prefillEmail ?? ''}
                        placeholder="priya@example.com"
                    />
                </div>
                <div className="space-y-2">
                    <ZoruLabel htmlFor="phone">Phone</ZoruLabel>
                    <ZoruInput
                        id="phone"
                        name="phone"
                        defaultValue={initial?.phone ?? prefillPhone ?? ''}
                        placeholder="+91 98765 43210"
                    />
                </div>
                <div className="space-y-2">
                    <ZoruLabel htmlFor="mobile">Mobile</ZoruLabel>
                    <ZoruInput
                        id="mobile"
                        name="mobile"
                        defaultValue={anyInitial?.mobile ?? ''}
                        placeholder="+91 90000 00000"
                    />
                </div>
                <div className="space-y-2">
                    <ZoruLabel>Date of birth</ZoruLabel>
                    <ZoruDatePicker
                        value={dob}
                        onChange={(d) => {
                            setDob(d);
                            onDirty();
                        }}
                        placeholder="Pick a date…"
                    />
                </div>
                <div className="space-y-2">
                    <ZoruLabel htmlFor="timezoneField">Timezone</ZoruLabel>
                    <EntityFormField
                        entity="timezone"
                        name="timezoneField"
                        initialId={timezone || null}
                        placeholder="Asia/Kolkata"
                        onChange={(next) => {
                            setTimezone(next ?? '');
                            onDirty();
                        }}
                    />
                </div>
                <div className="space-y-2">
                    <ZoruLabel htmlFor="language">Language</ZoruLabel>
                    <EntityFormField
                        entity="language"
                        name="language"
                        initialId={language || null}
                        placeholder="English"
                        onChange={(next) => {
                            setLanguage(next ?? '');
                            onDirty();
                        }}
                    />
                </div>
            </ZoruCardContent>
        </ZoruCard>
    );
}

/* ─── Linked ────────────────────────────────────────────────────────── */

interface LinkedSectionProps extends BaseSectionProps {
    accountId: string;
    setAccountId: (v: string) => void;
    owner: string;
    setOwner: (v: string) => void;
    status: string;
    setStatus: (v: string) => void;
    lifecycle: string;
    setLifecycle: (v: string) => void;
    leadSource: string;
    setLeadSource: (v: string) => void;
    source: string;
    setSource: (v: string) => void;
    prefillCompany?: string;
}

export function LinkedSection({
    initial,
    onDirty,
    accountId,
    setAccountId,
    owner,
    setOwner,
    status,
    setStatus,
    lifecycle,
    setLifecycle,
    leadSource,
    setLeadSource,
    source,
    setSource,
    prefillCompany,
}: LinkedSectionProps) {
    return (
        <ZoruCard className="p-0">
            <ZoruCardHeader>
                <ZoruCardTitle>Linked</ZoruCardTitle>
                <ZoruCardDescription>
                    Account, owner, lifecycle and lead source.
                </ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <ZoruLabel htmlFor="accountField">Account</ZoruLabel>
                    <EntityFormField
                        entity="client"
                        name="accountField"
                        initialId={accountId || null}
                        placeholder="Select account…"
                        onChange={(next) => {
                            setAccountId(next ?? '');
                            onDirty();
                        }}
                    />
                </div>
                <div className="space-y-2">
                    <ZoruLabel htmlFor="ownerField">Owner</ZoruLabel>
                    <EntityFormField
                        entity="user"
                        name="ownerField"
                        initialId={owner || null}
                        placeholder="Unassigned"
                        onChange={(next) => {
                            setOwner(next ?? '');
                            onDirty();
                        }}
                    />
                </div>
                <div className="space-y-2">
                    <ZoruLabel>Status</ZoruLabel>
                    <EnumFormField
                        enumName="contactStatus"
                        name="status"
                        initialId={status}
                        onChange={(v) => {
                            setStatus(v ?? '');
                            onDirty();
                        }}
                    />
                </div>
                <div className="space-y-2">
                    <ZoruLabel>Lifecycle stage</ZoruLabel>
                    <EnumFormField
                        enumName="lifecycleStage"
                        name="lifecycleStage"
                        initialId={lifecycle || null}
                        placeholder="Select stage"
                        onChange={(v) => {
                            setLifecycle(v ?? '');
                            onDirty();
                        }}
                    />
                </div>
                <div className="space-y-2">
                    <ZoruLabel htmlFor="leadSourceField">Lead source</ZoruLabel>
                    <EntityFormField
                        entity="leadSource"
                        name="leadSourceField"
                        initialId={leadSource || null}
                        placeholder="Select source…"
                        onChange={(next) => {
                            setLeadSource(next ?? '');
                            onDirty();
                        }}
                    />
                </div>
                <div className="space-y-2">
                    <ZoruLabel htmlFor="sourceText">Source detail</ZoruLabel>
                    <ZoruInput
                        id="sourceText"
                        value={source}
                        onChange={(e) => {
                            setSource(e.target.value);
                            onDirty();
                        }}
                        placeholder="referral / website / event…"
                    />
                </div>
                <div className="space-y-2">
                    <ZoruLabel htmlFor="company">Company (free text)</ZoruLabel>
                    <ZoruInput
                        id="company"
                        name="company"
                        defaultValue={initial?.company ?? prefillCompany ?? ''}
                        placeholder="Used if no account is linked"
                    />
                </div>
                <div className="space-y-2">
                    <ZoruLabel htmlFor="leadScore">Lead score</ZoruLabel>
                    <ZoruInput
                        id="leadScore"
                        name="leadScore"
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        defaultValue={initial?.leadScore ?? 0}
                        placeholder="0–100"
                    />
                </div>
            </ZoruCardContent>
        </ZoruCard>
    );
}

/* ─── Address ───────────────────────────────────────────────────────── */

interface AddressSectionProps extends BaseSectionProps {
    country: string;
    setCountry: (v: string) => void;
    stateVal: string;
    setStateVal: (v: string) => void;
    city: string;
    setCity: (v: string) => void;
}

export function AddressSection({
    onDirty,
    country,
    setCountry,
    stateVal,
    setStateVal,
    city,
    setCity,
}: AddressSectionProps) {
    return (
        <ZoruCard className="p-0">
            <ZoruCardHeader>
                <ZoruCardTitle>Address</ZoruCardTitle>
                <ZoruCardDescription>
                    Geography cascade: country → state → city.
                </ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                    <ZoruLabel htmlFor="country">Country</ZoruLabel>
                    <EntityFormField
                        entity="country"
                        name="country"
                        initialId={country || 'India'}
                        onChange={(next) => {
                            setCountry(next ?? '');
                            setStateVal('');
                            setCity('');
                            onDirty();
                        }}
                    />
                </div>
                <div className="space-y-2">
                    <ZoruLabel htmlFor="state">State</ZoruLabel>
                    <EntityFormField
                        entity="state"
                        name="state"
                        initialId={stateVal || null}
                        filter={country ? { country } : undefined}
                        disabled={!country}
                        onChange={(next) => {
                            setStateVal(next ?? '');
                            setCity('');
                            onDirty();
                        }}
                    />
                </div>
                <div className="space-y-2">
                    <ZoruLabel htmlFor="city">City</ZoruLabel>
                    <EntityFormField
                        entity="city"
                        name="city"
                        initialId={city || null}
                        filter={
                            stateVal
                                ? { state: stateVal }
                                : country
                                  ? { country }
                                  : undefined
                        }
                        disabled={!country}
                        onChange={(next) => {
                            setCity(next ?? '');
                            onDirty();
                        }}
                    />
                </div>
            </ZoruCardContent>
        </ZoruCard>
    );
}

/* ─── Social + Notes ────────────────────────────────────────────────── */

interface SocialSectionProps extends BaseSectionProps {}

export function SocialSection({ initial }: SocialSectionProps) {
    const anyInitial = initial as unknown as Record<string, string | undefined>;
    return (
        <ZoruCard className="p-0">
            <ZoruCardHeader>
                <ZoruCardTitle>Social</ZoruCardTitle>
                <ZoruCardDescription>
                    LinkedIn, X/Twitter and personal website.
                </ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <ZoruLabel htmlFor="linkedinUrl">LinkedIn URL</ZoruLabel>
                    <ZoruInput
                        id="linkedinUrl"
                        name="linkedinUrl"
                        type="url"
                        defaultValue={initial?.linkedinUrl ?? ''}
                        placeholder="https://linkedin.com/in/…"
                    />
                </div>
                <div className="space-y-2">
                    <ZoruLabel htmlFor="twitterHandle">Twitter / X handle</ZoruLabel>
                    <ZoruInput
                        id="twitterHandle"
                        name="twitterHandle"
                        defaultValue={initial?.twitterHandle ?? ''}
                        placeholder="@handle"
                    />
                </div>
                <div className="space-y-2 md:col-span-2">
                    <ZoruLabel htmlFor="website">Website</ZoruLabel>
                    <ZoruInput
                        id="website"
                        name="website"
                        type="url"
                        defaultValue={anyInitial?.website ?? ''}
                        placeholder="https://example.com"
                    />
                </div>
            </ZoruCardContent>
        </ZoruCard>
    );
}

export function NotesTagsSection({ initial }: BaseSectionProps) {
    const anyInitial = initial as unknown as Record<string, string | undefined>;
    return (
        <ZoruCard className="p-0">
            <ZoruCardHeader>
                <ZoruCardTitle>Notes &amp; tags</ZoruCardTitle>
                <ZoruCardDescription>
                    Free-form context and labels for filtering.
                </ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent className="grid gap-4">
                <div className="space-y-2">
                    <ZoruLabel htmlFor="tags">Tags</ZoruLabel>
                    <ZoruInput
                        id="tags"
                        name="tags"
                        defaultValue={
                            Array.isArray(initial?.tags)
                                ? initial?.tags.join(', ')
                                : ''
                        }
                        placeholder="Comma-separated tags"
                    />
                </div>
                <div className="space-y-2">
                    <ZoruLabel htmlFor="notes">Notes</ZoruLabel>
                    <ZoruTextarea
                        id="notes"
                        name="notes"
                        rows={4}
                        defaultValue={anyInitial?.notes ?? ''}
                        placeholder="Anything noteworthy about this contact…"
                    />
                    {/* TODO 1D.2: full chronological notes timeline deferred —
                        CrmContact.notes uses a typed array shape; the
                        inline composer here writes free text only. */}
                </div>
            </ZoruCardContent>
        </ZoruCard>
    );
}
