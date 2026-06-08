/**
 * SabBigin contacts list — simplified vs full CRM contacts.
 *
 * Reuses `getCrmContacts` server action. No custom fields, no segments,
 * no lifecycle filter dropdown. Just name / company / email / phone.
 */

import Link from 'next/link';
import { Building2, Mail, Phone, Plus, Users } from 'lucide-react';

import {
    Avatar,
    Card,
    EmptyState,
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
    PageActions,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
} from '@/components/sabcrm/20ui';
import { getCrmContacts } from '@/app/actions/crm.actions';

import { SabbiginNav } from '../_components/sabbigin-shell';

export const dynamic = 'force-dynamic';

interface SearchParams {
    page?: string;
    q?: string;
}

interface PageProps {
    searchParams: Promise<SearchParams>;
}

export default async function SabbiginContactsPage({ searchParams }: PageProps) {
    const sp = await searchParams;
    const page = Math.max(1, Number(sp.page) || 1);
    const q = (sp.q ?? '').trim();

    const { contacts, total } = await getCrmContacts(page, 25, q || undefined);

    return (
        <div className="20ui flex w-full flex-col gap-5">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>SabBigin</PageEyebrow>
                    <PageTitle>Contacts</PageTitle>
                    <PageDescription>
                        {total.toLocaleString()} contact{total === 1 ? '' : 's'} in your book.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    {/* Button has no asChild/Slot, so render the Link with 20ui button classes. */}
                    <Link
                        href="/dashboard/sabbigin/contacts/new"
                        className="u-btn u-btn--primary u-btn--sm"
                    >
                        <Plus size={13} aria-hidden="true" />
                        <span className="u-btn__label">New contact</span>
                    </Link>
                </PageActions>
            </PageHeader>

            <SabbiginNav active="/dashboard/sabbigin/contacts" />

            {contacts.length === 0 ? (
                <Card padding="none" className="flex min-h-[280px] items-center justify-center">
                    <EmptyState
                        icon={Users}
                        title="No contacts yet"
                        description="Add your first contact to start building your book."
                        action={
                            <Link
                                href="/dashboard/sabbigin/contacts/new"
                                className="u-btn u-btn--primary u-btn--sm"
                            >
                                <Plus size={13} aria-hidden="true" />
                                <span className="u-btn__label">New contact</span>
                            </Link>
                        }
                    />
                </Card>
            ) : (
                <Card padding="none" className="overflow-hidden">
                    <Table density="comfortable" hover>
                        <THead>
                            <Tr>
                                <Th>Name</Th>
                                <Th>Company</Th>
                                <Th>Email</Th>
                                <Th align="right">Phone</Th>
                            </Tr>
                        </THead>
                        <TBody>
                            {contacts.map((c) => {
                                const id = String(c._id);
                                return (
                                    <Tr key={id}>
                                        <Td>
                                            <Link
                                                href={`/dashboard/sabbigin/contacts/${id}`}
                                                className="-mx-1 flex items-center gap-2.5 rounded-[var(--st-radius-sm)] px-1 py-0.5 font-medium text-[var(--st-text)] transition-colors hover:text-[var(--st-accent)]"
                                            >
                                                <Avatar name={c.name ?? 'Contact'} size="sm" shape="round" />
                                                <span className="truncate">{c.name ?? 'Contact'}</span>
                                            </Link>
                                        </Td>
                                        <Td className="text-[var(--st-text-secondary)]">
                                            <span className="inline-flex items-center gap-1.5">
                                                {c.company ? (
                                                    <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                                ) : null}
                                                {c.company ?? 'No company'}
                                            </span>
                                        </Td>
                                        <Td className="text-[var(--st-text-secondary)]">
                                            {c.email ? (
                                                <span className="inline-flex items-center gap-1.5">
                                                    <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                                    {c.email}
                                                </span>
                                            ) : (
                                                '—'
                                            )}
                                        </Td>
                                        <Td align="right" className="tabular-nums text-[var(--st-text-secondary)]">
                                            {c.phone ? (
                                                <span className="inline-flex items-center justify-end gap-1.5">
                                                    <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                                    {c.phone}
                                                </span>
                                            ) : (
                                                '—'
                                            )}
                                        </Td>
                                    </Tr>
                                );
                            })}
                        </TBody>
                    </Table>
                </Card>
            )}
        </div>
    );
}
