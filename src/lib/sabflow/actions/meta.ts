
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

        const formData = createFormData(actionInputs);
        formData.append('projectId', projectId); // Add project ID back for the actions that need it

        switch (actionName) {
            // ----- Content Management -----
            case 'createPost':
                return handleCreateFacebookPost(null, formData);

            case 'updatePost':
                return handleUpdatePost(null, formData);

            case 'deletePost':
                if (!actionInputs.postId) throw new Error("Post ID is required.");
                return handleDeletePost(actionInputs.postId, projectId);

            // ----- Engagement & Moderation -----
            case 'getComments':
                if (!actionInputs.objectId) throw new Error("Object ID (Post or Comment ID) is required.");
                return getFacebookComments(actionInputs.objectId, projectId);

            case 'postComment':
                return handlePostComment(null, formData);

            case 'likeObject':
                if (!actionInputs.objectId) throw new Error("Object ID to like is required.");
                return handleLikeObject(actionInputs.objectId, projectId);
            
            case 'deleteComment':
                 if (!actionInputs.commentId) throw new Error("Comment ID is required.");
                 return handleDeleteComment(actionInputs.commentId, projectId);

            // ----- Messenger -----
            case 'sendMessage':
                if (!actionInputs.recipientId || !actionInputs.messageText) throw new Error("Recipient ID and Message Text are required.");
                return sendFacebookMessage(null, formData);

            // ----- Analytics -----
            case 'getPosts':
                return getFacebookPosts(projectId);

            case 'getPageInsights':
                return getPageInsights(projectId);

            default:
                throw new Error(`Meta Suite action "${actionName}" is not implemented.`);
        }
    } catch (e: any) {
        logger.log(`Meta Suite Action Failed: ${e.message}`, { actionName, inputs, error: e.stack });
        return { error: e.message };
    }
}

export const metaActions = [
    // Content Management
    { name: 'createPost', label: 'Create Post', description: 'Publishes a new post to your Facebook Page.', inputs: [
        { name: 'projectId', label: 'Facebook Page Project', type: 'project-selector', projectType: 'facebook', required: true },
        { name: 'message', label: 'Message', type: 'textarea', required: true },
        { name: 'imageUrl', label: 'Image URL (Optional)', type: 'text' },
    ]},
    { name: 'updatePost', label: 'Update Post', description: 'Updates the text message of an existing post.', inputs: [
        { name: 'projectId', label: 'Facebook Page Project', type: 'project-selector', projectType: 'facebook', required: true },
        { name: 'postId', label: 'Post ID', type: 'text', required: true },
        { name: 'message', label: 'New Message', type: 'textarea', required: true },
    ]},
    { name: 'deletePost', label: 'Delete Post', description: 'Permanently deletes a post.', inputs: [
        { name: 'projectId', label: 'Facebook Page Project', type: 'project-selector', projectType: 'facebook', required: true },
        { name: 'postId', label: 'Post ID', type: 'text', required: true },
    ]},
    
    // Engagement
    { name: 'getComments', label: 'Get Post Comments', description: 'Retrieves comments for a specific post.', inputs: [
        { name: 'projectId', label: 'Facebook Page Project', type: 'project-selector', projectType: 'facebook', required: true },
        { name: 'objectId', label: 'Post ID', type: 'text', required: true },
    ]},
    { name: 'postComment', label: 'Reply to Post/Comment', description: 'Posts a new comment or replies to an existing one.', inputs: [
        { name: 'projectId', label: 'Facebook Page Project', type: 'project-selector', projectType: 'facebook', required: true },
        { name: 'objectId', label: 'Post or Comment ID', type: 'text', required: true },
        { name: 'message', label: 'Comment Text', type: 'textarea', required: true },
    ]},
    { name: 'likeObject', label: 'Like Post or Comment', description: 'Likes a post or comment on your page.', inputs: [
        { name: 'projectId', label: 'Facebook Page Project', type: 'project-selector', projectType: 'facebook', required: true },
        { name: 'objectId', label: 'Post or Comment ID', type: 'text', required: true },
    ]},
     { name: 'deleteComment', label: 'Delete Comment', description: 'Deletes a comment.', inputs: [
        { name: 'projectId', label: 'Facebook Page Project', type: 'project-selector', projectType: 'facebook', required: true },
        { name: 'commentId', label: 'Comment ID', type: 'text', required: true },
    ]},

    // Messenger
    { name: 'sendMessage', label: 'Send Messenger Message', description: 'Sends a message to a user who has previously messaged your page.', inputs: [
        { name: 'projectId', label: 'Facebook Page Project', type: 'project-selector', projectType: 'facebook', required: true },
        { name: 'recipientId', label: 'Recipient PSID', type: 'text', required: true },
        { name: 'messageText', label: 'Message Text', type: 'textarea', required: true },
    ]},

    // Analytics
    { name: 'getPosts', label: 'Get Page Posts', description: 'Retrieves a list of recent posts from your page.', inputs: [
        { name: 'projectId', label: 'Facebook Page Project', type: 'project-selector', projectType: 'facebook', required: true },
    ]},
    { name: 'getPageInsights', label: 'Get Page Insights', description: 'Fetches key performance indicators for your page.', inputs: [
        { name: 'projectId', label: 'Facebook Page Project', type: 'project-selector', projectType: 'facebook', required: true },
    ]},
];
