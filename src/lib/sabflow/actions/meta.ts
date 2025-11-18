
'use server';

import type { WithId, User } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import axios from 'axios';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

const API_VERSION = 'v23.0';

export async function executeMetaAction(actionName: string, inputs: any, user: WithId<User>, logger: any) {
    try {
        const { projectId, ...actionInputs } = inputs;
        if (!projectId) {
            throw new Error("Meta Suite actions require a 'projectId' to be selected.");
        }

        const { db } = await connectToDatabase();
        const project = await db.collection('projects').findOne({ 
            _id: new ObjectId(projectId),
            // Ensure the user running the flow owns the project
            userId: user._id 
        });

        if (!project) {
            throw new Error(`Project with ID ${projectId} not found or you do not have access.`);
        }
        
        if (!project.facebookPageId || !project.accessToken) {
            throw new Error(`Project "${project.name}" is not correctly configured for the Meta Suite.`);
        }
        
        const pageId = project.facebookPageId;
        const accessToken = project.accessToken;

        switch (actionName) {
            // ----- Content Management -----
            case 'createPost': {
                const { message, imageUrl } = actionInputs;
                let endpoint, payload;
                if (imageUrl) {
                    endpoint = `https://graph.facebook.com/${API_VERSION}/${pageId}/photos`;
                    payload = { url: imageUrl, caption: message, access_token: accessToken };
                } else {
                    endpoint = `https://graph.facebook.com/${API_VERSION}/${pageId}/feed`;
                    payload = { message: message, access_token: accessToken };
                }
                const response = await axios.post(endpoint, payload);
                if (response.data.error) throw new Error(getErrorMessage({response}));
                return { output: response.data };
            }
            case 'updatePost': {
                const { postId, message } = actionInputs;
                if (!postId || !message) throw new Error("Post ID and message are required.");
                const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${postId}`, {
                    message,
                    access_token: accessToken
                });
                if (response.data.error) throw new Error(getErrorMessage({response}));
                return { output: response.data };
            }
            case 'deletePost': {
                const { postId } = actionInputs;
                if (!postId) throw new Error("Post ID is required.");
                const response = await axios.delete(`https://graph.facebook.com/${API_VERSION}/${postId}`, {
                    params: { access_token: accessToken }
                });
                if (response.data.error) throw new Error(getErrorMessage({response}));
                return { output: response.data };
            }

            // ----- Engagement & Moderation -----
             case 'getComments': {
                const { objectId } = actionInputs;
                if (!objectId) throw new Error("Object ID (Post or Comment ID) is required.");
                const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${objectId}/comments`, {
                    params: { access_token: accessToken }
                });
                if (response.data.error) throw new Error(getErrorMessage({response}));
                return { output: response.data.data };
            }
            case 'postComment': {
                const { objectId, message } = actionInputs;
                if (!objectId || !message) throw new Error("Object ID and message are required.");
                const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${objectId}/comments`, {
                    message,
                    access_token: accessToken
                });
                if (response.data.error) throw new Error(getErrorMessage({response}));
                return { output: response.data };
            }
            case 'likeObject': {
                const { objectId } = actionInputs;
                if (!objectId) throw new Error("Object ID is required.");
                const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${objectId}/likes`, {}, {
                    params: { access_token: accessToken }
                });
                if (response.data.error) throw new Error(getErrorMessage({response}));
                return { output: response.data };
            }
            case 'deleteComment': {
                const { commentId } = actionInputs;
                if (!commentId) throw new Error("Comment ID is required.");
                const response = await axios.delete(`https://graph.facebook.com/${API_VERSION}/${commentId}`, {
                    params: { access_token: accessToken }
                });
                if (response.data.error) throw new Error(getErrorMessage({response}));
                return { output: response.data };
            }

            // ----- Data Retrieval -----
            case 'getPagePosts': {
                const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${pageId}/posts`, {
                    params: {
                        fields: 'id,message,created_time,full_picture,permalink_url,object_id,shares,reactions.summary(true),comments.summary(true)',
                        access_token: accessToken
                    }
                });
                if (response.data.error) throw new Error(getErrorMessage({response}));
                return { output: response.data.data };
            }
             case 'getPageInsights': {
                const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${pageId}/insights`, {
                    params: {
                        metric: 'page_post_engagements,page_impressions,page_fan_adds_unique',
                        period: 'day',
                        access_token: accessToken
                    }
                });
                 if (response.data.error) throw new Error(getErrorMessage({response}));
                return { output: response.data.data };
            }
            
            // ----- Messenger Actions -----
            case 'sendMessengerMessage': {
                const { recipientId, messageText } = actionInputs;
                if (!recipientId || !messageText) throw new Error("Recipient ID (PSID) and message text are required.");
                const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/me/messages`, {
                    recipient: { id: recipientId },
                    messaging_type: 'RESPONSE',
                    message: { text: messageText }
                }, { params: { access_token: accessToken } });
                if (response.data.error) throw new Error(getErrorMessage({response}));
                return { output: response.data };
            }
            case 'getPageConversations': {
                 const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${pageId}/conversations`, {
                    params: {
                        fields: 'id,participants,updated_time,snippet,unread_count,can_reply',
                        platform: 'messenger',
                        access_token: accessToken
                    }
                });
                if (response.data.error) throw new Error(getErrorMessage({response}));
                return { output: response.data.data };
            }
            case 'getConversationMessages': {
                 const { conversationId } = actionInputs;
                 if (!conversationId) throw new Error("Conversation ID is required.");
                 const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${conversationId}`, {
                    params: {
                        fields: 'messages{id,created_time,from,to,message}',
                        access_token: accessToken
                    }
                });
                if (response.data.error) throw new Error(getErrorMessage({response}));
                return { output: response.data.messages?.data || [] };
            }

            // ----- Live Video Actions -----
            case 'scheduleLiveVideo': {
                const { title, scheduledDate, scheduledTime, videoUrl } = actionInputs;
                if (!title || !scheduledDate || !scheduledTime || !videoUrl) throw new Error("Title, date, time, and video URL are required.");
                const scheduledTimestamp = Math.floor(new Date(`${scheduledDate}T${scheduledTime}`).getTime() / 1000);
                
                const liveVideoResponse = await axios.post(`https://graph.facebook.com/${API_VERSION}/${pageId}/live_videos`, {
                    title,
                    status: 'SCHEDULED_UNPUBLISHED',
                    planned_start_time: scheduledTimestamp,
                    access_token: accessToken
                });
                if (liveVideoResponse.data.error) throw new Error(getErrorMessage({response: liveVideoResponse}));
                
                logger.log("Live Video scheduled, but video upload is a complex process not fully implemented in this action.", { response: liveVideoResponse.data });
                return { output: liveVideoResponse.data };
            }
            case 'getScheduledLiveVideos': {
                const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${pageId}/live_videos`, {
                    params: { access_token: accessToken }
                });
                 if (response.data.error) throw new Error(getErrorMessage({response}));
                return { output: response.data.data };
            }
            
            // ----- Ad & Catalog Actions -----
            case 'getAdCampaigns': {
                if (!project.adAccountId) throw new Error("Ad Account not configured for this project.");
                const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${project.adAccountId}/campaigns`, {
                    params: { fields: 'id,name,status,objective,daily_budget', access_token: accessToken }
                });
                if (response.data.error) throw new Error(getErrorMessage({response}));
                return { output: response.data.data };
            }
            case 'getCatalogs': {
                if (!project.businessId) throw new Error("Business ID not configured for this project.");
                const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${project.businessId}/owned_product_catalogs`, {
                    params: { fields: 'id,name', access_token: accessToken }
                });
                 if (response.data.error) throw new Error(getErrorMessage({response}));
                return { output: response.data.data };
            }
            case 'getProductsForCatalog': {
                const { catalogId } = actionInputs;
                if (!catalogId) throw new Error("Catalog ID is required.");
                const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${catalogId}/products`, {
                    params: { fields: 'id,name,price,currency,image_url,availability,retailer_id,inventory', access_token: accessToken }
                });
                 if (response.data.error) throw new Error(getErrorMessage({response}));
                return { output: response.data.data };
            }
            case 'addProductToCatalog': {
                const { catalogId, name, price, currency, retailer_id, image_url, description } = actionInputs;
                if (!catalogId || !name || !price || !currency || !retailer_id || !image_url) throw new Error("All product fields are required.");
                const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${catalogId}/products`, {
                    name, price, currency, retailer_id, image_url, description, availability: 'in_stock',
                    access_token: accessToken
                });
                 if (response.data.error) throw new Error(getErrorMessage({response}));
                return { output: response.data };
            }
            case 'deleteProductFromCatalog': {
                const { productId } = actionInputs;
                if (!productId) throw new Error("Product ID is required.");
                const response = await axios.delete(`https://graph.facebook.com/${API_VERSION}/${productId}`, {
                    params: { access_token: accessToken }
                });
                 if (response.data.error) throw new Error(getErrorMessage({response}));
                return { output: response.data };
            }

            default:
                throw new Error(`Meta Suite action "${actionName}" is not implemented.`);
        }
    } catch (e: any) {
        logger.log(`Meta Suite Action Failed: ${e.message}`, { actionName, inputs, error: e.stack });
        return { error: getErrorMessage(e) };
    }
}
