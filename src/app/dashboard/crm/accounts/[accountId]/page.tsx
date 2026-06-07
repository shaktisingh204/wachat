import { Button, Card, CardBody, CardHeader, CardTitle, Badge } from '@/components/sabcrm/20ui';
import {
  notFound } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import {
    Banknote,
  Building,
  CheckSquare,
  FileText,
  Globe,
  Handshake,
  LifeBuoy,
  Mail,
  MapPin,
  Phone as PhoneIcon,
  Receipt,
  Users,
  } from 'lucide-react';

/**
 * Account detail page — `/dashboard/crm/accounts/[accountId]` (§1D.2).
 *
 * Server Component. Hydrates the account, its first 5 contacts, and a
 * Promise.all of related-entity counts (deals, invoices, quotations,
 * tickets, tasks) so the right rail renders without client round-trips.
 * Interactive bits (action buttons, archive confirm, compose email)
 * live in `<AccountDetailInteractions>` — a small client island.
 *
 * Layout:
 *   • Header: status pill · eyebrow · title · back · 9-button action group
 *   • Main column: Profile · Contacts (first 5 + link) · Notes · Attachments
 *   • Right rail: Quick stats · Related entities (counts) · Identifiers
 *   • Footer: <EntityAuditTimeline />
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { StatusPill } from '@/components/crm/status-pill';
import { CrmNotes } from '@/components/20ui-domain/crm-notes';

import {
    getAccountRelatedCounts,
    getCrmAccountById,
} from '@/app/actions/crm-accounts.actions';
import { getCrmContacts } from '@/app/actions/crm.actions';
import { getAccountScore, getAccountOrgChart } from '../actions';

import { AccountDetailInteractions } from '../_components/accounts-detail-interactions';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ accountId: string }>;
}

function categoryTone(
    category: string | undefined,
): 'green' | 'amber' | 'blue' | 'neutral' {
    switch (category) {
        case 'strategic':
            return 'green';
        case 'key':
            return 'amber';
        case 'new':
            return 'blue';
        default:
            return 'neutral';
    }
}

function dash(v: string | number | null | undefined): React.ReactNode {
    if (v === null || v === undefined || v === '') {
        return <span className="text-[var(--st-text-secondary)]">—</span>;
    }
    return v;
}

export default async function AccountDetailPage({ params }: PageProps) {
    const { accountId } = await params;
    const account = await getCrmAccountById(accountId);
    if (!account) notFound();

    const [contactsRes, counts, scoreData, orgChart] = await Promise.all([
        getCrmContacts(1, 5, undefined, accountId),
        getAccountRelatedCounts(accountId),
        getAccountScore(accountId),
        getAccountOrgChart(accountId)
    ]);

    const archived = account.status === 'archived';
    const statusTone: 'green' | 'neutral' = archived ? 'neutral' : 'green';
    const statusLabel = archived ? 'Archived' : 'Active';

    const contactEmails = (contactsRes.contacts ?? [])
        .map((c) => c.email)
        .filter((e): e is string => !!e);

    const relatedRailItems: {
        label: string;
        count: number;
        icon: React.ReactNode;
        href: string;
    }[] = [
        {
            label: 'Contacts',
            count: counts.contacts,
            icon: <Users className="h-4 w-4" />,
            href: `/dashboard/crm/sales-crm/contacts?accountId=${accountId}`,
        },
        {
            label: 'Deals',
            count: counts.deals,
            icon: <Handshake className="h-4 w-4" />,
            href: `/dashboard/crm/sales-crm/deals?accountId=${accountId}`,
        },
        {
            label: 'Invoices',
            count: counts.invoices,
            icon: <Receipt className="h-4 w-4" />,
            href: `/dashboard/crm/sales/invoices?accountId=${accountId}`,
        },
        {
            label: 'Quotations',
            count: counts.quotations,
            icon: <FileText className="h-4 w-4" />,
            href: `/dashboard/crm/sales/quotations?accountId=${accountId}`,
        },
        {
            label: 'Tickets',
            count: counts.tickets,
            icon: <LifeBuoy className="h-4 w-4" />,
            href: `/dashboard/sabdesk?accountId=${accountId}`,
        },
        {
            label: 'Tasks',
            count: counts.tasks,
            icon: <CheckSquare className="h-4 w-4" />,
            href: `/dashboard/crm/sales-crm/tasks?accountId=${accountId}`,
        },
    ];

    return (
        <EntityDetailShell
            title={account.name}
            eyebrow="ACCOUNT"
            status={{ label: statusLabel, tone: statusTone }}
            back={{ href: '/dashboard/crm/accounts', label: 'All accounts' }}
            actions={
                <AccountDetailInteractions
                    accountId={String(account._id)}
                    name={account.name}
                    industry={account.industry}
                    website={account.website}
                    phone={account.phone}
                    country={account.country}
                    state={account.state}
                    city={account.city}
                    currency={account.currency}
                    category={account.category}
                    archived={archived}
                    contactEmails={contactEmails}
                />
            }
            rightRail={
                <>
                    {/* ─── Health & Scoring ─── */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Account Score</CardTitle>
                        </CardHeader>
                        <CardBody className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-text)]/10 text-xl font-bold text-[var(--st-text)]">
                                    {scoreData.score}
                                </div>
                                <div className="flex flex-col text-[12px] text-[var(--st-text-secondary)]">
                                    <span>{scoreData.interactionsCount} interactions</span>
                                    <span>${scoreData.totalDealValue.toLocaleString()} in open deals</span>
                                </div>
                            </div>
                        </CardBody>
                    </Card>

                    {/* ─── Quick stats ─── */}
                    <Card>
                        <CardHeader>
                            <CardTitle>At a glance</CardTitle>
                        </CardHeader>
                        <CardBody className="space-y-3 text-[13px]">
                            <div className="flex justify-between">
                                <span className="text-[var(--st-text-secondary)]">
                                    Category
                                </span>
                                <span>
                                    {account.category ? (
                                        <StatusPill
                                            label={account.category}
                                            tone={categoryTone(account.category)}
                                        />
                                    ) : (
                                        dash(undefined)
                                    )}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[var(--st-text-secondary)]">
                                    Currency
                                </span>
                                <span>{dash(account.currency)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[var(--st-text-secondary)]">
                                    Payment terms
                                </span>
                                <span>{dash(account.paymentTerms)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[var(--st-text-secondary)]">
                                    Annual revenue
                                </span>
                                <span>
                                    {account.annualRevenue
                                        ? account.annualRevenue.toLocaleString()
                                        : dash(undefined)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[var(--st-text-secondary)]">
                                    Employees
                                </span>
                                <span>{dash(account.employeeCount)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[var(--st-text-secondary)]">
                                    Created
                                </span>
                                <span
                                    suppressHydrationWarning
                                    title={
                                        account.createdAt
                                            ? new Date(
                                                  account.createdAt,
                                              ).toLocaleString()
                                            : ''
                                    }
                                >
                                    {account.createdAt
                                        ? formatDistanceToNow(
                                              new Date(account.createdAt),
                                              { addSuffix: true },
                                          )
                                        : dash(undefined)}
                                </span>
                            </div>
                        </CardBody>
                    </Card>

                    {/* ─── Related entities ─── */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Related</CardTitle>
                        </CardHeader>
                        <CardBody className="space-y-1">
                            {relatedRailItems.map((item) => (
                                <Link
                                    key={item.label}
                                    href={item.href}
                                    className="flex items-center justify-between rounded-md px-2 py-1.5 text-[13px] text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]"
                                >
                                    <span className="inline-flex items-center gap-2 text-[var(--st-text-secondary)]">
                                        {item.icon}
                                        {item.label}
                                    </span>
                                    <Badge variant="secondary">
                                        {item.count}
                                    </Badge>
                                </Link>
                            ))}
                        </CardBody>
                    </Card>

                    {/* ─── Identifiers ─── */}
                    {(account.gstin || account.pan) ? (
                        <Card>
                            <CardHeader>
                                <CardTitle>Identifiers</CardTitle>
                            </CardHeader>
                            <CardBody className="space-y-3 text-[13px]">
                                <div className="flex justify-between">
                                    <span className="text-[var(--st-text-secondary)]">
                                        GSTIN
                                    </span>
                                    <span className="font-mono">
                                        {dash(account.gstin)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-[var(--st-text-secondary)]">
                                        PAN
                                    </span>
                                    <span className="font-mono">
                                        {dash(account.pan)}
                                    </span>
                                </div>
                            </CardBody>
                        </Card>
                    ) : null}
                </>
            }
            audit={
                <EntityAuditTimeline
                    entityKind="account"
                    entityId={accountId}
                />
            }
        >
            {/* ─── Profile ─── */}
            <Card>
                <CardHeader>
                    <CardTitle>Profile</CardTitle>
                </CardHeader>
                <CardBody>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="flex items-center gap-3 text-[13px]">
                            <Building className="h-4 w-4 text-[var(--st-text-secondary)]" />
                            <div className="flex flex-col">
                                <span className="text-[var(--st-text-secondary)] text-[11.5px] uppercase tracking-wide">
                                    Industry
                                </span>
                                <span>{dash(account.industry)}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 text-[13px]">
                            <Globe className="h-4 w-4 text-[var(--st-text-secondary)]" />
                            <div className="flex flex-col">
                                <span className="text-[var(--st-text-secondary)] text-[11.5px] uppercase tracking-wide">
                                    Website
                                </span>
                                {account.website ? (
                                    <a
                                        href={account.website}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[var(--st-text)] hover:underline"
                                    >
                                        {account.website}
                                    </a>
                                ) : (
                                    <span>{dash(undefined)}</span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-3 text-[13px]">
                            <PhoneIcon className="h-4 w-4 text-[var(--st-text-secondary)]" />
                            <div className="flex flex-col">
                                <span className="text-[var(--st-text-secondary)] text-[11.5px] uppercase tracking-wide">
                                    Phone
                                </span>
                                {account.phone ? (
                                    <a
                                        href={`tel:${account.phone}`}
                                        className="hover:underline"
                                    >
                                        {account.phone}
                                    </a>
                                ) : (
                                    <span>{dash(undefined)}</span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-3 text-[13px]">
                            <MapPin className="h-4 w-4 text-[var(--st-text-secondary)]" />
                            <div className="flex flex-col">
                                <span className="text-[var(--st-text-secondary)] text-[11.5px] uppercase tracking-wide">
                                    Location
                                </span>
                                <span>
                                    {dash(
                                        [
                                            account.city,
                                            account.state,
                                            account.country,
                                        ]
                                            .filter(Boolean)
                                            .join(', '),
                                    )}
                                </span>
                            </div>
                        </div>
                        {account.address ? (
                            <div className="flex items-start gap-3 text-[13px] md:col-span-2">
                                <MapPin className="mt-0.5 h-4 w-4 text-[var(--st-text-secondary)]" />
                                <div className="flex flex-col">
                                    <span className="text-[var(--st-text-secondary)] text-[11.5px] uppercase tracking-wide">
                                        Registered address
                                    </span>
                                    <span className="whitespace-pre-line">
                                        {account.address}
                                    </span>
                                </div>
                            </div>
                        ) : null}
                        {account.billingAddress ? (
                            <div className="flex items-start gap-3 text-[13px] md:col-span-2">
                                <Banknote className="mt-0.5 h-4 w-4 text-[var(--st-text-secondary)]" />
                                <div className="flex flex-col">
                                    <span className="text-[var(--st-text-secondary)] text-[11.5px] uppercase tracking-wide">
                                        Billing address
                                    </span>
                                    <span className="whitespace-pre-line">
                                        {account.billingAddress}
                                    </span>
                                </div>
                            </div>
                        ) : null}
                        {account.shippingAddress ? (
                            <div className="flex items-start gap-3 text-[13px] md:col-span-2">
                                <MapPin className="mt-0.5 h-4 w-4 text-[var(--st-text-secondary)]" />
                                <div className="flex flex-col">
                                    <span className="text-[var(--st-text-secondary)] text-[11.5px] uppercase tracking-wide">
                                        Shipping address
                                    </span>
                                    <span className="whitespace-pre-line">
                                        {account.shippingAddress}
                                    </span>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </CardBody>
            </Card>

            {/* ─── Contacts ─── */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>
                            Contacts ({counts.contacts})
                        </CardTitle>
                        <Button asChild variant="outline" size="sm">
                            <Link
                                href={`/dashboard/crm/sales-crm/contacts/new?accountId=${accountId}`}
                            >
                                + Add contact
                            </Link>
                        </Button>
                    </div>
                </CardHeader>
                <CardBody>
                    {contactsRes.contacts.length > 0 ? (
                        <ul className="divide-y divide-[var(--st-border)]">
                            {contactsRes.contacts.map((c) => (
                                <li
                                    key={String(c._id)}
                                    className="flex items-center justify-between py-2"
                                >
                                    <div className="min-w-0">
                                        <Link
                                            href={`/dashboard/crm/sales-crm/contacts/${String(c._id)}`}
                                            className="text-[13px] font-medium text-[var(--st-text)] hover:underline"
                                        >
                                            {c.name}
                                        </Link>
                                        <div className="truncate text-[12px] text-[var(--st-text-secondary)]">
                                            {c.email}
                                            {c.jobTitle ? ` · ${c.jobTitle}` : ''}
                                        </div>
                                    </div>
                                    {c.email ? (
                                        <a
                                            href={`mailto:${c.email}`}
                                            className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
                                            aria-label={`Email ${c.name}`}
                                        >
                                            <Mail className="h-4 w-4" />
                                        </a>
                                    ) : null}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-[13px] text-[var(--st-text-secondary)]">
                            No contacts yet. Add the people who buy from,
                            influence, or champion this account.
                        </p>
                    )}
                    {counts.contacts > contactsRes.contacts.length ? (
                        <div className="mt-3">
                            <Link
                                href={`/dashboard/crm/sales-crm/contacts?accountId=${accountId}`}
                                className="text-[12.5px] text-[var(--st-text)] hover:underline"
                            >
                                View all {counts.contacts} contacts →
                            </Link>
                        </div>
                    ) : null}
                </CardBody>
            </Card>

            {/* ─── Org Chart ─── */}
            {orgChart && orgChart.length > 0 ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Organization Chart</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <div className="flex flex-wrap items-stretch gap-4 pt-2">
                            {orgChart.map((c: any) => (
                                <div key={String(c._id)} className="flex min-w-[220px] flex-col items-center rounded-xl border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4 text-center shadow-sm transition-all hover:shadow-md">
                                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-text)]/10 text-lg font-bold text-[var(--st-text)]">
                                        {c.name.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="text-[14px] font-semibold text-[var(--st-text)]">{c.name}</span>
                                    {c.jobTitle && <span className="mt-1 text-[12px] font-medium text-[var(--st-text-secondary)]">{c.jobTitle}</span>}
                                    {c.email && (
                                        <div className="mt-2 flex items-center gap-1 text-[11px] text-[var(--st-text-secondary)]">
                                            <Mail className="h-3 w-3" />
                                            <span>{c.email}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardBody>
                </Card>
            ) : null}

            {/* ─── Notes ─── */}
            <CrmNotes
                recordId={String(account._id)}
                recordType="account"
                notes={account.notes ?? []}
            />

            {/* ─── Attachments ─── */}
            {Array.isArray(account.attachments) &&
            account.attachments.length > 0 ? (
                <Card>
                    <CardHeader>
                        <CardTitle>
                            Attachments ({account.attachments.length})
                        </CardTitle>
                    </CardHeader>
                    <CardBody>
                        <ul className="space-y-2">
                            {account.attachments.map((url, idx) => (
                                <li key={url + idx} className="text-[13px]">
                                    <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[var(--st-text)] hover:underline"
                                    >
                                        {url.split('/').pop() ?? url}
                                    </a>
                                </li>
                            ))}
                        </ul>
                        {/* TODO 1D.2: inline add via <SabFilePickerButton> when
                            an `addAccountAttachment` action lands. */}
                    </CardBody>
                </Card>
            ) : null}
        </EntityDetailShell>
    );
}
