'use client';

import { Image as ImageIcon } from 'lucide-react';
import { TelegramPlaceholder } from '../_components/telegram-placeholder';

export default function TelegramStickersPage() {
    return (
        <TelegramPlaceholder
            title="Stickers & Custom Emoji"
            description="Create and manage sticker sets and custom emoji packs for your brand."
            icon={ImageIcon}
            bullets={[
                'Upload static, animated, and video stickers',
                'Create custom emoji sets (Premium users can use them everywhere)',
                'Publish sets via Bot API createNewStickerSet / addStickerToSet',
                'Track sticker usage inside conversations',
            ]}
            docsHref="https://core.telegram.org/api/custom-emoji"
        />
    );
}
