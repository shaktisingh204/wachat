'use client';

import { Megaphone } from 'lucide-react';
import { TelegramPlaceholder } from '../_components/telegram-placeholder';

export default function TelegramAdsPage() {
    return (
        <TelegramPlaceholder
            title="Telegram Ads"
            description="Launch ad campaigns on the Telegram Ad Platform. Programmatic management requires an approved advertiser account."
            icon={Megaphone}
            bullets={[
                'Run sponsored messages in public channels',
                'Target by topic, language, and channel list',
                'Manage campaigns, creatives, and budgets via the Ads API',
                'Requires ads.telegram.org advertiser approval',
            ]}
            docsHref="https://ads.telegram.org"
        />
    );
}
