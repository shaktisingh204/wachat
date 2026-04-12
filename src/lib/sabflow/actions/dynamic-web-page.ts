
'use server';

import type { WithId, User } from '@/lib/definitions';
import { connectToDatabase } from '@/lib/mongodb';
import { randomUUID } from 'crypto';

/**
 * Render a template string by replacing {{key}} placeholders with values
 * from the provided `data` object. Supports dot notation for nested keys.
 */
function renderTemplateString(template: string, data: any): string {
    if (typeof template !== 'string') return '';
    return template.replace(/{{\s*([^}]+?)\s*}}/g, (_match, path) => {
        const keys = String(path).trim().split('.');
        let val: any = data;
        for (const k of keys) {
            if (val && typeof val === 'object' && k in val) {
                val = val[k];
            } else {
                return '';
            }
        }
        if (val === null || val === undefined) return '';
        return typeof val === 'object' ? JSON.stringify(val) : String(val);
    });
}

export async function executeDynamicWebPageAction(
    actionName: string,
    inputs: any,
    user: WithId<User>,
    logger: any
) {
    try {
        switch (actionName) {
            case 'renderTemplate': {
                const template = String(inputs.template ?? '');
                let data: any = {};
                if (typeof inputs.data === 'string' && inputs.data.trim()) {
                    try { data = JSON.parse(inputs.data); } catch { data = {}; }
                } else if (inputs.data && typeof inputs.data === 'object') {
                    data = inputs.data;
                }
                const html = renderTemplateString(template, data);
                logger.log(`[DynamicWebPage] Rendered template (${html.length} chars)`);
                return { output: { html, length: html.length } };
            }

            case 'publishPage': {
                const slug = String(inputs.slug ?? '').trim();
                const title = String(inputs.title ?? '').trim();
                const content = String(inputs.content ?? '');
                if (!slug) throw new Error('Slug is required.');
                if (!title) throw new Error('Title is required.');

                const { db } = await connectToDatabase();
                await db.collection('sabflow_pages').updateOne(
                    { userId: user._id, slug },
                    {
                        $set: {
                            userId: user._id,
                            slug,
                            title,
                            content,
                            updatedAt: new Date(),
                        },
                        $setOnInsert: {
                            createdAt: new Date(),
                            views: 0,
                        },
                    },
                    { upsert: true }
                );

                const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
                const url = `${baseUrl}/api/sabflow/pages/${encodeURIComponent(slug)}`;
                logger.log(`[DynamicWebPage] Published page "${slug}"`);
                return { output: { url, slug } };
            }

            case 'getPage': {
                const slug = String(inputs.slug ?? '').trim();
                if (!slug) throw new Error('Slug is required.');
                const { db } = await connectToDatabase();
                const page = await db.collection('sabflow_pages').findOne({ userId: user._id, slug });
                if (!page) throw new Error(`No page found with slug "${slug}".`);
                return {
                    output: {
                        title: page.title,
                        content: page.content,
                        views: page.views ?? 0,
                    },
                };
            }

            default:
                return { error: `Dynamic Web Page action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Dynamic Web Page action failed.' };
    }
}
