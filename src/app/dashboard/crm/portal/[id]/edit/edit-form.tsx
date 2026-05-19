'use client';

/**
 * <PortalEditForm> — deepened edit form per CRM_PAGE_REDESIGN_PLAN
 * §3.3.2.
 *
 * Sectioned cards (no tabs — zoruui has no tab primitive):
 *   1. Identification — name, email, phone, portal type, status
 *   2. Linked entity — customer / vendor / employee picker (type-aware)
 *   3. Role & access — role picker (admin / editor / viewer) plus a
 *      capability checkbox grid; the role serves as the granularity
 *      shorthand, capabilities override on a per-flag basis
 *   4. Branding — logo via SabFiles, brand colour, custom welcome
 *      message
 *   5. Magic-link invite — opens the existing `sendMagicLink` action
 *      via the detail-actions component (footer link)
 *
 * Capabilities are submitted as a JSON array under the existing
 * `capabilities` field name (the action already JSON-parses it).
 */

import * as React from 'react';
import {
    ZoruButton,
    ZoruCard,
    ZoruCardContent,
    ZoruCardHeader,
    ZoruCardTitle,
    ZoruCheckbox,
    ZoruInput,
    ZoruLabel,
    ZoruTextarea,
} from '@/components/zoruui';
import { useActionState, useEffect, useMemo } from 'react';
import { useFormStatus } from 'react-dom';
import { ImageIcon, LoaderCircle, Save, X } from 'lucide-react';
import Link from 'next/link';

import { updatePortalUser } from '@/app/actions/crm-portal.actions';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';
import type { EntityKey } from '@/lib/lookup-registry';

type PortalType = 'customer' | 'vendor' | 'employee';
type PortalRole = 'admin' | 'editor' | 'viewer';
type PortalStatus = 'pending' | 'active' | 'suspended';

interface PortalUser {
    _id?: string;
    name?: string;
    email?: string;
    phone?: string;
    portalType?: PortalType;
    role?: PortalRole;
    status?: PortalStatus;
    linkedEntityId?: string;
    linkedEntityName?: string;
    capabilities?: string[] | string;
    logoFileId?: string;
    logoFileUrl?: string;
    logoFileName?: string;
    brandColor?: string;
    welcomeMessage?: string;
    notes?: string;
}

const ALL_CAPABILITIES: ReadonlyArray<{
    key: string;
    label: string;
    description: string;
    section: 'invoices' | 'tickets' | 'documents' | 'orders';
}> = [
    {
        key: 'view_invoices',
        label: 'View invoices',
        description: 'See open + paid invoices.',
        section: 'invoices',
    },
    {
        key: 'pay_invoices',
        label: 'Pay invoices',
        description: 'Initiate online payments.',
        section: 'invoices',
    },
    {
        key: 'raise_tickets',
        label: 'Raise tickets',
        description: 'Open support tickets.',
        section: 'tickets',
    },
    {
        key: 'reply_tickets',
        label: 'Reply on tickets',
        description: 'Comment on existing tickets.',
        section: 'tickets',
    },
    {
        key: 'view_documents',
        label: 'View documents',
        description: 'Read shared documents.',
        section: 'documents',
    },
    {
        key: 'upload_documents',
        label: 'Upload documents',
        description: 'Add new files to the portal.',
        section: 'documents',
    },
    {
        key: 'view_orders',
        label: 'View orders',
        description: 'See purchase orders and quotes.',
        section: 'orders',
    },
    {
        key: 'approve_orders',
        label: 'Approve orders',
        description: 'Approve open POs / quotes.',
        section: 'orders',
    },
];

const CAPABILITIES_BY_ROLE: Record<PortalRole, ReadonlyArray<string>> = {
    admin: ALL_CAPABILITIES.map((c) => c.key),
    editor: [
        'view_invoices',
        'pay_invoices',
        'raise_tickets',
        'reply_tickets',
        'view_documents',
        'upload_documents',
        'view_orders',
    ],
    viewer: ['view_invoices', 'view_documents', 'view_orders'],
};

