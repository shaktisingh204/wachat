
'use server';

import type { WithId, User } from '@/lib/definitions';

export async function executeNotionAction(actionName: string, inputs: any, user: WithId<User>, logger: any) {
    try {
        const settings = user.sabFlowConnections?.find((c: any) => c.appName === 'Notion');
        if (!settings) {
            return { error: "Notion is not connected." };
        }

        if (actionName === 'createPage') {
            const { databaseId, title } = inputs;

            logger.log(`[Mock] Creating Notion page in DB ${databaseId}: ${title}`);

            const mockPageId = `page_${Math.random().toString(36).substr(2, 9)}`;
            return { output: { pageId: mockPageId, title, url: `https://notion.so/${mockPageId}` } };
        }

        return { error: `Notion action "${actionName}" is not implemented.` };
    } catch (e: any) {
        return { error: e.message };
    }
}
