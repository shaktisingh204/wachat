'use client';

import { Send } from 'lucide-react';
import { TelegramPlaceholder } from '../_components/telegram-placeholder';

export default function TelegramBroadcastsPage() {
    return (
        <TelegramPlaceholder
            title="Broadcasts"
            description="Send a message to every subscriber who has opted in to your bot, or to a linked channel."
            icon={Send}
            bullets={[
                'Text, photo, video, document, polls and inline-keyboard CTAs',
                'Global 30 msg/s throttle with automatic retry on 429',
                'Segment by tags and dry-run with a test audience',
                'Track deliveries, clicks, and conversions',
            ]}
            docsHref="https://core.telegram.org/bots/api#sendmessage"
        />
    );
}