const STATUS_OPTIONS: ReadonlyArray<{ value: PortalStatus; label: string }> = [
    { value: 'pending', label: 'Pending invite' },
    { value: 'active', label: 'Active' },
    { value: 'suspended', label: 'Suspended' },
];

const ROLE_OPTIONS: ReadonlyArray<{ value: PortalRole; label: string; description: string }> = [
    { value: 'admin', label: 'Admin', description: 'Full portal access.' },
    { value: 'editor', label: 'Editor', description: 'Read + write on most modules.' },
    { value: 'viewer', label: 'Viewer', description: 'Read-only.' },
];

const PORTAL_TYPES: ReadonlyArray<{ value: PortalType; label: string }> = [
    { value: 'customer', label: 'Customer' },
    { value: 'vendor', label: 'Vendor' },
    { value: 'employee', label: 'Employee' },
];

function linkedEntityForPortalType(portalType: PortalType): EntityKey {
    if (portalType === 'vendor') return 'vendor';
    if (portalType === 'employee') return 'employee';
    return 'client';
}

function normalizeCapabilities(raw: PortalUser['capabilities']): string[] {
    if (Array.isArray(raw)) return raw.filter((c): c is string => typeof c === 'string');
    if (typeof raw === 'string') {
        return raw
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
    }
    return [];
}

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending} className="gap-1">
            {pending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
                <Save className="h-4 w-4" />
            )}
            Save changes
        </ZoruButton>
    );
}

