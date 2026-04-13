'use client';

import { Webhook } from 'lucide-react';
import { TelegramPlaceholder } from '../_components/telegram-placeholder';

export default function TelegramWebhooksPage() {
    return (
        <TelegramPlaceholder
            title="Webhooks"
            description="Configure how Telegram delivers updates to SabNode. Each bot has one webhook plus a secret_token header."
            icon={Webhook}
            bullets={[
                'HTTPS on ports 443, 80, 88, or 8443 — TLS required',
                'secret_token echoed in X-Telegram-Bot-Api-Secret-Token header',
                'allowed_updates filter to reduce bandwidth',
                'Monitor pending updates and last error via getWebhookInfo',
            ]}
            docsHref="https://core.telegram.org/bots/api#setwebhook"
        />
    );
}
