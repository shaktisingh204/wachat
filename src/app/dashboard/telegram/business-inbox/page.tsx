'use client';

import { Inbox } from 'lucide-react';
import { TelegramPlaceholder } from '../_components/telegram-placeholder';

export default function TelegramBusinessInboxPage() {
    return (
        <div className="flex h-full w-full flex-col">
            <TelegramPlaceholder
                title="Business Inbox"
                description="Handle chats on behalf of a Telegram Premium Business user. Your bot receives business_connection updates and can reply, edit, and delete messages."
                icon={Inbox}
                bullets={[
                    'Connect via Settings → Business → Chatbots on a Premium account',
                    'Manage Quick Replies, Greeting and Away messages programmatically',
                    'Per-chat permissions with revocation support',
                    'Only 1:1 chats — groups and channels are not included',
                ]}
                docsHref="https://core.telegram.org/bots/business"
            />
        </div>
    );
}
