

'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId } from 'mongodb';
import axios from 'axios';

import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById, getSession } from './user.actions';
import { getErrorMessage } from '@/lib/utils';
import type { Project, Contact, AnyMessage, OutgoingMessage, Template, PaymentConfiguration, BusinessCapabilities } from '@/lib/definitions';
import { processSingleWebhook } from '@/lib/webhook-processor';

const API_VERSION = 'v23.0';

export async function handleSyncPhoneNumbers(projectId: string) {
    if (!projectId || !ObjectId.isValid(projectId)) {
        return { error: 'Invalid project ID' };
    }
    
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Project not found.' };

    const { wabaId, accessToken } = project;
    if (!wabaId || !accessToken) return { error: 'Project is missing WABA ID or Access Token.' };
    
    try {
        const response = await axios.get(
            `https://graph.facebook.com/${API_VERSION}/${wabaId}/phone_numbers`,
            {
                headers: { Authorization: `Bearer ${accessToken}` },
                params: {
                  fields: 'id,display_phone_number,name_status,verified_name,code_verification_status,quality_rating,throughput,profile{about,address,description,email,profile_picture_url,websites,vertical}'
                }
            }
        );
        
        const phoneNumbers = response.data.data;
        
        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { phoneNumbers: phoneNumbers } }
        );
        
        revalidatePath('/dashboard/numbers');
        return { message: `Synced ${phoneNumbers.length} phone number(s).` };
    } catch(e) {
        console.error("Sync phone numbers failed:", e);
        return { error: getErrorMessage(e) }
    }
}

