import { CoaListClient } from './_components/coa-list-client';

/**
 * Chart of Accounts — list landing page.
 *
 * §1D.1 bar:
 *  · KPI strip (5)
 *  · Table columns (10)
 *  · Filters (5)
 *  · View switcher (table / tree)
 *  · Bulk: archive · activate · delete · export
 */
export default function ChartOfAccountsPage() {
    return <CoaListClient />;
}
