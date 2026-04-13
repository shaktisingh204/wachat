'use client';

import { Eye } from 'lucide-react';
import { TelegramPlaceholder } from '../_components/telegram-placeholder';

export default function TelegramStoriesPage() {
    return (
        <TelegramPlaceholder
            title="Stories"
            description="Post and schedule Stories on channels and Business accounts. Track views and replies."
            icon={Eye}
            bullets={[
                'Post via Bot API postStory / editStory / deleteStory',
                'Requires channel Boost level ≥ 1 for channel stories',
                'Photo and video stories with captions and link buttons',
                'Reply routing into the Live Chat inbox',
            ]}
            docsHref="https://core.telegram.org/api/stories"
        />
    );
}