export function PortalEditForm({ user }: { user: PortalUser }) {
    const [state, action] = useActionState(
        updatePortalUser as unknown as (
            prev: { message?: string; error?: string },
            fd: FormData,
        ) => Promise<{ message?: string; error?: string }>,
        { message: '', error: '' },
    );

    const userId = String(user._id ?? '');
    const [portalType, setPortalType] = React.useState<PortalType>(
        (user.portalType as PortalType) ?? 'customer',
    );
    const [role, setRole] = React.useState<PortalRole>(
        (user.role as PortalRole) ?? 'viewer',
    );
    const [status, setStatus] = React.useState<PortalStatus>(
        (user.status as PortalStatus) ?? 'pending',
    );
    const [capabilities, setCapabilities] = React.useState<string[]>(() =>
        normalizeCapabilities(user.capabilities),
    );
    const [logo, setLogo] = React.useState<SabFilePick | null>(
        user.logoFileId
            ? {
                  id: user.logoFileId,
                  url: user.logoFileUrl ?? '',
                  name: user.logoFileName ?? 'logo',
              }
            : null,
    );
    const [brandColor, setBrandColor] = React.useState<string>(
        user.brandColor ?? '#2563eb',
    );

    useEffect(() => {
        if (state?.message) {
            window.location.href = `/dashboard/crm/portal/${userId}`;
        }
    }, [state, userId]);

    function toggleCapability(key: string): void {
        setCapabilities((prev) =>
            prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key],
        );
    }

    function applyRolePreset(next: PortalRole): void {
        setRole(next);
        setCapabilities([...CAPABILITIES_BY_ROLE[next]]);
    }

    const capabilitiesPayload = useMemo(() => JSON.stringify(capabilities), [capabilities]);
    type CapabilityEntry = (typeof ALL_CAPABILITIES)[number];
    const groupedCapabilities = useMemo(() => {
        const groups = new Map<string, CapabilityEntry[]>();
        for (const cap of ALL_CAPABILITIES) {
            const list = groups.get(cap.section) ?? [];
            list.push(cap);
            groups.set(cap.section, list);
        }
        return Array.from(groups.entries());
    }, []);

    return (
        <form action={action} className="space-y-6">
            <input type="hidden" name="id" value={userId} />
            <input type="hidden" name="portalType" value={portalType} />
            <input type="hidden" name="role" value={role} />
            <input type="hidden" name="status" value={status} />
            <input type="hidden" name="capabilities" value={capabilitiesPayload} />
            <input type="hidden" name="brandColor" value={brandColor} />
            <input type="hidden" name="logoFileId" value={logo?.id ?? ''} />
            <input type="hidden" name="logoFileUrl" value={logo?.url ?? ''} />
            <input type="hidden" name="logoFileName" value={logo?.name ?? ''} />

            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>Identification</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <ZoruLabel htmlFor="name">
                                Full name <span className="text-zoru-danger-ink">*</span>
                            </ZoruLabel>
                            <ZoruInput
                                id="name"
                                name="name"
                                defaultValue={user.name ?? ''}
                                required
                                minLength={2}
                            />
                        </div>
                        <div className="space-y-2">
                            <ZoruLabel htmlFor="email">
                                Email <span className="text-zoru-danger-ink">*</span>
                            </ZoruLabel>
                            <ZoruInput
                                id="email"
                                name="email"
                                type="email"
                                defaultValue={user.email ?? ''}
                                required
                                pattern="^[^@\s]+@[^@\s]+\.[^@\s]+$"
                            />
                        </div>
                        <div className="space-y-2">
                            <ZoruLabel htmlFor="phone">Phone</ZoruLabel>
                            <ZoruInput
                                id="phone"
                                name="phone"
                                type="tel"
                                defaultValue={user.phone ?? ''}
                                pattern="^[0-9+\-\s()]{6,20}$"
                            />
                        </div>
                        <div className="space-y-2">
                            <ZoruLabel>Portal type</ZoruLabel>
                            <div className="flex flex-wrap gap-1.5">
                                {PORTAL_TYPES.map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setPortalType(opt.value)}
                                        className={`rounded-md border px-2.5 py-1 text-[12.5px] transition ${
                                            portalType === opt.value
                                                ? 'border-zoru-primary bg-zoru-primary/10 text-zoru-primary'
                                                : 'border-zoru-line bg-zoru-bg text-zoru-ink hover:bg-zoru-surface-2'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <ZoruLabel>Status</ZoruLabel>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value as PortalStatus)}
                                className="h-10 w-full rounded-lg border border-zoru-line bg-zoru-bg px-3 text-[13px] text-zoru-ink"
                            >
                                {STATUS_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </ZoruCardContent>
            </ZoruCard>

            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>
                        Linked{' '}
                        {portalType === 'vendor'
                            ? 'vendor'
                            : portalType === 'employee'
                              ? 'employee'
                              : 'customer'}
                    </ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <div className="space-y-2">
                        <ZoruLabel>
                            Pick the {portalType} record this portal user maps to.
                        </ZoruLabel>
                        <EntityFormField
                            entity={linkedEntityForPortalType(portalType)}
                            name="linkedEntityId"
                            dualWriteName="linkedEntityName"
                            initialId={user.linkedEntityId ?? null}
                            initialLabel={user.linkedEntityName ?? ''}
                            placeholder={`Select ${portalType}…`}
                        />
                    </div>
                </ZoruCardContent>
            </ZoruCard>

            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>Role & access</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <div className="space-y-3">
                        <div className="grid gap-2 md:grid-cols-3">
                            {ROLE_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => applyRolePreset(opt.value)}
                                    className={`rounded-lg border p-3 text-left transition ${
                                        role === opt.value
                                            ? 'border-zoru-primary bg-zoru-primary/5'
                                            : 'border-zoru-line bg-zoru-bg hover:bg-zoru-surface-2'
                                    }`}
                                >
                                    <div className="text-[13px] font-medium text-zoru-ink">
                                        {opt.label}
                                    </div>
                                    <div className="mt-0.5 text-[11.5px] text-zoru-ink-muted">
                                        {opt.description}
                                    </div>
                                </button>
                            ))}
                        </div>
                        <div className="rounded-lg border border-zoru-line bg-zoru-bg p-3">
                            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                                Capabilities
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                                {groupedCapabilities.map(([section, caps]) => (
                                    <div key={section} className="space-y-1.5">
                                        <div className="text-[11px] font-medium capitalize text-zoru-ink-muted">
                                            {section}
                                        </div>
                                        {caps.map((cap) => {
                                            const checked = capabilities.includes(cap.key);
                                            return (
                                                <label
                                                    key={cap.key}
                                                    className="flex cursor-pointer items-start gap-2 rounded px-1 py-0.5 hover:bg-zoru-surface-2"
                                                >
                                                    <ZoruCheckbox
                                                        checked={checked}
                                                        onCheckedChange={() =>
                                                            toggleCapability(cap.key)
                                                        }
                                                        aria-label={cap.label}
                                                    />
                                                    <div className="text-[12.5px]">
                                                        <div className="text-zoru-ink">
                                                            {cap.label}
                                                        </div>
                                                        <div className="text-[11px] text-zoru-ink-muted">
                                                            {cap.description}
                                                        </div>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </ZoruCardContent>
            </ZoruCard>

            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>Branding</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <div className="grid gap-4 md:grid-cols-[1fr_220px]">
                        <div className="space-y-3">
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="brandColor">Brand colour</ZoruLabel>
                                <div className="flex items-center gap-2">
                                    <input
                                        id="brandColor"
                                        type="color"
                                        value={brandColor}
                                        onChange={(e) => setBrandColor(e.target.value)}
                                        className="h-9 w-12 cursor-pointer rounded border border-zoru-line bg-transparent"
                                        aria-label="Brand colour"
                                    />
                                    <ZoruInput
                                        value={brandColor}
                                        onChange={(e) => setBrandColor(e.target.value)}
                                        pattern="^#[0-9a-fA-F]{6}$"
                                        maxLength={7}
                                        className="w-32"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="welcomeMessage">Welcome message</ZoruLabel>
                                <ZoruTextarea
                                    id="welcomeMessage"
                                    name="welcomeMessage"
                                    defaultValue={user.welcomeMessage ?? ''}
                                    rows={3}
                                    placeholder="Shown after the portal user signs in for the first time."
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <ZoruLabel>Logo</ZoruLabel>
                            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-zoru-line bg-zoru-surface-2/40">
                                {logo?.url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={logo.url}
                                        alt={logo.name}
                                        className="max-h-28 max-w-[200px] object-contain"
                                    />
                                ) : (
                                    <ImageIcon className="h-8 w-8 text-zoru-ink-muted" />
                                )}
                            </div>
                            <div className="flex items-center gap-1">
                                <SabFilePickerButton
                                    accept="image"
                                    onPick={(pick) => setLogo(pick)}
                                >
                                    {logo ? 'Replace' : 'Upload logo'}
                                </SabFilePickerButton>
                                {logo ? (
                                    <button
                                        type="button"
                                        onClick={() => setLogo(null)}
                                        aria-label="Remove logo"
                                        className="rounded p-1.5 text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-danger-ink"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </ZoruCardContent>
            </ZoruCard>

            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>Internal notes</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <ZoruTextarea
                        id="notes"
                        name="notes"
                        defaultValue={user.notes ?? ''}
                        rows={3}
                        placeholder="Internal notes about this portal user."
                    />
                </ZoruCardContent>
            </ZoruCard>

            <div className="sticky bottom-0 z-10 -mx-2 flex flex-wrap items-center justify-between gap-2 border-t border-zoru-line bg-zoru-bg px-2 py-3">
                <div className="text-sm">
                    {state?.error ? (
                        <span className="text-zoru-danger-ink">{state.error}</span>
                    ) : state?.message ? (
                        <span className="text-zoru-success-ink">{state.message}</span>
                    ) : null}
                </div>
                <div className="flex items-center gap-2">
                    <ZoruButton variant="outline" asChild>
                        <Link href={`/dashboard/crm/portal/${userId}`}>Cancel</Link>
                    </ZoruButton>
                    <SubmitButton />
                </div>
            </div>
        </form>
    );
}
