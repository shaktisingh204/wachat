
'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, WithId } from 'mongodb';
import axios from 'axios';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession, getProjectById } from '.';
import type { AnyMessage, Project, Template, MetaPhoneNumber } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { headers } from 'next/headers';

const API_VERSION = 'v23.0';

export async function exchangeCodeForTokens(code: string): Promise<{ accessToken?: string; error?: string }> {
    const appId = process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID;
    const appSecret = process.env.META_ONBOARDING_APP_SECRET;

    if (!appId || !appSecret) {
        return { error: 'Server is not configured for Meta OAuth.' };
    }

    try {
        const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/setup`;
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/oauth/access_token`, {
            params: {
                client_id: appId,
                redirect_uri: redirectUri,
                client_secret: appSecret,
                code: code,
            }
        });
        
        const accessToken = response.data.access_token;
        if (!accessToken) {
            throw new Error('Could not retrieve access token from Meta.');
        }

        return { accessToken };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function handleWabaOnboarding(data: {
    wabas: any[],
    phone_numbers: any[],
    business_id?: string,
    access_token: string,
    granted_scopes: string[],
}) {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required' };
    
    if (!data.wabas || data.wabas.length === 0 || !data.phone_numbers || data.phone_numbers.length === 0) {
        return { error: 'Incomplete data received from Meta. Please try again.' };
    }

    try {
        const { db } = await connectToDatabase();
        const bulkOps = [];
        const hasCatalogManagement = data.granted_scopes.includes('catalog_management');

        for (const waba of data.wabas) {
            const projectData = {
                userId: new ObjectId(session.user._id),
                name: waba.name,
                wabaId: waba.id,
                businessId: data.business_id,
                appId: process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID,
                accessToken: data.access_token,
                createdAt: new Date(),
                messagesPerSecond: 80,
                planId: session.user.plan?._id ? new ObjectId(session.user.plan._id) : undefined,
                credits: session.user.plan?.signupCredits || 0,
                hasCatalogManagement,
                phoneNumbers: data.phone_numbers
                    .filter(p => p.waba_id === waba.id)
                    .map(p => ({
                        id: p.id,
                        display_phone_number: p.display_phone_number,
                        verified_name: p.verified_name,
                        code_verification_status: 'VERIFIED',
                        quality_rating: 'GREEN',
                    })),
            };

            bulkOps.push({
                updateOne: {
                    filter: { userId: projectData.userId, wabaId: projectData.wabaId },
                    update: { $set: projectData, $setOnInsert: { createdAt: new Date() } },
                    upsert: true,
                },
            });
        }
        
        if (bulkOps.length > 0) {
            await db.collection('projects').bulkWrite(bulkOps);
        }

        revalidatePath('/dashboard');
        return { success: true, message: `${bulkOps.length} project(s) connected/updated.` };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


export async function findOrCreateContact(projectId: string, phoneNumberId: string, waId: string): Promise<{ contact?: WithId<Contact>, error?: string }> {
    try {
        const { db } = await connectToDatabase();
        
        // Find user by WhatsApp ID and Project ID
        let contact = await db.collection<Contact>('contacts').findOne({ projectId: new ObjectId(projectId), waId });

        if (!contact) {
            // If contact doesn't exist, create it
             const project = await db.collection<Project>('projects').findOne({_id: new ObjectId(projectId)});
             if (!project) return { error: 'Project not found' };

             // Fetch contact profile name from WhatsApp
             const profileResponse = await axios.get(`https://graph.facebook.com/${API_VERSION}/${waId}?fields=name`, {
                 headers: { 'Authorization': `Bearer ${project.accessToken}` }
             });
             const name = profileResponse.data?.name || waId;

             const newContactData = {
                projectId: new ObjectId(projectId),
                waId,
                phoneNumberId,
                name: name,
                createdAt: new Date(),
                status: 'new'
            };

            const result = await db.collection('contacts').insertOne(newContactData as any);
            contact = { ...newContactData, _id: result.insertedId };
        } else if (contact.phoneNumberId !== phoneNumberId) {
             // If contact exists but phone number ID is different, update it.
            await db.collection('contacts').updateOne(
                { _id: contact._id },
                { $set: { phoneNumberId: phoneNumberId } }
            );
            contact.phoneNumberId = phoneNumberId;
        }

        return { contact: JSON.parse(JSON.stringify(contact)) };
    } catch(e) {
        console.error("Error in findOrCreateContact: ", getErrorMessage(e));
        return { error: getErrorMessage(e) };
    }
}

export async function handleSendMessage(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const contactId = formData.get('contactId') as string;
    const projectId = formData.get('projectId') as string;
    const phoneNumberId = formData.get('phoneNumberId') as string;
    const waId = formData.get('waId') as string;
    const messageText = formData.get('messageText') as string | null;
    const mediaFile = formData.get('mediaFile') as File | null;
    const mediaUrl = formData.get('mediaUrl') as string | null;
    
    try {
        const project = await getProjectById(projectId);
        if (!project) throw new Error('Project not found or access denied.');

        let mediaId = null;
        let payload: any;
        const now = new Date();

        // 1. Upload Media if present
        if ((mediaFile && mediaFile.size > 0) || mediaUrl) {
            const uploadForm = new FormData();
            uploadForm.append('messaging_product', 'whatsapp');
            
            if (mediaFile && mediaFile.size > 0) {
                 uploadForm.append('file', mediaFile);
            } else if (mediaUrl) {
                 uploadForm.append('link', mediaUrl);
            }
            
            const uploadResponse = await axios.post(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/media`, uploadForm, {
                headers: { ...uploadForm.getHeaders(), 'Authorization': `Bearer ${project.accessToken}` }
            });
            
            mediaId = uploadResponse.data.id;
            if (!mediaId) throw new Error('Media upload failed, no ID returned.');

            const mediaTypeMap: Record<string, 'image' | 'video' | 'document' | 'audio'> = {
                'image/': 'image', 'video/': 'video', 'application/pdf': 'document', 'audio/': 'audio'
            };
            const mediaType = Object.keys(mediaTypeMap).find(prefix => (mediaFile?.type || '').startsWith(prefix)) || 'document';
            
            payload = {
                messaging_product: "whatsapp", to: waId, type: mediaType,
                [mediaType]: { id: mediaId, ...(messageText && { caption: messageText }) }
            };
            
        } else if (messageText) {
            payload = { messaging_product: "whatsapp", to: waId, type: "text", text: { body: messageText } };
        } else {
            return { error: 'Cannot send an empty message.' };
        }

        // 2. Send the message
        const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`, payload, {
            headers: { 'Authorization': `Bearer ${project.accessToken}` }
        });

        const wamid = response.data?.messages?.[0]?.id;
        if (!wamid) throw new Error('Message sent but no WAMID returned from Meta.');
        
        // 3. Log to database
        const { db } = await connectToDatabase();
        await db.collection('outgoing_messages').insertOne({
            direction: 'out', contactId: new ObjectId(contactId), projectId: new ObjectId(projectId), wamid, messageTimestamp: now, type: payload.type,
            content: payload, status: 'sent', statusTimestamps: { sent: now }, createdAt: now,
        });

        const lastMessage = messageText ? `You: ${messageText.substring(0, 50)}` : `You sent a ${payload.type}`;
        await db.collection('contacts').updateOne({ _id: new ObjectId(contactId) }, { $set: { lastMessage: lastMessage, lastMessageTimestamp: now, status: 'open' } });
        
        revalidatePath('/dashboard/chat');
        return { message: 'Message sent successfully.' };

    } catch (e: any) {
        console.error('Failed to send message:', e);
        return { error: getErrorMessage(e) };
    }
}


export async function getPublicProjectById(projectId: string): Promise<WithId<Project> | null> {
    if (!projectId || !ObjectId.isValid(projectId)) {
        return null;
    }
    try {
        const { db } = await connectToDatabase();
        const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) }, {
            projection: { accessToken: 0 } // Exclude sensitive fields
        });
        return project ? JSON.parse(JSON.stringify(project)) : null;
    } catch(e) {
        return null;
    }
}

    