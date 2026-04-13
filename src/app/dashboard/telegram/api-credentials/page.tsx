'use client';

import { ServerCog } from 'lucide-react';
import { TelegramPlaceholder } from '../_components/telegram-placeholder';

export default function TelegramApiCredentialsPage() {
    return (
        <TelegramPlaceholder
            title="API Credentials"
            description="Manage the tokens and MTProto credentials this workspace uses to talk to Telegram."
            icon={ServerCog}
            bullets={[
                'Bot tokens (rotate, revoke, or mark primary)',
                'MTProto api_id / api_hash from my.telegram.org',
                'Optional local Bot API server endpoint for higher file limits',
                'Gateway API key for SMS/OTP delivery (optional)',
            ]}
            docsHref="https://my.telegram.org"
        />
    );
}
