'use server';

import { suggestTemplateContent } from '@/ai/flows/template-content-suggestions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId, WithId } from 'mongodb';
import Papa from 'papaparse';
import { revalidatePath } from 'next/cache';
import type { PhoneNumber } from '@/app/dashboard/page';

type MetaPhoneNumber = {
    id: string;
    display_phone_number: string;
    verified_name: string;
    code_verification_status: string;
    quality_rating: string;
    platform_type?: string;
    throughput?: {
        level: string;
    };
};

type MetaPhoneNumbersResponse = {
    data: MetaPhoneNumber[];
    paging?: {
        cursors: {
            before: string;
            after: string;
        }
    }
};

type MetaTemplateComponent = {
    type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
    text?: string;
    format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO';
};

type MetaTemplate = {
    id: string;
    name: string;
    language: string;
    status: string;
    category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
    components: MetaTemplateComponent[];
};

type MetaTemplatesResponse = {
    data: MetaTemplate[];
    paging?: {
        cursors: {
            before: string;
            after: string;
        }
    }
};

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
        return JSON.parse(JSON.stringify(projects));
    } catch (error) {
        console.error("Failed to fetch projects:", error);
        return [];
    }
}

export async function getProjectById(projectId: string): Promise<WithId<any> | null> {
    if (!ObjectId.isValid(projectId)) {
        return null;
    }
    try {
        const { db } = await connectToDatabase();
        const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
        return JSON.parse(JSON.stringify(project));
    } catch (error) {
        console.error("Failed to fetch project:", error);
        return null;
    }
}


export async function getTemplates(projectId: string) {
    if (!ObjectId.isValid(projectId)) {
        return [];
    }
    try {
        const { db } = await connectToDatabase();
        const templates = await db.collection('templates').find({ projectId: new ObjectId(projectId) }).sort({ name: 1 }).toArray();
        return JSON.parse(JSON.stringify(templates));
    } catch (error) {
        console.error('Failed to fetch templates:', error);
        return [];
    }
}

