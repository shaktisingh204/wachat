
'use server';

import type { WithId, User } from '@/lib/definitions';
import axios from 'axios';

const NOTION_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

function getNotionToken(user: WithId<User>): string {
    const settings = (user as any).sabFlowConnections?.find((c: any) => c.appName === 'Notion');
    const token = settings?.credentials?.accessToken || settings?.credentials?.apiKey;
    if (!token) throw new Error('Notion is not connected.');
    return String(token);
}

async function notionRequest(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    token: string,
    body?: any
) {
    const res = await axios({
        method,
        url: `${NOTION_BASE}${path}`,
        data: body,
        headers: {
            Authorization: `Bearer ${token}`,
            'Notion-Version': NOTION_VERSION,
            'Content-Type': 'application/json',
        },
    });
    return res.data;
}

export async function executeNotionAction(
    actionName: string,
    inputs: any,
    user: WithId<User>,
    logger: any
) {
    try {
        const token = getNotionToken(user);

        switch (actionName) {
            case 'createPage': {
                const databaseId = String(inputs.databaseId ?? '').trim();
                const title = String(inputs.title ?? '').trim();
                if (!databaseId) throw new Error('databaseId is required.');
                if (!title) throw new Error('title is required.');
                const titleProp = String(inputs.titleProperty ?? 'Name').trim() || 'Name';
                const data = await notionRequest('POST', '/pages', token, {
                    parent: { database_id: databaseId },
                    properties: {
                        [titleProp]: {
                            title: [{ text: { content: title } }],
                        },
                    },
                });
                logger.log(`[Notion] Created page ${data.id}`);
                return { output: { pageId: data.id, url: data.url } };
            }

            case 'updatePage': {
                const pageId = String(inputs.pageId ?? '').trim();
                if (!pageId) throw new Error('pageId is required.');
                const body: any = {};
                if (inputs.archived !== undefined && inputs.archived !== '') {
                    body.archived = String(inputs.archived).toLowerCase() === 'true';
                }
                if (Object.keys(body).length === 0) {
                    throw new Error('Nothing to update. Set archived=true or false.');
                }
                const data = await notionRequest('PATCH', `/pages/${pageId}`, token, body);
                return { output: { pageId: data.id } };
            }

            case 'queryDatabase': {
                const databaseId = String(inputs.databaseId ?? '').trim();
                if (!databaseId) throw new Error('databaseId is required.');
                const pageSize = Math.max(1, Math.min(100, Number(inputs.pageSize) || 20));
                const data = await notionRequest('POST', `/databases/${databaseId}/query`, token, {
                    page_size: pageSize,
                });
                const pages = data.results || [];
                return { output: { pages, count: pages.length } };
            }

            case 'appendBlock': {
                const pageId = String(inputs.pageId ?? '').trim();
                const text = String(inputs.text ?? '');
                if (!pageId) throw new Error('pageId is required.');
                if (!text) throw new Error('text is required.');
                await notionRequest('PATCH', `/blocks/${pageId}/children`, token, {
                    children: [
                        {
                            object: 'block',
                            type: 'paragraph',
                            paragraph: {
                                rich_text: [{ type: 'text', text: { content: text } }],
                            },
                        },
                    ],
                });
                return { output: { ok: 'true' } };
            }

            default:
                return { error: `Notion action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        const msg = e?.response?.data?.message || e.message || 'Notion action failed.';
        return { error: msg };
    }
}
