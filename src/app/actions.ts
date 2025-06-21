'use server';

import { suggestTemplateContent } from '@/ai/flows/template-content-suggestions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import Papa from 'papaparse';
import { revalidatePath } from 'next/cache';

export async function handleSuggestContent(topic: string): Promise<{ suggestions?: string[]; error?: string }> {
  if (!topic) {
    return { error: 'Topic cannot be empty.' };
  }

  try {
    const result = await suggestTemplateContent({ topic });
    return { suggestions: result.suggestions };
  } catch (e) {
    console.error(e);
    return { error: 'Failed to generate suggestions. Please try again.' };
  }
}

export async function getProjects() {
    try {
        const { db } = await connectToDatabase();
        const projects = await db.collection('projects').find({}).sort({ name: 1 }).toArray();
        return projects;
    } catch (error) {
        console.error("Failed to fetch projects:", error);
        return [];
    }
}

type CreateProjectState = {
  message?: string | null;
  error?: string | null;
};

export async function handleCreateProject(
  prevState: CreateProjectState,
  formData: FormData
): Promise<CreateProjectState> {
    const name = formData.get('name') as string;
    const appId = formData.get('appId') as string;
    const phoneNumberId = formData.get('phoneNumberId') as string;
    const accessToken = formData.get('accessToken') as string;

    if (!name || !appId || !phoneNumberId || !accessToken) {
        return { error: 'All fields are required.' };
    }

    try {
        const response = await fetch(
            `https://graph.facebook.com/v20.0/${phoneNumberId}?access_token=${accessToken}`,
            { method: 'GET' }
        );

        if (!response.ok) {
            const errorData = await response.json();
            const reason = errorData?.error?.message || 'Invalid credentials or API error.';
            return { error: `Verification failed: ${reason}` };
        }
    } catch (e: any) {
        return { error: `Failed to connect to WhatsApp API for verification: ${e.message}` };
    }

    try {
        const { db } = await connectToDatabase();
        await db.collection('projects').insertOne({
            name,
            appId,
            phoneNumberId,
            accessToken,
            createdAt: new Date(),
        });
        
        revalidatePath('/dashboard');

        return { message: `Project "${name}" created successfully!` };

    } catch (e: any) {
        console.error('Project creation failed:', e);
        if (e.code === 11000) {
            return { error: `A project with these details might already exist.` };
        }
        return { error: e.message || 'An unexpected error occurred while saving the project.' };
    }
}


type BroadcastState = {
  message?: string | null;
  error?: string | null;
};

export async function handleStartBroadcast(
  prevState: BroadcastState,
  formData: FormData
): Promise<BroadcastState> {
  const projectId = formData.get('projectId') as string;

  if (!projectId) {
    return { error: 'No project selected. Please go to the dashboard and select a project first.' };
  }

  const { db } = await connectToDatabase();
  const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });

  if (!project) {
    return { error: 'Selected project not found. It may have been deleted.' };
  }
  
  const accessToken = project.accessToken;
  const phoneNumberId = project.phoneNumberId;

  const templateId = formData.get('templateId') as string;
  const csvFile = formData.get('csvFile') as File;

  if (!templateId) return { error: 'Please select a message template.' };
  if (!csvFile || csvFile.size === 0) return { error: 'Please upload a CSV file.' };

  try {
    const template = await db.collection('templates').findOne({ _id: new ObjectId(templateId) });
    if (!template) return { error: 'Selected template not found.' };

    const csvText = await csvFile.text();
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });

    const contacts = parsed.data as Record<string, string>[];

    if (contacts.length === 0) {
      return { error: 'CSV file is empty or invalid.' };
    }

    const firstRow = contacts[0];
    if (!firstRow || !('phone' in firstRow)) {
      return { error: 'CSV must contain a "phone" column header.' };
    }

    const validContacts = contacts.filter((c) => c.phone && c.phone.trim() !== '');

    if (validContacts.length === 0) {
      return { error: 'No valid contacts with phone numbers found in the CSV.' };
    }

    const variableMatches = template.body.match(/{{(\d+)}}/g);
    const requiredVarNumbers = variableMatches ? [...new Set(variableMatches.map(v => parseInt(v.match(/(\d+)/)![1])))] : [];
    
    for (const varNum of requiredVarNumbers) {
        if (!(`variable${varNum}` in firstRow)) {
            return { error: `Template requires variable {{${varNum}}}, but CSV is missing a "variable${varNum}" column header.` };
        }
    }
    
    let successCount = 0;
    let failedSends: { phone: string; reason: string }[] = [];

    const sendPromises = validContacts.map(async (contact) => {
        const components = [];
        if (requiredVarNumbers.length > 0) {
            const parameters = requiredVarNumbers.sort((a,b) => a - b).map(varNum => ({
                type: 'text',
                text: contact[`variable${varNum}`] || '',
            }));
            components.push({
                type: 'body',
                parameters: parameters,
            });
        }

        const messageData = {
            messaging_product: 'whatsapp',
            to: contact.phone,
            type: 'template',
            template: {
                name: template.name,
                language: { code: 'en_US' },
                ...(components.length > 0 && { components }),
            },
        };
        
        try {
            const response = await fetch(
              `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(messageData),
              }
            );

            if (response.ok) {
                successCount++;
            } else {
                const errorData = await response.json();
                const reason = errorData?.error?.message || 'Unknown API error';
                failedSends.push({ phone: contact.phone, reason });
                console.error(`Failed to send message to ${contact.phone}:`, reason);
            }
        } catch(e: any) {
            const reason = e.message || 'Exception during fetch';
            failedSends.push({ phone: contact.phone, reason });
            console.error(`Exception sending message to ${contact.phone}:`, e);
        }
    });

    await Promise.all(sendPromises);

    const errorCount = failedSends.length;
    let status: 'Completed' | 'Partial Failure' | 'Failed' | 'Processing';
    if (errorCount > 0) {
      status = successCount > 0 ? 'Partial Failure' : 'Failed';
    } else {
      status = 'Completed';
    }

    await db.collection('broadcasts').insertOne({
      projectId: new ObjectId(projectId),
      templateId: new ObjectId(templateId),
      templateName: template.name,
      fileName: csvFile.name,
      contactCount: validContacts.length,
      successCount: successCount,
      errorCount: errorCount,
      status: status,
      createdAt: new Date(),
    });

    if (errorCount > 0) {
        const errorMessage = `Broadcast finished with ${errorCount} failure(s). ${successCount} messages sent successfully. Check server logs for details.`;
        return { error: errorMessage };
    }

    return { message: `Broadcast successfully sent to ${successCount} contacts.` };

  } catch (e: any) {
    console.error('Broadcast failed:', e);
    return { error: e.message || 'An unexpected error occurred while processing the broadcast.' };
  }
}