export async function getBroadcasts() {
  try {
    const { db } = await connectToDatabase();
    const broadcasts = await db.collection('broadcasts').find({}).sort({ createdAt: -1 }).limit(10).toArray();
    return JSON.parse(JSON.stringify(broadcasts));
  } catch (error) {
    console.error('Failed to fetch broadcast history:', error);
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
    const wabaId = formData.get('wabaId') as string;
    const accessToken = formData.get('accessToken') as string;

    if (!name || !wabaId || !accessToken) {
        return { error: 'All fields are required.' };
    }
    
    let phoneNumbers: PhoneNumber[] = [];

    try {
        const response = await fetch(
            `https://graph.facebook.com/v18.0/${wabaId}/phone_numbers?access_token=${accessToken}`,
            { method: 'GET' }
        );

        if (!response.ok) {
            const errorData = await response.json();
            const reason = errorData?.error?.message || 'Invalid credentials or API error.';
            return { error: `Verification failed: ${reason}` };
        }
        
        const data: MetaPhoneNumbersResponse = await response.json();
        
        if (!data.data || data.data.length === 0) {
            return { error: 'Verification successful, but no phone numbers are associated with this Business Account ID.' };
        }

        phoneNumbers = data.data.map((num: MetaPhoneNumber) => ({
            id: num.id,
            display_phone_number: num.display_phone_number,
            verified_name: num.verified_name,
            code_verification_status: num.code_verification_status,
            quality_rating: num.quality_rating,
            platform_type: num.platform_type,
            throughput: num.throughput,
        }));

    } catch (e: any) {
        return { error: `Failed to connect to WhatsApp API for verification: ${e.message}` };
    }


    try {
        const { db } = await connectToDatabase();
        await db.collection('projects').insertOne({
            name,
            wabaId,
            accessToken,
            phoneNumbers,
            createdAt: new Date(),
        });
        
        revalidatePath('/dashboard');

        return { message: `Project "${name}" created successfully with ${phoneNumbers.length} phone number(s)!` };

    } catch (e: any) {
        console.error('Project creation failed:', e);
        if (e.code === 11000) {
            return { error: `A project with this name or Business ID might already exist.` };
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
  const phoneNumberId = formData.get('phoneNumberId') as string;

  if (!projectId) {
    return { error: 'No project selected. Please go to the dashboard and select a project first.' };
  }
  
  if (!phoneNumberId) {
    return { error: 'No phone number selected. Please select a number to send the broadcast from.' };
  }

  const { db } = await connectToDatabase();
  const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });

  if (!project) {
    return { error: 'Selected project not found. It may have been deleted.' };
  }
  
  const accessToken = project.accessToken;

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
              `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
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

export async function handleSyncTemplates(projectId: string): Promise<{ message?: string, error?: string, count?: number }> {
    if (!ObjectId.isValid(projectId)) {
        return { error: 'Invalid Project ID.' };
    }

    try {
        const { db } = await connectToDatabase();
        const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });

        if (!project) {
            return { error: 'Project not found.' };
        }

        const { wabaId, accessToken } = project;

        const response = await fetch(
            `https://graph.facebook.com/v18.0/${wabaId}/message_templates?access_token=${accessToken}&fields=name,components,language,status,category,id`,
            { method: 'GET' }
        );

        if (!response.ok) {
            const errorData = await response.json();
            return { error: `Failed to fetch templates from Meta: ${errorData?.error?.message || 'Unknown API Error'}` };
        }

        const templatesResponse: MetaTemplatesResponse = await response.json();
        
        if (!templatesResponse.data || templatesResponse.data.length === 0) {
            return { message: "No templates found in your WhatsApp Business Account to sync." }
        }

        const templatesToUpsert = templatesResponse.data.map(t => {
            const bodyComponent = t.components.find(c => c.type === 'BODY');
            return {
                name: t.name,
                category: t.category,
                language: t.language,
                status: t.status,
                body: bodyComponent?.text || '',
                projectId: new ObjectId(projectId),
                metaId: t.id,
                components: t.components,
            };
        });

        const bulkOps = templatesToUpsert.map(template => ({
            updateOne: {
                filter: { metaId: template.metaId, projectId: template.projectId },
                update: { $set: template },
                upsert: true,
            }
        }));

        const result = await db.collection('templates').bulkWrite(bulkOps);
        const syncedCount = result.upsertedCount + result.modifiedCount;
        
        revalidatePath('/dashboard/templates');
        
        return { message: `Successfully synced ${syncedCount} template(s).`, count: syncedCount };

    } catch (e: any) {
        console.error('Template sync failed:', e);
        return { error: e.message || 'An unexpected error occurred during template sync.' };
    }
}

type CreateTemplateState = {
    message?: string | null;
    error?: string | null;
};
  
