'use client';

import { Settings } from 'lucide-react';
import { TelegramPlaceholder } from '../_components/telegram-placeholder';

export default function TelegramSettingsPage() {
    return (
        <TelegramPlaceholder
            title="Settings"
            description="Workspace-level Telegram preferences — default language, business hours, agent defaults, and data retention."
            icon={Settings}
            bullets={[
                'Default bot and fallback routing',
                'Business hours and away-message windows',
                'Agent assignment strategy (round-robin, load-balanced, skill-based)',
                'Message retention and GDPR export controls',
            ]}
        />
    );
}
