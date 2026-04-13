'use client';

import { Bot } from 'lucide-react';
import { TelegramPlaceholder } from '../_components/telegram-placeholder';

export default function TelegramBotsPage() {
    return (
        <TelegramPlaceholder
            title="Bots"
            description="Manage every bot connected to this workspace. Each bot is identified by its BotFather token and ties to a single webhook."
            icon={Bot}
            bullets={[
                'Register a new bot by pasting its token from @BotFather',
                'Edit name, description, short description, profile picture',
                'Set menu button, main Mini App URL, and attach-menu status',
                'Rotate tokens and revoke access',
            ]}
            ctaLabel="Add bot"
            ctaHref="/dashboard/telegram/connections"
            docsHref="https://core.telegram.org/bots/features#botfather"
        />
    );
}
