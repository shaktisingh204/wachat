'use client';

import { Reply } from 'lucide-react';
import { TelegramPlaceholder } from '../_components/telegram-placeholder';

export default function TelegramAutoReplyPage() {
    return (
        <TelegramPlaceholder
            title="Auto Reply"
            description="Reply automatically to incoming messages based on keywords, patterns, or away-hours windows."
            icon={Reply}
            bullets={[
                'Keyword and regex triggers with priority ordering',
                'Greeting messages on first contact and /start',
                'Away messages outside business hours',
                'Fall-through to AI-powered assistant when no rule matches',
            ]}
        />
    );
}
