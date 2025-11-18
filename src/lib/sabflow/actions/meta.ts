
'use server';

import type { WithId, User } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import axios from 'axios';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

const API_VERSION = 'v23.0';

async function uploadBase64ToMeta(base64Data: string, accessToken: string, pageId: string) {
    const buffer = Buffer.from(base64Data.split(',')[1], 'base64');
    
    const formData = new FormData();
    formData.append('source', buffer);
    formData.append('access_token', accessToken);
    
    const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${pageId}/photos`, formData, {
        headers: (formData as any).getHeaders(),
    });

    if (response.data.error) {
        throw new Error(`Meta API error during image upload: ${response.data.error.message}`);
    }

    return response.data.id;
}


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
            case 'createPost': {
                const { message, imageUrl, imageBase64 } = actionInputs;
                let endpoint, payload;

                if (imageBase64) {
                    const photoId = await uploadBase64ToMeta(imageBase64, accessToken, pageId);
                    endpoint = `https://graph.facebook.com/${API_VERSION}/${pageId}/feed`;
                    payload = {
                        message: message,
                        object_attachment: photoId,
                        access_token: accessToken
                    };
                } else if (imageUrl) {
                    endpoint = `https://graph.facebook.com/${API_VERSION}/${pageId}/photos`;
                    payload = { url: imageUrl, caption: message, access_token: accessToken };
                } else {
                    endpoint = `https://graph.facebook.com/${API_VERSION}/${pageId}/feed`;
                    payload = { message: message, access_token: accessToken };
                }

                if (!payload.message && !payload.url && !payload.object_attachment) {
                    throw new Error("Cannot create an empty post. A message or image is required.");
                }

                const response = await axios.post(endpoint, payload);
                if (response.data.error) throw new Error(getErrorMessage({response}));
                return { output: response.data };
            }
            // ... other meta actions
            default:
                throw new Error(`Meta Suite action "${actionName}" is not implemented.`);
        }
    } catch (e: any) {
        logger.log(`Meta Suite Action Failed: ${e.message}`, { actionName, inputs, error: e.stack });
        return { error: getErrorMessage(e) };
    }
}
