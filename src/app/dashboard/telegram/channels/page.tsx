'use client';

import { Radio } from 'lucide-react';
import { TelegramPlaceholder } from '../_components/telegram-placeholder';

export default function TelegramChannelsPage() {
    return (
        <TelegramPlaceholder
            title="Channels"
            description="Link public or private Telegram channels to schedule posts, read subscriber counts, and manage boosts."
            icon={Radio}
            bullets={[
                'Add your bot as a channel admin to post on its behalf',
                'Scheduled posts with carousel, video, and poll attachments',
                'Track subscribers, boosts, and story reach',
                'Cross-post to WhatsApp, Instagram, and Facebook from one composer',
            ]}
            docsHref="https://core.telegram.org/api/channel"
        />
    );
}