export async function handleCreateTemplate(
    prevState: CreateTemplateState,
    formData: FormData
  ): Promise<CreateTemplateState> {
    const projectId = formData.get('projectId') as string;
    const name = formData.get('templateName') as string;
    const category = formData.get('category') as 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
    const bodyText = formData.get('body') as string;
    const language = formData.get('language') as string;
    const buttonsJSON = formData.get('buttons') as string;

    const headerType = formData.get('headerType') as 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';
    const headerText = formData.get('headerText') as string;
    const headerMediaHandle = formData.get('headerMediaHandle') as string;
    const footerText = formData.get('footerText') as string;
  
    if (!projectId || !name || !category || !bodyText || !language) {
      return { error: 'Project, Name, Language, Category, and Body are required.' };
    }
  
    const project = await getProjectById(projectId);
    if (!project) {
      return { error: 'Project not found.' };
    }
    const { wabaId, accessToken } = project;
  
    const components: any[] = [];
  
    // Header Component
    if (headerType !== 'NONE') {
      const headerComponent: any = { type: 'HEADER' };
      if (headerType === 'TEXT') {
        if (!headerText) return { error: 'Header text is required.' };
        if (headerText.length > 60) return { error: 'Header text cannot exceed 60 characters.' };
        if (/{{(\d+)}}/.test(headerText) && category === 'AUTHENTICATION') {
            return { error: 'Variables are not allowed in headers for Authentication templates.' };
        }
        headerComponent.format = 'TEXT';
        headerComponent.text = headerText;
        if (/{{(\d+)}}/.test(headerText)) {
            headerComponent.example = { header_text: ['Example Header'] };
        }
      } else {
        if (!headerMediaHandle) return { error: `A media handle is required for ${headerType} header.` };
        headerComponent.format = headerType;
        headerComponent.example = { header_handle: [headerMediaHandle] };
      }
      components.push(headerComponent);
    }
  
    // Body Component
    const bodyComponent: any = { type: 'BODY', text: bodyText };
    const bodyVarMatches = bodyText.match(/{{(\d+)}}/g);
    if (bodyVarMatches) {
      const exampleParams = bodyVarMatches.map((_, i) => `example_var_${i + 1}`);
      bodyComponent.example = { body_text: [exampleParams] };
    }
    components.push(bodyComponent);
  
    // Footer Component
    if (footerText) {
      if (footerText.length > 60) return { error: 'Footer text cannot exceed 60 characters.' };
      if (/{{(\d+)}}/.test(footerText)) return { error: 'Variables are not allowed in the footer.' };
      components.push({ type: 'FOOTER', text: footerText });
    }

    // Buttons Component
    if (buttonsJSON) {
        const buttons = JSON.parse(buttonsJSON);
        if (buttons.length > 0) {
            const apiButtons = buttons.map((btn: any) => {
                const apiButton: any = {
                    type: btn.type,
                    text: btn.text,
                };
                if (btn.type === 'URL') {
                    apiButton.url = btn.url;
                    // Add example only if URL has a variable and an example is provided
                    if (btn.url?.includes('{{1}}') && btn.urlExample) {
                        apiButton.example = [btn.urlExample];
                    }
                }
                if (btn.type === 'PHONE_NUMBER') {
                    apiButton.phone_number = btn.phoneNumber;
                }
                return apiButton;
            });
            components.push({ type: 'BUTTONS', buttons: apiButtons });
        }
    }
  
    const payload = {
      name: name.toLowerCase().replace(/\s+/g, '_'),
      language,
      category,
      components,
    };
  
    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${wabaId}/message_templates`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );
  
      const responseData = await response.json();
  
      if (!response.ok) {
        return { error: `API Error: ${responseData?.error?.error_user_title || responseData?.error?.message || 'Unknown error'}` };
      }
  
      // Sync templates after successful creation
      await handleSyncTemplates(projectId);
      revalidatePath('/dashboard/templates');
  
      return { message: `Template "${name}" submitted successfully!` };
  
    } catch (e: any) {
      console.error('Template creation failed:', e);
      return { error: e.message || 'An unexpected error occurred.' };
    }
}

export async function handleUploadMedia(formData: FormData): Promise<{ handle?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const phoneNumberId = formData.get('phoneNumberId') as string;
    const file = formData.get('file') as File;

    if (!projectId || !phoneNumberId || !file) {
        return { error: 'Missing project ID, phone number ID, or file.' };
    }

    const project = await getProjectById(projectId);
    if (!project) {
        return { error: 'Project not found.' };
    }
    const { accessToken } = project;

    const uploadFormData = new FormData();
    uploadFormData.append('file', file);
    uploadFormData.append('messaging_product', 'whatsapp');
    
    try {
        const response = await fetch(
            `https://graph.facebook.com/v18.0/${phoneNumberId}/media`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
                body: uploadFormData,
            }
        );

        const data = await response.json();

        if (!response.ok) {
            return { error: `Media upload failed: ${data?.error?.message || 'Unknown API error'}` };
        }
        
        if (!data.id) {
            return { error: 'Media upload succeeded but did not return an ID.' };
        }

        return { handle: data.id };

    } catch (e: any) {
        console.error('Media upload exception:', e);
        return { error: e.message || 'An unexpected error occurred during media upload.' };
    }
}
