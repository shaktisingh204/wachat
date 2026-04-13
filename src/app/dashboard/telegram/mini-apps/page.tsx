'use client';

import { Package } from 'lucide-react';
import { TelegramPlaceholder } from '../_components/telegram-placeholder';

export default function TelegramMiniAppsPage() {
    return (
        <TelegramPlaceholder
            title="Mini Apps"
            description="Launch HTML/JS WebApps inside Telegram with the Telegram.WebApp bridge and signed initData authentication."
            icon={Package}
            bullets={[
                'Register a Mini App URL via BotFather and install it as the main menu button',
                'Validate initData on the server using HMAC-SHA256 with the bot token',
                'Use Cloud Storage, Biometrics, Haptics, and Theme APIs',
                'Distribute via attach-menu, direct link, or inline button',
            ]}
            docsHref="https://core.telegram.org/bots/webapps"
        />
    );
}
