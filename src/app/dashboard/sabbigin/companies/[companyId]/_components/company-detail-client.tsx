'use client';

/**
 * SabBigin company detail (client island).
 *
 * - Header: logo (SabFiles image) or initials Avatar + name + quick facts.
 * - Inline edit: an "Edit" toggle reveals the editable fields; saving posts
 *   through the existing `updateCrmAccount` server action (useActionState-
 *   shaped, reads `accountId` + text fields).
 * - Related counts: StatCards from `getAccountRelatedCounts`.
 * - Tabs: Overview / Contacts / Deals / Files. Contacts & Deals are teaching
 *   EmptyStates (the dedicated record surfaces own the lists); Files uses
 *   SabFiles attachments persisted via `updateCompanyAttachments`.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
    Building2,
    Briefcase,
    FileText,
    Globe,
    Handshake,
    MapPin,
    Paperclip,
    Pencil,
    Phone,
    Save,
    Trash2,
    Users,
    X,
} from 'lucide-react';

import {
    Avatar,
    Badge,
    Button,
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    EmptyState,
    Field,
    Input,
    SelectField,
    StatCard,
    TabsBar,
    toast,
    type TabItem,
} from '@/components/sabcrm/20ui';
import { SabFilePickerButton } from '@/components/sabfiles';
import { updateCrmAccount } from '@/app/actions/crm-accounts.actions';
import { updateCompanyAttachments } from '@/app/actions/sabbigin-companies.actions';
import { formatCurrency } from '@/components/sabbigin/lib/format';

export interface CompanyDetail {
    _id: string;
    name: string;
    industry: string;
    website: string;
    phone: string;
    address: string;
    city: string;
    country: string;
    gstin: string;
    pan: string;
    annualRevenue: number | null;
    employeeCount: number | null;
    currency: string;
    category: string;
    logoUrl: string;
    attachments: string[];
    status: 'active' | 'archived';
}

interface RelatedCounts {
    contacts: number;
    deals: number;
    invoices: number;
    quotations: number;
    tickets: number;
    tasks: number;
}

const CATEGORY_OPTIONS = [
    { value: 'new', label: 'New' },
    { value: 'regular', label: 'Regular' },
    { value: 'key', label: 'Key account' },
    { value: 'strategic', label: 'Strategic' },
];

const CURRENCY_OPTIONS = [
    { value: 'INR', label: 'INR — Indian Rupee' },
    { value: 'USD', label: 'USD — US Dollar' },
    { value: 'EUR', label: 'EUR — Euro' },
    { value: 'GBP', label: 'GBP — British Pound' },
    { value: 'AED', label: 'AED — UAE Dirham' },
];

const TABS: TabItem[] = [
    { value: 'overview', label: 'Overview', icon: Building2 },
    { value: 'contacts', label: 'Contacts', icon: Users },
    { value: 'deals', label: 'Deals', icon: Handshake },
    { value: 'files', label: 'Files', icon: Paperclip },
];

function fileName(url: string): string {
    try {
        const u = new URL(url);
        const last = u.pathname.split('/').filter(Boolean).pop();
        return last ? decodeURIComponent(last) : url;
    } catch {
        const last = url.split('/').filter(Boolean).pop();
        return last ?? url;
    }
}

export function CompanyDetailClient({
    initial,
    counts,
}: {
    initial: CompanyDetail;
    counts: RelatedCounts;
}) {
    const router = useRouter();
    const [tab, setTab] = React.useState('overview');
    const [editing, setEditing] = React.useState(false);
    const [pending, startTransition] = React.useTransition();

    const [company, setCompany] = React.useState<CompanyDetail>(initial);

    // Editable draft (only while editing).
    const [draft, setDraft] = React.useState<CompanyDetail>(initial);
    const [category, setCategory] = React.useState<string | null>(initial.category || null);
    const [currency, setCurrency] = React.useState<string | null>(initial.currency || 'INR');

    const [attachments, setAttachments] = React.useState<string[]>(initial.attachments);
    const [savingFiles, setSavingFiles] = React.useState(false);

    function beginEdit() {
        setDraft(company);
        setCategory(company.category || null);
        setCurrency(company.currency || 'INR');
        setEditing(true);
    }

    function cancelEdit() {
        setEditing(false);
    }

    function handleSave(formData: FormData) {
        formData.set('accountId', company._id);
        formData.set('category', category ?? '');
        formData.set('currency', currency ?? 'INR');
        startTransition(async () => {
            const r = await updateCrmAccount(null, formData);
            if (r.error) {
                toast.error({ title: 'Could not save', description: r.error });
                return;
            }
            // Optimistically reflect the saved draft.
            setCompany({
                ...draft,
                category: category ?? '',
                currency: currency ?? 'INR',
            });
            setEditing(false);
            toast.success({ title: 'Company updated' });
            router.refresh();
        });
    }

    async function persistAttachments(next: string[]) {
        setSavingFiles(true);
        const r = await updateCompanyAttachments(company._id, next);
        setSavingFiles(false);
        if (!r.ok) {
            toast.error({ title: 'Could not save files', description: r.error });
            return;
        }
        setAttachments(r.attachments ?? next);
        toast.success({ title: 'Files updated' });
        router.refresh();
    }

    function addAttachment(url: string) {
        if (!url || attachments.includes(url)) return;
        void persistAttachments([...attachments, url]);
    }

    function removeAttachment(url: string) {
        void persistAttachments(attachments.filter((u) => u !== url));
    }

    return (
        <div className="flex flex-col gap-5">
            {/* Header card */}
            <Card>
                <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                        {company.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={company.logoUrl}
                                alt={`${company.name} logo`}
                                className="h-14 w-14 shrink-0 rounded-[var(--st-radius-md)] object-cover"
                            />
                        ) : (
                            <Avatar name={company.name || 'Company'} size="lg" shape="square" />
                        )}
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-semibold text-[var(--st-text)]">
                                    {company.name || 'Company'}
                                </h2>
                                <Badge tone={company.status === 'archived' ? 'neutral' : 'success'}>
                                    {company.status === 'archived' ? 'Archived' : 'Active'}
                                </Badge>
                            </div>
                            <p className="text-[13px] text-[var(--st-text-secondary)]">
                                {[company.industry, company.city, company.country]
                                    .filter(Boolean)
                                    .join(' · ') || 'No details yet'}
                            </p>
                        </div>
                    </div>
                    {!editing ? (
                        <Button variant="secondary" size="md" iconLeft={Pencil} onClick={beginEdit}>
                            Edit
                        </Button>
                    ) : null}
                </CardBody>
            </Card>

            {/* Related counts */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <StatCard label="Contacts" value={counts.contacts} icon={Users} />
                <StatCard label="Deals" value={counts.deals} icon={Handshake} />
                <StatCard label="Invoices" value={counts.invoices} icon={FileText} />
                <StatCard label="Quotations" value={counts.quotations} icon={FileText} />
                <StatCard label="Tickets" value={counts.tickets} icon={Briefcase} />
                <StatCard label="Tasks" value={counts.tasks} icon={Briefcase} />
            </div>

            <TabsBar items={TABS} value={tab} onChange={setTab} />

            {tab === 'overview' ? (
                editing ? (
                    <form action={handleSave}>
                        <Card>
                            <CardHeader>
                                <CardTitle>Edit company</CardTitle>
                            </CardHeader>
                            <CardBody className="flex flex-col gap-4">
                                <Field label="Company name" required>
                                    <Input
                                        name="name"
                                        defaultValue={draft.name}
                                        iconLeft={Building2}
                                        required
                                    />
                                </Field>

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <Field label="Industry">
                                        <Input name="industry" defaultValue={draft.industry} />
                                    </Field>
                                    <Field label="Website">
                                        <Input name="website" defaultValue={draft.website} iconLeft={Globe} />
                                    </Field>
                                </div>

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <Field label="Phone">
                                        <Input name="phone" defaultValue={draft.phone} iconLeft={Phone} />
                                    </Field>
                                    <Field label="City">
                                        <Input name="city" defaultValue={draft.city} iconLeft={MapPin} />
                                    </Field>
                                </div>

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <Field label="Country">
                                        <Input name="country" defaultValue={draft.country} />
                                    </Field>
                                    <Field label="Address">
                                        <Input name="address" defaultValue={draft.address} />
                                    </Field>
                                </div>

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <Field label="GSTIN">
                                        <Input name="gstin" defaultValue={draft.gstin} />
                                    </Field>
                                    <Field label="PAN">
                                        <Input name="pan" defaultValue={draft.pan} />
                                    </Field>
                                </div>

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <Field label="Annual revenue">
                                        <Input
                                            name="annualRevenue"
                                            type="number"
                                            min={0}
                                            defaultValue={draft.annualRevenue ?? ''}
                                        />
                                    </Field>
                                    <Field label="Employees">
                                        <Input
                                            name="employeeCount"
                                            type="number"
                                            min={0}
                                            defaultValue={draft.employeeCount ?? ''}
                                        />
                                    </Field>
                                </div>

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <Field label="Category">
                                        <SelectField
                                            value={category}
                                            onChange={setCategory}
                                            options={CATEGORY_OPTIONS}
                                            placeholder="Select category"
                                            aria-label="Category"
                                        />
                                    </Field>
                                    <Field label="Currency">
                                        <SelectField
                                            value={currency}
                                            onChange={setCurrency}
                                            options={CURRENCY_OPTIONS}
                                            placeholder="Select currency"
                                            aria-label="Currency"
                                        />
                                    </Field>
                                </div>
                            </CardBody>
                            <CardBody className="flex items-center justify-end gap-2 border-t border-[var(--st-border)]">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="md"
                                    iconLeft={X}
                                    onClick={cancelEdit}
                                    disabled={pending}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="md"
                                    iconLeft={Save}
                                    loading={pending}
                                >
                                    Save changes
                                </Button>
                            </CardBody>
                        </Card>
                    </form>
                ) : (
                    <Card>
                        <CardHeader>
                            <CardTitle>Overview</CardTitle>
                        </CardHeader>
                        <CardBody>
                            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                                <DetailRow label="Industry" value={company.industry} />
                                <DetailRow label="Website" value={company.website} />
                                <DetailRow label="Phone" value={company.phone} />
                                <DetailRow label="City" value={company.city} />
                                <DetailRow label="Country" value={company.country} />
                                <DetailRow label="Address" value={company.address} />
                                <DetailRow label="GSTIN" value={company.gstin} />
                                <DetailRow label="PAN" value={company.pan} />
                                <DetailRow
                                    label="Annual revenue"
                                    value={
                                        company.annualRevenue != null
                                            ? formatCurrency(company.annualRevenue, company.currency || 'INR')
                                            : ''
                                    }
                                />
                                <DetailRow
                                    label="Employees"
                                    value={company.employeeCount != null ? String(company.employeeCount) : ''}
                                />
                                <DetailRow
                                    label="Category"
                                    value={
                                        CATEGORY_OPTIONS.find((o) => o.value === company.category)?.label ??
                                        company.category
                                    }
                                />
                                <DetailRow label="Currency" value={company.currency} />
                            </dl>
                        </CardBody>
                    </Card>
                )
            ) : null}

            {tab === 'contacts' ? (
                <Card padding="none" className="flex min-h-[240px] items-center justify-center">
                    <EmptyState
                        icon={Users}
                        title={counts.contacts > 0 ? `${counts.contacts} linked contact${counts.contacts === 1 ? '' : 's'}` : 'No contacts linked'}
                        description="Manage this company's people from the Contacts surface."
                        action={
                            <a href="/dashboard/sabbigin/contacts" className="u-btn u-btn--primary u-btn--sm">
                                <Users size={13} aria-hidden="true" />
                                <span className="u-btn__label">Open contacts</span>
                            </a>
                        }
                    />
                </Card>
            ) : null}

            {tab === 'deals' ? (
                <Card padding="none" className="flex min-h-[240px] items-center justify-center">
                    <EmptyState
                        icon={Handshake}
                        title={counts.deals > 0 ? `${counts.deals} linked deal${counts.deals === 1 ? '' : 's'}` : 'No deals linked'}
                        description="Track this company's pipeline from the Deals board."
                        action={
                            <a href="/dashboard/sabbigin/deals" className="u-btn u-btn--primary u-btn--sm">
                                <Handshake size={13} aria-hidden="true" />
                                <span className="u-btn__label">Open deals</span>
                            </a>
                        }
                    />
                </Card>
            ) : null}

            {tab === 'files' ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Files</CardTitle>
                    </CardHeader>
                    <CardBody className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <p className="text-[13px] text-[var(--st-text-secondary)]">
                                {attachments.length} file{attachments.length === 1 ? '' : 's'} attached
                            </p>
                            <SabFilePickerButton
                                variant="outline"
                                onPick={(pick) => addAttachment(pick.url)}
                            >
                                <Paperclip size={13} aria-hidden="true" />
                                Attach from SabFiles
                            </SabFilePickerButton>
                        </div>

                        {attachments.length === 0 ? (
                            <EmptyState
                                icon={Paperclip}
                                title="No files yet"
                                description="Attach contracts, brochures or any document from your SabFiles library."
                            />
                        ) : (
                            <ul className="flex flex-col divide-y divide-[var(--st-border)]">
                                {attachments.map((url) => (
                                    <li key={url} className="flex items-center justify-between gap-3 py-2.5">
                                        <a
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex min-w-0 items-center gap-2.5 text-[13px] text-[var(--st-text)] hover:text-[var(--st-accent)]"
                                        >
                                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
                                                <FileText className="h-4 w-4" aria-hidden="true" />
                                            </span>
                                            <span className="truncate">{fileName(url)}</span>
                                        </a>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            iconLeft={Trash2}
                                            onClick={() => removeAttachment(url)}
                                            disabled={savingFiles}
                                            aria-label={`Remove ${fileName(url)}`}
                                        >
                                            Remove
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardBody>
                </Card>
            ) : null}
        </div>
    );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
    return (
        <div className="flex flex-col gap-0.5">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
                {label}
            </dt>
            <dd className="text-[14px] text-[var(--st-text)]">
                {value && value.trim() !== '' ? value : <span className="text-[var(--st-text-secondary)]">—</span>}
            </dd>
        </div>
    );
}
