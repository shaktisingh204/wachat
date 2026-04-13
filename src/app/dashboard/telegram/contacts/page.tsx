'use client';

import { Users } from 'lucide-react';
import { TelegramPlaceholder } from '../_components/telegram-placeholder';

export default function TelegramContactsPage() {
    return (
        <TelegramPlaceholder
            title="Contacts"
            description="Everyone who has messaged your bot, imported from inline queries, deep-links, or MTProto sync."
            icon={Users}
            bullets={[
                'Store chatId, username, first/last name, language, phone (when shared)',
                'Segment by opt-in, activity, or custom tags',
                'Export to CSV and merge duplicates',
                'Trigger flows based on contact events',
            ]}
            docsHref="https://core.telegram.org/api/contacts"
        />
    );
}
