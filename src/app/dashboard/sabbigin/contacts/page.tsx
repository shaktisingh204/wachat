/**
 * SabBigin contacts list — simplified vs full CRM contacts.
 *
 * Reuses `getCrmContacts` server action. No custom fields, no segments,
 * no lifecycle filter dropdown — just name / company / email / phone.
 */

import Link from 'next/link';
import { Plus } from 'lucide-react';

import { Button, Card } from '@/components/sabcrm/20ui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
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
        <EntityListShell
            title="Contacts"
            subtitle={`${total.toLocaleString()} contact${total === 1 ? '' : 's'}`}
            primaryAction={
                <Button asChild size="sm">
                    <Link href="/dashboard/sabbigin/contacts/new">
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        New contact
                    </Link>
                </Button>
            }
        >
            <div className="flex flex-col gap-4">
                <SabbiginNav active="/dashboard/sabbigin/contacts" />

                {contacts.length === 0 ? (
                    <Card className="p-6 text-sm text-[var(--st-text-secondary)]">
                        No contacts yet. Click <strong className="text-[var(--st-text)]">New contact</strong> to add your first one.
                    </Card>
                ) : (
                    <Card className="overflow-hidden p-0">
                        <ul className="divide-y divide-[var(--st-border)]">
                            {contacts.map((c) => {
                                const id = String(c._id);
                                return (
                                    <li key={id}>
                                        <Link
                                            href={`/dashboard/sabbigin/contacts/${id}`}
                                            className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--st-bg-muted)]"
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-[var(--st-text)]">{c.name ?? 'Contact'}</p>
                                                <p className="truncate text-xs text-[var(--st-text-secondary)]">
                                                    {c.company ?? '—'} {c.email ? `· ${c.email}` : ''}
                                                </p>
                                            </div>
                                            <p className="shrink-0 text-xs text-[var(--st-text-secondary)]">{c.phone ?? ''}</p>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </Card>
                )}
            </div>
        </EntityListShell>
    );
}
