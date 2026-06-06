'use client';

import { Card, CardBody, CardDescription, CardHeader, CardTitle, DatePicker, Input, Label, Textarea } from '@/components/sabcrm/20ui/compat';
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
        <Card className="p-0">
            <CardHeader>
                <CardTitle>Personal</CardTitle>
                <CardDescription>
                    Identity, role, and locale. Required fields marked with *.
                </CardDescription>
            </CardHeader>
            <CardBody className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="firstName">First name *</Label>
                    <Input
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
                    <Label htmlFor="lastName">Last name</Label>
                    <Input
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
                    <Label htmlFor="salutation">Salutation</Label>
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
                    <Label htmlFor="displayName">Display name</Label>
                    <Input
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
                    <Label htmlFor="jobTitleField">Job title</Label>
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
                    <Label htmlFor="email">Email *</Label>
                    <Input
                        id="email"
                        name="email"
                        type="email"
                        required
                        defaultValue={initial?.email ?? prefillEmail ?? ''}
                        placeholder="priya@example.com"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                        id="phone"
                        name="phone"
                        defaultValue={initial?.phone ?? prefillPhone ?? ''}
                        placeholder="+91 98765 43210"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="mobile">Mobile</Label>
                    <Input
                        id="mobile"
                        name="mobile"
                        defaultValue={anyInitial?.mobile ?? ''}
                        placeholder="+91 90000 00000"
                    />
                </div>
                <div className="space-y-2">
                    <Label>Date of birth</Label>
                    <DatePicker
                        value={dob}
                        onChange={(d) => {
                            setDob(d);
                            onDirty();
                        }}
                        placeholder="Pick a date…"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="timezoneField">Timezone</Label>
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
                    <Label htmlFor="language">Language</Label>
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
            </CardBody>
        </Card>
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
        <Card className="p-0">
            <CardHeader>
                <CardTitle>Linked</CardTitle>
                <CardDescription>
                    Account, owner, lifecycle and lead source.
                </CardDescription>
            </CardHeader>
            <CardBody className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="accountField">Account</Label>
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
                    <Label htmlFor="ownerField">Owner</Label>
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
                    <Label>Status</Label>
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
                    <Label>Lifecycle stage</Label>
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
                    <Label htmlFor="leadSourceField">Lead source</Label>
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
                    <Label htmlFor="sourceText">Source detail</Label>
                    <Input
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
                    <Label htmlFor="company">Company (free text)</Label>
                    <Input
                        id="company"
                        name="company"
                        defaultValue={initial?.company ?? prefillCompany ?? ''}
                        placeholder="Used if no account is linked"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="leadScore">Lead score</Label>
                    <Input
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
            </CardBody>
        </Card>
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
        <Card className="p-0">
            <CardHeader>
                <CardTitle>Address</CardTitle>
                <CardDescription>
                    Geography cascade: country → state → city.
                </CardDescription>
            </CardHeader>
            <CardBody className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
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
                    <Label htmlFor="state">State</Label>
                    <EntityFormField
                        entity="state"
                        name="state"
                        initialId={stateVal || null}
                        filter={country ? { countryCode: country } : undefined}
                        disabled={!country}
                        onChange={(next) => {
                            setStateVal(next ?? '');
                            setCity('');
                            onDirty();
                        }}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <EntityFormField
                        entity="city"
                        name="city"
                        initialId={city || null}
                        filter={
                            country
                                ? {
                                      countryCode: country,
                                      ...(stateVal
                                          ? { stateCode: stateVal.includes(':') ? stateVal.split(':')[1] : stateVal }
                                          : {}),
                                  }
                                : undefined
                        }
                        disabled={!country}
                        onChange={(next) => {
                            setCity(next ?? '');
                            onDirty();
                        }}
                    />
                </div>
            </CardBody>
        </Card>
    );
}

/* ─── Social + Notes ────────────────────────────────────────────────── */

interface SocialSectionProps extends BaseSectionProps {}

export function SocialSection({ initial }: SocialSectionProps) {
    const anyInitial = initial as unknown as Record<string, string | undefined>;
    return (
        <Card className="p-0">
            <CardHeader>
                <CardTitle>Social</CardTitle>
                <CardDescription>
                    LinkedIn, X/Twitter and personal website.
                </CardDescription>
            </CardHeader>
            <CardBody className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="linkedinUrl">LinkedIn URL</Label>
                    <Input
                        id="linkedinUrl"
                        name="linkedinUrl"
                        type="url"
                        defaultValue={initial?.linkedinUrl ?? ''}
                        placeholder="https://linkedin.com/in/…"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="twitterHandle">Twitter / X handle</Label>
                    <Input
                        id="twitterHandle"
                        name="twitterHandle"
                        defaultValue={initial?.twitterHandle ?? ''}
                        placeholder="@handle"
                    />
                </div>
                <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="website">Website</Label>
                    <Input
                        id="website"
                        name="website"
                        type="url"
                        defaultValue={anyInitial?.website ?? ''}
                        placeholder="https://example.com"
                    />
                </div>
            </CardBody>
        </Card>
    );
}

export function NotesTagsSection({ initial }: BaseSectionProps) {
    const anyInitial = initial as unknown as Record<string, string | undefined>;
    return (
        <Card className="p-0">
            <CardHeader>
                <CardTitle>Notes &amp; tags</CardTitle>
                <CardDescription>
                    Free-form context and labels for filtering.
                </CardDescription>
            </CardHeader>
            <CardBody className="grid gap-4">
                <div className="space-y-2">
                    <Label htmlFor="tags">Tags</Label>
                    <Input
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
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
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
            </CardBody>
        </Card>
    );
}
