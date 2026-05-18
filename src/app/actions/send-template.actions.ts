'use server';

import { type WithId } from 'mongodb';
import type { Project } from '@/lib/definitions';

export async function handleSendTemplateMessage(
    prevState: any,
    data: { [key: string]: any },
    projectFromAction?: WithId<Project>
): Promise<{ message?: string; error?: string }> {
    const {
        contactId,
        templateId,
        mediaSource,
        headerMediaUrl,
        headerMediaFile,
        ...variables
    } = data;

    const { rustClient } = await import('@/lib/rust-client');

    try {
        const named: Record<string, string> = {};
        for (const [k, v] of Object.entries(variables)) {
            if (typeof v === 'string') named[k] = v;
        }

        const out = await rustClient.templates.send(String(templateId), {
            recipientPhone: String(contactId),
            variables: { named },
            mediaId: typeof headerMediaFile?.mediaId === 'string' ? headerMediaFile.mediaId : undefined,
        });

        void projectFromAction;
        void mediaSource;
        void headerMediaUrl;
        void out;

        return { message: 'Template sent successfully.' };
    } catch (e: any) {
        return { error: e?.message ?? 'Send failed' };
    }
}
