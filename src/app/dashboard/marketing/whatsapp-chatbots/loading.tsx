import * as React from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function WhatsappChatbotsLoading() {
    return (
        <div className="flex w-full flex-col gap-6 p-4 md:p-6">
            <EntityListShell
                title="WhatsApp Chatbots"
                subtitle="Manage your WhatsApp Chatbots seamlessly."
                loading={true}
            >
                <div />
            </EntityListShell>
        </div>
    );
}
