'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from './project.actions';
import { generateFlowsKeyPair, formatPublicKeyForMeta } from '@/lib/crypto/flows';
import { getErrorMessage } from '@/lib/utils';
import axios from 'axios';
import { Project } from '@/lib/definitions';

const API_VERSION = 'v23.0';

export async function generateAndSaveFlowsKeys(projectId: string, phoneNumberId: string): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!projectId || !phoneNumberId) {
        return { success: false, error: 'Project ID and Phone Number ID are required.' };
    }

    try {
        const { db } = await connectToDatabase();
        const project = await db.collection<Project>('projects').findOne(
            { _id: new ObjectId(projectId), "phoneNumbers.id": phoneNumberId }
        );

        if (!project) {
            return { success: false, error: 'Project or Phone Number not found.' };
        }

        // Generate keys
        const { privateKey, publicKey } = await generateFlowsKeyPair();

        // Update DB
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId), "phoneNumbers.id": phoneNumberId },
            {
                $set: {
                    "phoneNumbers.$.flowsEncryptionConfig": {
                        privateKey,
                        publicKey,
                        metaStatus: 'NOT_UPLOADED'
                    }
                }
            }
        );

        revalidatePath('/dashboard/numbers');
        return { success: true, message: 'RSA Key Pair generated successfully. You can now upload the Public Key to Meta.' };

    } catch (e: any) {
        console.error('Failed to generate flows keys:', e);
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function uploadPublicKeyToMeta(projectId: string, phoneNumberId: string): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!projectId || !phoneNumberId) {
        return { success: false, error: 'Project ID and Phone Number ID are required.' };
    }

    try {
        const project = await getProjectById(projectId);
        if (!project) return { success: false, error: 'Project not found.' };

        // Find the phone number config
        const phoneNumber = project.phoneNumbers.find(p => p.id === phoneNumberId);
        if (!phoneNumber) return { success: false, error: 'Phone number not found in project.' };

        const config = phoneNumber.flowsEncryptionConfig;
        if (!config || !config.publicKey) {
            return { success: false, error: 'No keys generated for this phone number. Please generate keys first.' };
        }

        const formattedPublicKey = formatPublicKeyForMeta(config.publicKey);

        // Upload to Meta
        const url = `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/whatsapp_flows_public_key`;
        await axios.post(url, {
            public_key: formattedPublicKey
        }, {
            headers: {
                'Authorization': `Bearer ${project.accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        // Update DB status
        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId), "phoneNumbers.id": phoneNumberId },
            {
                $set: {
                    "phoneNumbers.$.flowsEncryptionConfig.metaStatus": 'UPLOADED',
                    "phoneNumbers.$.flowsEncryptionConfig.uploadedAt": new Date()
                }
            }
        );

        revalidatePath('/dashboard/numbers');
        return { success: true, message: 'Public Key uploaded to Meta successfully. Flows error should be resolved.' };

    } catch (e: any) {
        console.error('Failed to upload public key to Meta:', e.response?.data || e.message);
        const metaError = e.response?.data?.error?.message;

        // Mark as failed in DB? Optional, but good for UI
        const { db } = await connectToDatabase();

        // Don't overwrite the keys, just status
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId), "phoneNumbers.id": phoneNumberId },
            {
                $set: {
                    "phoneNumbers.$.flowsEncryptionConfig.metaStatus": 'FAILED'
                }
            }
        );

        return { success: false, error: `Meta Upload Failed: ${metaError || getErrorMessage(e)}` };
    }
}
