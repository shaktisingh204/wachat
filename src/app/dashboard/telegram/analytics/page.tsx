'use client';

import { BarChart } from 'lucide-react';
import { TelegramPlaceholder } from '../_components/telegram-placeholder';

export default function TelegramAnalyticsPage() {
    return (
        <TelegramPlaceholder
            title="Analytics"
            description="Message volume, delivery, conversion, and revenue metrics across every connected bot and channel."
            icon={BarChart}
            bullets={[
                'Inbound vs outbound message volume',
                'Command completion, flow conversion, and drop-off funnels',
                'Channel post reach and subscriber growth',
                'Stars revenue, ARPU, and refund rate',
            ]}
        />
    );
}
