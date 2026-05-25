import { Metadata } from 'next';
import { PnlClient } from './client';
import { generateProfitAndLossData } from "@/app/actions/crm-accounting.actions";
import { parseISO, isValid, startOfYear } from 'date-fns';

export const metadata: Metadata = {
    title: 'Profit & Loss | SabNode',
    description: 'An overview of your business profitability.',
};

export default async function PnlPage(
    props: {
        searchParams: Promise<{ [key: string]: string | string[] | undefined }>
    }
) {
    const searchParams = await props.searchParams;

    const fromParam = typeof searchParams.from === 'string' ? searchParams.from : undefined;
    const toParam = typeof searchParams.to === 'string' ? searchParams.to : undefined;

    let startDate = fromParam ? parseISO(fromParam) : startOfYear(new Date());
    let endDate = toParam ? parseISO(toParam) : new Date();

    if (!isValid(startDate)) {
        startDate = startOfYear(new Date());
    }
    if (!isValid(endDate)) {
        endDate = new Date();
    }

    const data = await generateProfitAndLossData(startDate, endDate);

    return (
        <PnlClient 
            initialData={data} 
            initialStartDate={startDate} 
            initialEndDate={endDate} 
        />
    );
}
