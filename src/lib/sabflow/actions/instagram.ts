
'use server';

import type { WithId, User } from '@/lib/definitions';
import axios from 'axios';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

const API_VERSION = 'v23.0';

async function loadProjectAndIgAccount(user: WithId<User>, projectId: string) {
    if (!projectId) throw new Error('Instagram actions require a projectId.');
    const { db } = await connectToDatabase();
    const project = await db.collection('projects').findOne({
        _id: new ObjectId(projectId),
        userId: user._id,
    });
    if (!project) throw new Error(`Project ${projectId} not found or access denied.`);
    if (!project.facebookPageId || !project.accessToken) {
        throw new Error(`Project "${project.name}" is not connected to Facebook/Instagram.`);
    }

    // Lookup connected IG business account on the page
    const pageRes = await axios.get(
        `https://graph.facebook.com/${API_VERSION}/${project.facebookPageId}`,
        { params: { fields: 'instagram_business_account', access_token: project.accessToken } }
    );
    const igAccountId = pageRes.data?.instagram_business_account?.id;
    if (!igAccountId) {
        throw new Error(`No Instagram Business account linked to page "${project.name}".`);
    }

    return { project, pageId: project.facebookPageId, accessToken: project.accessToken as string, igAccountId };
}

export async function executeInstagramAction(
    actionName: string,
    inputs: any,
    user: WithId<User>,
    logger: any
) {
    try {
        const { projectId, ...actionInputs } = inputs;
        const { accessToken, igAccountId, pageId } = await loadProjectAndIgAccount(user, projectId);

        switch (actionName) {
            case 'sendDirectMessage': {
                const { recipientId, messageText } = actionInputs;
                if (!recipientId) throw new Error('recipientId is required.');
                if (!messageText) throw new Error('messageText is required.');
                const res = await axios.post(
                    `https://graph.facebook.com/${API_VERSION}/${pageId}/messages`,
                    {
                        recipient: { id: String(recipientId) },
                        message: { text: String(messageText) },
                        messaging_type: 'RESPONSE',
                    },
                    { headers: { Authorization: `Bearer ${accessToken}` } }
                );
                logger.log(`[Instagram] DM sent to ${recipientId}`);
                return { output: { messageId: res.data?.message_id, recipientId } };
            }

            case 'replyToComment': {
                const { commentId, message } = actionInputs;
                if (!commentId) throw new Error('commentId is required.');
                if (!message) throw new Error('message is required.');
                const res = await axios.post(
                    `https://graph.facebook.com/${API_VERSION}/${commentId}/replies`,
                    null,
                    { params: { message: String(message), access_token: accessToken } }
                );
                return { output: { replyId: res.data?.id } };
            }

            case 'getComments': {
                const { mediaId } = actionInputs;
                if (!mediaId) throw new Error('mediaId is required.');
                const res = await axios.get(
                    `https://graph.facebook.com/${API_VERSION}/${mediaId}/comments`,
                    { params: { fields: 'id,text,username,timestamp,like_count', access_token: accessToken } }
                );
                const comments = res.data?.data || [];
                return { output: { comments, count: comments.length } };
            }

            case 'getRecentMedia': {
                const res = await axios.get(
                    `https://graph.facebook.com/${API_VERSION}/${igAccountId}/media`,
                    { params: { fields: 'id,caption,media_type,media_url,permalink,timestamp', access_token: accessToken } }
                );
                const media = res.data?.data || [];
                return { output: { media, count: media.length } };
            }

            case 'publishImagePost': {
                const { imageUrl, caption } = actionInputs;
                if (!imageUrl) throw new Error('imageUrl is required.');
                // 1. Create container
                const containerRes = await axios.post(
                    `https://graph.facebook.com/${API_VERSION}/${igAccountId}/media`,
                    null,
                    { params: { image_url: imageUrl, caption: caption || '', access_token: accessToken } }
                );
                const creationId = containerRes.data?.id;
                if (!creationId) throw new Error('Failed to create media container.');
                // 2. Publish
                const publishRes = await axios.post(
                    `https://graph.facebook.com/${API_VERSION}/${igAccountId}/media_publish`,
                    null,
                    { params: { creation_id: creationId, access_token: accessToken } }
                );
                logger.log(`[Instagram] Published ${publishRes.data?.id}`);
                return { output: { mediaId: publishRes.data?.id } };
            }

            default:
                return { error: `Instagram action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        const msg = e.response?.data?.error?.message || e.message || 'Instagram action failed.';
        return { error: msg };
    }
}
