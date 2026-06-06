/**
 * SabBigin contacts list — simplified vs full CRM contacts.
 *
 * Reuses `getCrmContacts` server action. No custom fields, no segments,
 * no lifecycle filter dropdown. Just name / company / email / phone.
 */

import Link from 'next/link';
import { Plus, Users } from 'lucide-react';

import {
    Card,
    EmptyState,
    PageHeader,
    PageHeaderHeading,
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
        <div className="ui20 flex w-full flex-col gap-4">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>Contacts</PageTitle>
                    <PageDescription>
                        {total.toLocaleString()} contact{total === 1 ? '' : 's'}
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

            <div className="flex flex-col gap-4">
                <SabbiginNav active="/dashboard/sabbigin/contacts" />

                {contacts.length === 0 ? (
                    <Card padding="none" className="flex min-h-[240px] items-center justify-center">
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
                                                    className="block truncate font-medium text-[var(--st-text)] hover:underline"
                                                >
                                                    {c.name ?? 'Contact'}
                                                </Link>
                                            </Td>
                                            <Td className="text-[var(--st-text-secondary)]">
                                                {c.company ?? '-'}
                                            </Td>
                                            <Td className="text-[var(--st-text-secondary)]">
                                                {c.email ?? '-'}
                                            </Td>
                                            <Td align="right" className="text-[var(--st-text-secondary)]">
                                                {c.phone ?? '-'}
                                            </Td>
                                        </Tr>
                                    );
                                })}
                            </TBody>
                        </Table>
                    </Card>
                )}
            </div>
        </div>
    );
}
