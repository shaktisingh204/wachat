'use server';

export async function getConversionsAnalytics(dateRange: string) {
    // Simulate complex data aggregation delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Mock data based on date range
    let multiplier = 1;
    if (dateRange === '30d') multiplier = 2.5;
    if (dateRange === '90d') multiplier = 5.2;

    return {
        funnel: [
            { id: 'leads', label: 'Total Leads', value: Math.floor(1000 * multiplier), color: '#3b82f6' },
            { id: 'quotes', label: 'Quotations Sent', value: Math.floor(600 * multiplier), color: '#8b5cf6' },
            { id: 'so', label: 'Sales Orders', value: Math.floor(400 * multiplier), color: '#ec4899' },
            { id: 'invoices', label: 'Invoices Paid', value: Math.floor(250 * multiplier), color: '#10b981' },
        ],
        abTesting: [
            { variant: 'A (Standard Email)', conversionRate: 12.5, lift: 0 },
            { variant: 'B (Personalized Video)', conversionRate: 18.2, lift: 45.6 },
        ],
        channels: [
            { name: 'Organic Search', value: Math.floor(300 * multiplier), fill: '#3b82f6' },
            { name: 'Direct', value: Math.floor(200 * multiplier), fill: '#10b981' },
            { name: 'Social Media', value: Math.floor(150 * multiplier), fill: '#f59e0b' },
            { name: 'Paid Ads', value: Math.floor(100 * multiplier), fill: '#ef4444' },
        ]
    };
}
