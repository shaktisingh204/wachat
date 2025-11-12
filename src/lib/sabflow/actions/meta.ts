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
} from '@/app/actions/facebook.actions';
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

            default:
                throw new Error(`Meta Suite action "${actionName}" is not implemented.`);
        }
    } catch (e: any) {
        logger.log(`Meta Suite Action Failed: ${e.message}`, { actionName, inputs, error: e.stack });
        return { error: e.message };
    }
}

