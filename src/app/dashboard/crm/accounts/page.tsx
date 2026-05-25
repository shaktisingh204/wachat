import * as React from 'react';
import { getCrmAccounts, getCrmAccountKpis } from '@/app/actions/crm-accounts.actions';
import { AccountsListClient } from './_components/accounts-list-client';
import type { AccountStatusFilter, AccountCategoryFilter } from './_components/accounts-filters';

const ACCOUNTS_PER_PAGE = 20;

export default async function CrmAccountsPage(props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const searchParams = await props.searchParams;
    const page = Number(searchParams.page) || 1;
    const search = typeof searchParams.search === 'string' ? searchParams.search : '';
    const statusFilter = (typeof searchParams.status === 'string' ? searchParams.status : 'active') as AccountStatusFilter;
    const categoryFilter = (typeof searchParams.category === 'string' ? searchParams.category : 'all') as AccountCategoryFilter;
    const industryFilter = typeof searchParams.industry === 'string' ? searchParams.industry : '';
    const countryFilter = typeof searchParams.country === 'string' ? searchParams.country : '';
    const currencyFilter = typeof searchParams.currency === 'string' ? searchParams.currency : '';
    const fromDate = typeof searchParams.fromDate === 'string' ? searchParams.fromDate : undefined;
    const toDate = typeof searchParams.toDate === 'string' ? searchParams.toDate : undefined;

    const apiStatus: 'active' | 'archived' | 'all' =
        statusFilter === 'archived' ? 'archived' : statusFilter === 'all' ? 'all' : 'active';

    const [pageRes, kpiRes] = await Promise.all([
        getCrmAccounts(page, ACCOUNTS_PER_PAGE, search || undefined, apiStatus, {
            category: categoryFilter,
            industry: industryFilter,
            country: countryFilter,
            currency: currencyFilter,
            fromDate: fromDate ? new Date(fromDate) : undefined,
            toDate: toDate ? new Date(toDate) : undefined,
        }),
        getCrmAccountKpis(),
    ]);

    const params = {
        page,
        search,
        statusFilter,
        categoryFilter,
        industryFilter,
        countryFilter,
        currencyFilter,
        fromDate,
        toDate,
    };

    return (
        <AccountsListClient
            accounts={pageRes.accounts}
            total={pageRes.total}
            kpis={{
                total: kpiRes.total,
                active: kpiRes.active,
                archived: kpiRes.archived,
                strategic: kpiRes.strategic,
                key: kpiRes.key,
                totalArr: kpiRes.totalArr ?? 0,
                topIndustries: kpiRes.topIndustries ?? [],
            }}
            params={params}
        />
    );
}
