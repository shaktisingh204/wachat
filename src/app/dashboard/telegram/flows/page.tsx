'use client';

import { Workflow } from 'lucide-react';
import { TelegramPlaceholder } from '../_components/telegram-placeholder';

export default function TelegramFlowsPage() {
    return (
        <TelegramPlaceholder
            title="Flows"
            description="Visual automation flows triggered by Telegram events — new message, callback query, join, payment, or schedule."
            icon={Workflow}
            bullets={[
                'Drag-and-drop steps: send message, ask question, branch, call webhook, run AI',
                'Inline-keyboard and reply-keyboard builder',
                'Publish a draft, preview in a test chat, then roll out',
                'Shared flow library across Telegram, WhatsApp, and SabChat',
            ]}
            ctaLabel="Open SabFlow"
            ctaHref="/dashboard/sabflow/flow-builder"
        />
    );
}
