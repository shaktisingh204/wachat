'use client';

import { MessageCircle } from 'lucide-react';
import { TelegramPlaceholder } from '../_components/telegram-placeholder';

export default function TelegramChatPage() {
    return (
        <div className="flex h-full w-full flex-col">
            <TelegramPlaceholder
                title="Live Chat"
                description="Shared inbox for every Telegram chat your bot is part of. Agents can claim conversations, reply, and hand-off."
                icon={MessageCircle}
                bullets={[
                    'Unified inbox across all linked bots',
                    'Assign chats to agents and track unread counts',
                    'Send text, media, inline keyboards and quick replies',
                    'Supports 1:1 DMs, groups, and Business-connected chats',
                ]}
                docsHref="https://core.telegram.org/bots/api#available-methods"
            />
        </div>
    );
}