export async function handleSubscribeProjectWebhook(wabaId: string, appId: string, accessToken: string) {
    if (!wabaId || !appId || !accessToken) {
        return { error: 'WABA ID, App ID, and Access Token are required.' };
    }
    
    try {
        await axios.post(
            `https://graph.facebook.com/${API_VERSION}/${wabaId}/subscribed_apps`,
            { app_id: appId, subscribed_fields: 'messages' },
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        return { success: true };
    } catch (e: any) {
        // If it's already subscribed, that's not a critical error.
        if(getErrorMessage(e).includes('already subscribed')) {
            return { success: true, message: 'App is already subscribed.' };
        }
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getWebhookSubscriptionStatus(wabaId: string, accessToken: string): Promise<{ isActive: boolean; error?: string }> {
  try {
    const response = await axios.get(
      `https://graph.facebook.com/${API_VERSION}/${wabaId}/subscribed_apps`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const subscribedApps = response.data.data;
    // For simplicity, we assume there's only one app. In a real scenario, you'd find your app ID.
    const isActive = subscribedApps && subscribedApps.length > 0;
    return { isActive };
  } catch (e: any) {
    console.error('Failed to get webhook status:', e);
    return { isActive: false, error: getErrorMessage(e) };
  }
}

export async function handleUpdatePhoneNumberProfile(prevState: any, formData: FormData) {
    const projectId = formData.get('projectId') as string;
    const phoneNumberId = formData.get('phoneNumberId') as string;

    const project = await getProjectById(projectId);
    if (!project) return { error: 'Project not found' };
    
    const payload: { [key: string]: any } = {
        messaging_product: 'whatsapp',
        about: formData.get('about'),
        address: formData.get('address'),
        description: formData.get('description'),
        email: formData.get('email'),
        vertical: formData.get('vertical'),
        websites: [formData.get('websites'), formData.getAll('websites')[1]].filter(Boolean),
    };
    
    const profilePictureFile = formData.get('profilePicture') as File;

    try {
        if (profilePictureFile && profilePictureFile.size > 0) {
            const form = new FormData();
            form.append('file', profilePictureFile);
            
            const uploadResponse = await axios.post(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/media`, form, {
                headers: {
                    'Authorization': `Bearer ${project.accessToken}`,
                },
            });

            if (uploadResponse.data.h) {
                payload.profile_picture_handle = uploadResponse.data.h;
            } else {
                throw new Error("Media upload succeeded but no handle was returned.");
            }
        }
        
        await axios.post(
            `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}`,
            payload,
            { headers: { 'Authorization': `Bearer ${project.accessToken}` } }
        );

        revalidatePath('/dashboard/numbers');
        return { message: 'Profile updated successfully. Changes may take a few minutes to appear.' };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


export async function getPublicProjectById(projectId: string) {
    if (!ObjectId.isValid(projectId)) return null;
    const { db } = await connectToDatabase();
    return db.collection('projects').findOne({ _id: new ObjectId(projectId) }, { projection: { name: 1, widgetSettings: 1, phoneNumbers: 1 } });
}

export async function findOrCreateContact(
  projectId: string,
  phoneNumberId: string,
  waId: string
): Promise<{ contact: WithId<Contact> | null; error?: string }> {
  const { db } = await connectToDatabase();

  try {
    const existingContact = await db.collection<Contact>('contacts').findOne({
      projectId: new ObjectId(projectId),
      waId: waId,
    });

    if (existingContact) {
      return { contact: existingContact };
    }

    const newContact: Omit<Contact, '_id'> = {
      projectId: new ObjectId(projectId),
      phoneNumberId,
      name: waId, // Default name to waId
      waId,
      status: 'new',
      createdAt: new Date(),
    };

    const result = await db.collection('contacts').insertOne(newContact as any);
    const createdContact = await db.collection<Contact>('contacts').findOne({ _id: result.insertedId });
    
    return { contact: createdContact as WithId<Contact> };

  } catch (error) {
    return { contact: null, error: getErrorMessage(error) };
  }
}

export async function handleSendMessage(
    prevState: any, 
    data: { [key: string]: any }
): Promise<{ message?: string; error?: string }> {
    const { contactId, projectId, phoneNumberId, waId, messageText, mediaFile, replyToWamid } = data;
    const session = await getSession();
    if (!session?.user) return { error: "Authentication required." };
    
    const project = await getProjectById(projectId);
    if (!project) return { error: "Project not found." };
    const { accessToken } = project;

    try {
        let payload: any = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: waId,
        };
        
        if (replyToWamid) {
            payload.context = { message_id: replyToWamid };
        }

        if (mediaFile && mediaFile.content) {
            const form = new FormData();
            const buffer = Buffer.from(mediaFile.content, 'base64');
            form.append('file', buffer, { filename: mediaFile.name, contentType: mediaFile.type });
            form.append('messaging_product', 'whatsapp');
            
            const uploadResponse = await axios.post(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/media`, form, {
                headers: { 'Authorization': `Bearer ${accessToken}` },
            });
            
            const mediaId = uploadResponse.data.id;
            const type = mediaFile.type.split('/')[0];
            payload.type = type;
            payload[type] = { id: mediaId, ...(type === 'document' && { filename: mediaFile.name }) };
            
            if (mediaFile.caption) {
                payload[type].caption = mediaFile.caption;
            }

        } else {
             payload.type = "text";
             payload.text = { preview_url: true, body: messageText };
        }

        const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`, payload, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        const wamid = response.data?.messages?.[0]?.id;
        if (!wamid) throw new Error('Message sent but no WAMID returned from Meta.');

        const now = new Date();
        const { db } = await connectToDatabase();
        await db.collection('outgoing_messages').insertOne({
            direction: 'out', contactId: new ObjectId(contactId), projectId: new ObjectId(projectId), wamid, messageTimestamp: now,
            type: payload.type, content: { text: payload.text }, status: 'sent', statusTimestamps: { sent: now }, createdAt: now,
        } as OutgoingMessage);
        
        await db.collection('contacts').updateOne({ _id: new ObjectId(contactId) }, { $set: { lastMessage: messageText.substring(0, 50), lastMessageTimestamp: now, status: 'open' } });
        
        revalidatePath('/dashboard/chat');
        return { message: 'Message sent.' };
        
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function handleRequestWhatsAppPayment(prevState: any, formData: FormData) {
    const { contactId, amount, description, externalReference } = Object.fromEntries(formData.entries());
    const session = await getSession();
    if (!session?.user) return { error: "Authentication required." };
    
    if (!contactId || !amount || !description) return { error: "Missing required fields." };
    
    const { db } = await connectToDatabase();
    const contact = await db.collection<Contact>('contacts').findOne({ _id: new ObjectId(contactId as string) });
    if (!contact) return { error: "Contact not found." };
    
    const project = await getProjectById(contact.projectId.toString());
    if (!project || !project.paymentConfiguration) return { error: "Project or payment configuration not found." };

    try {
        const payload = {
            "messaging_product": "whatsapp",
            "to": contact.waId,
            "type": "interactive",
            "interactive": {
                "type": "payment",
                "payment": {
                    "payment_configuration_name": project.paymentConfiguration.configuration_name,
                    "payment_request": {
                        "currency": "INR",
                        "total_amount": {
                            "value": parseFloat(amount as string),
                            "offset": 100
                        },
                        "line_items": [
                            {
                                "name": description,
                                "amount": {
                                    "value": parseFloat(amount as string),
                                    "offset": 100
                                }
                            }
                        ],
                        ...(externalReference && { "reference_id": externalReference })
                    }
                }
            }
        };

        await axios.post(
            `https://graph.facebook.com/${API_VERSION}/${contact.phoneNumberId}/messages`,
            payload,
            { headers: { Authorization: `Bearer ${project.accessToken}` } }
        );
        
        return { message: "Payment request sent successfully." };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getPaymentRequests(projectId: string, phoneNumberId: string) {
    const project = await getProjectById(projectId);
    if (!project) return { error: "Project not found" };

    try {
        const response = await axios.get(
            `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/payment_requests`,
            { headers: { Authorization: `Bearer ${project.accessToken}` } }
        );
        return { requests: response.data.data };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function handleSendCatalogMessage(prevState: any, formData: FormData) {
    const { contactId, projectId, headerText, bodyText, footerText, productRetailerIds } = Object.fromEntries(formData.entries());

    if (!contactId || !projectId || !bodyText || !productRetailerIds) {
        return { error: "Missing required fields." };
    }

    const project = await getProjectById(projectId as string);
    if (!project || !project.connectedCatalogId) return { error: 'Project or connected catalog not found.' };

    const contact = await (await connectToDatabase()).db.collection('contacts').findOne({ _id: new ObjectId(contactId as string) });
    if (!contact) return { error: 'Contact not found.' };
    
    try {
        const productSections = [{
            "title": "Our Products",
            "product_items": (productRetailerIds as string).split(',').map(id => ({ product_retailer_id: id.trim() })),
        }];

        const payload = {
            "messaging_product": "whatsapp",
            "to": contact.waId,
            "type": "interactive",
            "interactive": {
                "type": "product_list",
                "header": { "type": "text", "text": headerText },
                "body": { "text": bodyText },
                "footer": { "text": footerText },
                "action": {
                    "catalog_id": project.connectedCatalogId,
                    "sections": productSections,
                }
            }
        };
        
        await axios.post(
            `https://graph.facebook.com/${API_VERSION}/${contact.phoneNumberId}/messages`,
            payload,
            { headers: { Authorization: `Bearer ${project.accessToken}` } }
        );

        return { message: "Catalog message sent successfully." };

    } catch(e: any) {
        return { error: getErrorMessage(e) };
    }
}


export async function registerPhoneNumber(projectId: string, phoneNumberId: string): Promise<{ success: boolean; message?: string; error?: string; }> {
    const project = await getProjectById(projectId);
    if (!project) return { success: false, error: 'Project not found.' };

    try {
        const response = await axios.post(
            `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/register`,
            {
                messaging_product: 'whatsapp',
                pin: '123456' // PIN is required for this call
            },
            { headers: { Authorization: `Bearer ${project.accessToken}` } }
        );
        if (response.data.success) {
            await handleSyncPhoneNumbers(projectId);
            revalidatePath('/dashboard/numbers');
            return { success: true, message: 'Registration request sent successfully.' };
        }
        return { success: false, error: 'Registration failed. The number might already be registered.' };
    } catch(e) {
        const errorMessage = getErrorMessage(e);
        if (errorMessage.includes('already been registered')) {
             await handleSyncPhoneNumbers(projectId);
             revalidatePath('/dashboard/numbers');
             return { success: true, message: 'Number is already registered.' };
        }
        return { success: false, error: errorMessage };
    }
}

export async function _createProjectFromWaba(
    userId: string,
    wabaId: string,
    accessToken: string,
    wabaName: string,
    appId: string,
    businessId?: string,
    businessCaps?: BusinessCapabilities,
    includeCatalog?: boolean
): Promise<WithId<Project>> {
    const { db } = await connectToDatabase();
    const defaultPlan = await db.collection('plans').findOne({ isDefault: true });

    const projectData: Partial<Project> = {
      userId: new ObjectId(userId),
      name: wabaName,
      wabaId,
      businessId,
      appId,
      accessToken,
      phoneNumbers: [],
      messagesPerSecond: 80,
      planId: defaultPlan?._id,
      credits: defaultPlan?.signupCredits || 0,
      businessCapabilities: businessCaps,
      hasCatalogManagement: includeCatalog && !!businessId,
    };
    
    await db.collection<Project>('projects').updateOne(
      { userId: projectData.userId, wabaId: projectData.wabaId },
      {
        $set: projectData,
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );
    
    const existingProject = await db.collection<Project>('projects').findOne({ userId: projectData.userId, wabaId: projectData.wabaId });

    if (!existingProject) {
        throw new Error("Failed to create or find project after update.");
    }
    
    return existingProject;
}
