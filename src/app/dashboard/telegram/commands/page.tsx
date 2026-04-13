'use client';

import { Hash } from 'lucide-react';
import { TelegramPlaceholder } from '../_components/telegram-placeholder';

export default function TelegramCommandsPage() {
    return (
        <TelegramPlaceholder
            title="Commands"
            description="Define the slash commands your bot advertises and map each one to a handler or flow."
            icon={Hash}
            bullets={[
                'Sync command list via setMyCommands (scoped per chat type and language)',
                'Route each command to a reply, a flow, or an AI handler',
                'Localize command descriptions per user language',
                'A/B test command flows and view completion rates',
            ]}
            docsHref="https://core.telegram.org/bots/api#setmycommands"
        />
    );
}
