import { getPartyTransactionsDeepKpis } from '@/app/actions/crm-inventory.actions';
import PartyTransactionsDeepClient from './client-page';

export const metadata = {
    title: 'Party Transactions | SabNode',
};

export default async function PartyTransactionsDeepPage() {
    // Fetch initial aggregate KPIs on the server
    const initialKpis = await getPartyTransactionsDeepKpis();

    return <PartyTransactionsDeepClient initialKpis={initialKpis} />;
}
