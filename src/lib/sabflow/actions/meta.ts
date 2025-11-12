
'use server';

import {
    handleCreateFacebookPost,
    handleDeletePost,
    handleUpdatePost,
    handleLikeObject,
    handlePostComment,
    handleDeleteComment,
    sendFacebookMessage,
    getFacebookPosts,
    getFacebookComments,
    getPageInsights,
    getFacebookConversations,
    getFacebookConversationMessages,
    handleScheduleLiveStream,
    getScheduledLiveStreams,
} from '@/app/actions/facebook.actions';
import {
    getAdCampaigns,
    getCatalogs,
    getProductsForCatalog,
    addProductToCatalog,
    deleteProductFromCatalog
} from '@/app/actions/meta-suite.actions';
import { getProjectById } from '@/app/actions/project.actions';
import type { WithId, User } from '@/lib/definitions';
import FormData from 'form-data';
import { getErrorMessage } from '@/lib/utils';
import axios from 'axios';

const API_VERSION = 'v23.0';

// A helper function to create FormData for actions
const createFormData = (inputs: any): FormData => {
    const formData = new FormData();
    Object.keys(inputs).forEach(key => {
        if (inputs[key] !== undefined && inputs[key] !== null) {
            formData.append(key, String(inputs[key]));
        }
    });
    return formData;
};

export async function executeMetaAction(actionName: string, inputs: any, user: WithId<User>, logger: any) {
    try {
        const { projectId, ...actionInputs } = inputs;
        if (!projectId) {
            throw new Error("Meta Suite actions require a 'projectId' to be selected.");
        }

        const project = await getProjectById(projectId);
        if (!project) {
            throw new Error(`Project with ID ${projectId} not found or you do not have access.`);
        }
        
        if (!project.facebookPageId || !project.accessToken) {
            throw new Error(`Project "${project.name}" is not correctly configured for the Meta Suite.`);
        }

        const formData = createFormData(actionInputs);
        formData.append('projectId', projectId);

        switch (actionName) {
            // ----- Content Management -----
            case 'createPost': {
                const result = await handleCreateFacebookPost(null, formData);
                if (result.error) throw new Error(result.error);
                return { output: result };
            }
            case 'updatePost': {
                const result = await handleUpdatePost(null, formData);
                if (result.error) throw new Error(result.error);
                return { output: result };
            }
            case 'deletePost': {
                if (!actionInputs.postId) throw new Error("Post ID is required.");
                const result = await handleDeletePost(actionInputs.postId, projectId);
                if (!result.success) throw new Error(result.error);
                return { output: result };
            }
            
            // ----- Engagement & Moderation -----
             case 'getComments': {
                if (!actionInputs.objectId) throw new Error("Object ID (Post or Comment ID) is required.");
                const result = await getFacebookComments(actionInputs.objectId, projectId);
                if (result.error) throw new Error(result.error);
                return { output: result.comments };
            }
            case 'postComment': {
                const result = await handlePostComment(null, formData);
                if (result.error) throw new Error(result.error);
                return { output: result };
            }
            case 'likeObject': {
                if (!actionInputs.objectId) throw new Error("Object ID (Post or Comment ID) is required.");
                const result = await handleLikeObject(actionInputs.objectId, projectId);
                if (!result.success) throw new Error(result.error);
                return { output: result };
            }
            case 'deleteComment': {
                if (!actionInputs.commentId) throw new Error("Comment ID is required.");
                const result = await handleDeleteComment(actionInputs.commentId, projectId);
                if (!result.success) throw new Error(result.error);
                return { output: result };
            }

            // ----- Data Retrieval -----
            case 'getPagePosts': {
                const result = await getFacebookPosts(projectId);
                if (result.error) throw new Error(result.error);
                return { output: result.posts };
            }
             case 'getPageInsights': {
                const result = await getPageInsights(projectId);
                if (result.error) throw new Error(result.error);
                return { output: result.insights };
            }
            
            // ----- Messenger Actions -----
            case 'sendMessengerMessage': {
                if (!actionInputs.recipientId) throw new Error("Recipient ID (PSID) is required.");
                const result = await sendFacebookMessage(null, formData);
                if (result.error) throw new Error(result.error);
                return { output: result };
            }
            case 'getPageConversations': {
                const result = await getFacebookConversations(projectId);
                if (result.error) throw new Error(result.error);
                return { output: result.conversations };
            }
            case 'getConversationMessages': {
                if (!actionInputs.conversationId) throw new Error("Conversation ID is required.");
                const result = await getFacebookConversationMessages(actionInputs.conversationId, projectId);
                if (result.error) throw new Error(result.error);
                return { output: result.messages };
            }

            // ----- Live Video Actions -----
            case 'scheduleLiveVideo': {
                const result = await handleScheduleLiveStream(null, formData);
                if (result.error) throw new Error(result.error);
                return { output: result };
            }
            case 'getScheduledLiveVideos': {
                const result = await getScheduledLiveStreams(projectId);
                // The action returns an array directly, not an object with a property.
                return { output: result };
            }

            // ----- Ads & Catalog Actions -----
            case 'getAdCampaigns': {
                const result = await getAdCampaigns(projectId);
                if (result.error) throw new Error(result.error);
                return { output: result.campaigns };
            }
            case 'getCatalogs': {
                const result = await getCatalogs(projectId);
                return { output: result };
            }
            case 'getCatalogProducts': {
                if (!actionInputs.catalogId) throw new Error("Catalog ID is required.");
                const result = await getProductsForCatalog(actionInputs.catalogId, projectId);
                return { output: result };
            }
            case 'addProductToCatalog': {
                const result = await addProductToCatalog(null, formData);
                if (result.error) throw new Error(result.error);
                return { output: result };
            }
            case 'deleteProductFromCatalog': {
                if (!actionInputs.productId) throw new Error("Product ID is required.");
                const result = await deleteProductFromCatalog(actionInputs.productId, projectId);
                if (!result.success) throw new Error(result.error);
                return { output: result };
            }

            default:
                throw new Error(`Meta Suite action "${actionName}" is not implemented.`);
        }
    } catch (e: any) {
        logger.log(`Meta Suite Action Failed: ${e.message}`, { actionName, inputs, error: e.stack });
        return { error: e.message };
    }
}
