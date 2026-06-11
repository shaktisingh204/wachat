/**
 * SabBigin companies list — the simplified account book.
 *
 * Reuses the existing `getCrmAccounts` server action (same one the full CRM
 * uses). Renders a single name / industry / city table with cheap related
 * counts (contacts + deals) pulled from `getAccountRelatedCounts` for the
 * rows on the current page only. Pagination via `?page=` mirrors the
 * SabBigin contacts page.
 */

import Link from 'next/link';
import { Building2, MapPin, Plus, Users } from 'lucide-react';

import {
    Avatar,
    Badge,
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
import {
    getCrmAccounts,
    getAccountRelatedCounts,
} from '@/app/actions/crm-accounts.actions';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;
const COMPANIES_HREF = '/dashboard/sabbigin/companies';
const NEW_HREF = '/dashboard/sabbigin/companies/new';

interface SearchParams {
    page?: string;
    q?: string;
}

interface PageProps {
    searchParams: Promise<SearchParams>;
}

export default async function SabbiginCompaniesPage({ searchParams }: PageProps) {
    const sp = await searchParams;
    const page = Math.max(1, Number(sp.page) || 1);
    const q = (sp.q ?? '').trim();

    const { accounts, total } = await getCrmAccounts(
        page,
        PAGE_SIZE,
        q || undefined,
    );

    // Cheap related counts for the visible rows only.
    const counts = await Promise.all(
        accounts.map((a) => getAccountRelatedCounts(String(a._id))),
    );

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const hasPrev = page > 1;
    const hasNext = page < totalPages;
    const pageHref = (p: number) => `${COMPANIES_HREF}?page=${p}${q ? `&q=${encodeURIComponent(q)}` : ''}`;

    return (
        <div className="20ui flex w-full flex-col gap-5">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>SabBigin</PageEyebrow>
                    <PageTitle>Companies</PageTitle>
                    <PageDescription>
                        {total.toLocaleString()} compan{total === 1 ? 'y' : 'ies'} in your book.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    {/* Navigation target → Link styled with the 20ui button classes. */}
                    <Link href={NEW_HREF} className="u-btn u-btn--primary u-btn--sm">
                        <Plus size={13} aria-hidden="true" />
                        <span className="u-btn__label">New company</span>
                    </Link>
                </PageActions>
            </PageHeader>

            {accounts.length === 0 ? (
                <Card padding="none" className="flex min-h-[280px] items-center justify-center">
                    <EmptyState
                        icon={Building2}
                        title="No companies yet"
                        description="Add your first company to start tracking accounts and deals."
                        action={
                            <Link href={NEW_HREF} className="u-btn u-btn--primary u-btn--sm">
                                <Plus size={13} aria-hidden="true" />
                                <span className="u-btn__label">New company</span>
                            </Link>
                        }
                    />
                </Card>
            ) : (
                <>
                    <Card padding="none" className="overflow-hidden">
                        <Table density="comfortable" hover>
                            <THead>
                                <Tr>
                                    <Th>Name</Th>
                                    <Th>Industry</Th>
                                    <Th>City</Th>
                                    <Th align="right">Contacts</Th>
                                    <Th align="right">Deals</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {accounts.map((a, i) => {
                                    const id = String(a._id);
                                    const c = counts[i] ?? { contacts: 0, deals: 0 };
                                    return (
                                        <Tr key={id}>
                                            <Td>
                                                <Link
                                                    href={`${COMPANIES_HREF}/${id}`}
                                                    className="-mx-1 flex items-center gap-2.5 rounded-[var(--st-radius-sm)] px-1 py-0.5 font-medium text-[var(--st-text)] transition-colors hover:text-[var(--st-accent)]"
                                                >
                                                    <Avatar name={a.name ?? 'Company'} size="sm" shape="square" />
                                                    <span className="truncate">{a.name ?? 'Company'}</span>
                                                </Link>
                                            </Td>
                                            <Td className="text-[var(--st-text-secondary)]">
                                                {a.industry ? (
                                                    <span className="inline-flex items-center gap-1.5">
                                                        <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                                        {a.industry}
                                                    </span>
                                                ) : (
                                                    '—'
                                                )}
                                            </Td>
                                            <Td className="text-[var(--st-text-secondary)]">
                                                {a.city ? (
                                                    <span className="inline-flex items-center gap-1.5">
                                                        <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                                        {a.city}
                                                    </span>
                                                ) : (
                                                    '—'
                                                )}
                                            </Td>
                                            <Td align="right">
                                                <Badge tone={c.contacts > 0 ? 'info' : 'neutral'}>
                                                    {c.contacts}
                                                </Badge>
                                            </Td>
                                            <Td align="right">
                                                <Badge tone={c.deals > 0 ? 'success' : 'neutral'}>
                                                    {c.deals}
                                                </Badge>
                                            </Td>
                                        </Tr>
                                    );
                                })}
                            </TBody>
                        </Table>
                    </Card>

                    {totalPages > 1 ? (
                        <div className="flex items-center justify-between">
                            <p className="text-[13px] text-[var(--st-text-secondary)]">
                                Page {page} of {totalPages}
                            </p>
                            <div className="flex items-center gap-2">
                                {hasPrev ? (
                                    <Link
                                        href={pageHref(page - 1)}
                                        className="u-btn u-btn--secondary u-btn--sm"
                                    >
                                        <span className="u-btn__label">Previous</span>
                                    </Link>
                                ) : (
                                    <span className="u-btn u-btn--secondary u-btn--sm is-disabled" aria-disabled="true">
                                        <span className="u-btn__label">Previous</span>
                                    </span>
                                )}
                                {hasNext ? (
                                    <Link
                                        href={pageHref(page + 1)}
                                        className="u-btn u-btn--secondary u-btn--sm"
                                    >
                                        <span className="u-btn__label">Next</span>
                                    </Link>
                                ) : (
                                    <span className="u-btn u-btn--secondary u-btn--sm is-disabled" aria-disabled="true">
                                        <span className="u-btn__label">Next</span>
                                    </span>
                                )}
                            </div>
                        </div>
                    ) : null}
                </>
            )}
        </div>
    );
}
