
'use server';

import { revalidatePath } from 'next/cache';
import type { WithId } from 'mongodb';
import { ObjectId } from 'mongodb';
import axios from 'axios';
import FormData from 'form-data';

import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById, getAdminSession } from '@/app/actions/index.ts';
import { getErrorMessage } from '@/lib/utils';
import { premadeTemplates } from '@/lib/premade-templates';
import type { Project, Template, CreateTemplateState, MetaTemplate, MetaTemplatesResponse, LibraryTemplate, TemplateCategory } from '@/lib/definitions';

const API_VERSION = 'v23.0';

export async function getTemplates(projectId: string): Promise<WithId<Template>[]> {
    if (!projectId || !ObjectId.isValid(projectId)) {
        return [];
    }

    try {
        const { db } = await connectToDatabase();
        const project = await getProjectById(projectId);
        if (!project) return [];
        
        const templates = await db.collection('templates').find({ projectId: new ObjectId(projectId) }).sort({ createdAt: -1 }).toArray();

        return JSON.parse(JSON.stringify(templates));
    } catch (error) {
        console.error("Failed to fetch templates:", error);
        return [];
    }
}

export async function handleSyncTemplates(projectId: string): Promise<{ message?: string, error?: string, count?: number }> {
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Project not found or you do not have access.' };

    try {
        const { db } = await connectToDatabase();
        
        const { wabaId, accessToken } = project;

        const allTemplates: MetaTemplate[] = [];
        let nextUrl: string | undefined = `https://graph.facebook.com/${API_VERSION}/${wabaId}/message_templates?access_token=${accessToken}&fields=name,components,language,status,category,id,quality_score&limit=100`;

        while(nextUrl) {
            const response = await fetch(nextUrl, { method: 'GET' });

            if (!response.ok) {
                let reason = 'Unknown API Error';
                try {
                    const errorData = await response.json();
                    reason = errorData?.error?.message || reason;
                } catch (e) {
                    reason = `Could not parse error response from Meta. Status: ${response.status} ${response.statusText}`;
                }
                return { error: `Failed to fetch templates from Meta: ${reason}` };
            }

            const templatesResponse: MetaTemplatesResponse = await response.json();
            
            if (templatesResponse.data && templatesResponse.data.length > 0) {
                allTemplates.push(...templatesResponse.data);
            }

            nextUrl = templatesResponse.paging?.next;
        }
        
        if (allTemplates.length === 0) {
            return { message: "No templates found in your WhatsApp Business Account to sync." }
        }

        const templatesToUpsert = allTemplates.map(t => {
            const bodyComponent = t.components.find(c => c.type === 'BODY');
            const headerComponent = t.components.find(c => c.type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(c.format || ''));
            
            return {
                name: t.name,
                category: t.category,
                language: t.language,
                status: t.status,
                body: bodyComponent?.text || '',
                projectId: new ObjectId(projectId),
                metaId: t.id,
                components: t.components,
                qualityScore: t.quality_score?.score?.toUpperCase() || 'UNKNOWN',
                headerSampleUrl: headerComponent?.example?.header_handle?.[0] ? `https://graph.facebook.com/${headerComponent.example.header_handle[0]}` : undefined
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


async function getMediaHandleForTemplate(file: File | null, url: string | null, accessToken: string, appId: string): Promise<{ handle: string | null; error?: string; }> {
    if (!file && !url) return { handle: null, error: undefined };

    try {
        let mediaData: Buffer;
        let fileType: string;
        let fileLength: number;

        if (file && file.size > 0) {
            mediaData = Buffer.from(await file.arrayBuffer());
            fileType = file.type;
            fileLength = file.size;
        } else if (url) {
            const mediaResponse = await axios.get(url, { responseType: 'arraybuffer' });
            mediaData = Buffer.from(mediaResponse.data);
            fileType = mediaResponse.headers['content-type'] || 'application/octet-stream';
            fileLength = mediaData.length;
        } else {
            return { handle: null, error: undefined };
        }

        const sessionUrl = `https://graph.facebook.com/${API_VERSION}/${appId}/uploads?file_length=${fileLength}&file_type=${fileType}&access_token=${accessToken}`;
        const sessionResponse = await axios.post(sessionUrl, {});
        const uploadSessionId = sessionResponse.data.id;

        const uploadUrl = `https://graph.facebook.com/${API_VERSION}/${uploadSessionId}`;
        const uploadResponse = await axios.post(uploadUrl, mediaData, { headers: { Authorization: `OAuth ${accessToken}` } });
        return { handle: uploadResponse.data.h, error: undefined };
    } catch (uploadError: any) {
        const errorMessage = getErrorMessage(uploadError);
        return { handle: null, error: `Media upload failed: ${errorMessage}` };
    }
}
  
export async function handleCreateTemplate(
    prevState: CreateTemplateState,
    formData: FormData
  ): Promise<CreateTemplateState> {

    const cleanText = (text: string | null | undefined): string => {
        if (!text) return '';
        return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    };

    try {
        const projectId = formData.get('projectId') as string;
        if (!projectId || !ObjectId.isValid(projectId)) {
            return { error: 'Invalid Project ID.' };
        }
    
        const project = await getProjectById(projectId);
        if (!project) {
            return { error: 'Project not found or you do not have access.' };
        }
        
        const { db } = await connectToDatabase();
        const templateType = formData.get('templateType') as string;

        if (templateType === 'CATALOG_MESSAGE') {
            const name = formData.get('templateName') as string;
            const catalogId = formData.get('catalogId') as string;
            const headerText = formData.get('carouselHeader') as string;
            const bodyText = formData.get('carouselBody') as string;
            const footerText = formData.get('carouselFooter') as string;
            const section1Title = formData.get('section1Title') as string;
            const section1ProductIDs = (formData.get('section1ProductIDs') as string).split('\n').map(id => id.trim()).filter(Boolean);
            const section2Title = formData.get('section2Title') as string;
            const section2ProductIDs = (formData.get('section2ProductIDs') as string).split('\n').map(id => id.trim()).filter(Boolean);

            if (!name || !catalogId || !bodyText || !section1Title || section1ProductIDs.length === 0 || !section2Title || section2ProductIDs.length === 0) {
                return { error: 'For Carousel templates, you must provide a name, catalog ID, body text, and at least one product for each of the two sections.' };
            }
            
            const carouselTemplateData = {
                type: 'CATALOG_MESSAGE',
                name,
                category: 'INTERACTIVE', 
                status: 'LOCAL',
                language: 'multi',
                projectId: new ObjectId(projectId),
                components: [
                    { type: 'BODY', text: bodyText },
                    { 
                        type: 'CATALOG_MESSAGE_ACTION',
                        headerText,
                        footerText,
                        catalogId,
                        sections: [
                            { title: section1Title, products: section1ProductIDs.map(id => ({ product_retailer_id: id })) },
                            { title: section2Title, products: section2ProductIDs.map(id => ({ product_retailer_id: id })) }
                        ]
                    }
                ],
                createdAt: new Date(),
            };

            await db.collection('templates').insertOne(carouselTemplateData as any);
            revalidatePath('/dashboard/templates');
            return { message: 'Product Carousel template saved successfully.' };
        }
        
        const appId = project.appId || process.env.NEXT_PUBLIC_META_APP_ID;
        if (!appId) {
            return { error: 'App ID is not configured for this project, and no fallback is set in environment variables. Please set NEXT_PUBLIC_META_APP_ID in the .env file or re-configure the project.' };
        }

        const name = (formData.get('name') as string || '').trim();
        const nameRegex = /^[a-z0-9_]+$/;

        if (!name) {
            return { error: 'Template name is required.' };
        }
        if (name.length > 512) {
            return { error: 'Template name cannot exceed 512 characters.' };
        }
        if (!nameRegex.test(name)) {
            return { error: 'Template name can only contain lowercase letters, numbers, and underscores (_).' };
        }

        const category = formData.get('category') as 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
        const language = formData.get('language') as string;

         if (!category || !language) {
            return { error: 'Language, and Category are required.' };
        }
        
        const { wabaId, accessToken } = project;
        let payload: any = {
            name,
            language,
            category,
            allow_category_change: true,
            components: []
        };
        let finalTemplateToInsert: any = {
            name: payload.name, category, language, qualityScore: 'UNKNOWN',
            projectId: new ObjectId(projectId),
        };

        if (templateType === 'MARKETING_CAROUSEL') {
            const cardsDataString = formData.get('carouselCards') as string;
            const cardsData = JSON.parse(cardsDataString);
            
            finalTemplateToInsert.type = 'MARKETING_CAROUSEL';

            const mediaUploadResults = await Promise.all(
                cardsData.map(async (card: any, index: number) => {
                    const file = formData.get(`card_${index}_headerSampleFile`) as File;
                    if (card.headerFormat !== 'NONE' && file && file.size > 0) {
                        return await getMediaHandleForTemplate(file, null, accessToken, appId);
                    }
                    return { handle: null, error: null };
                })
            );
            
            const finalCards = [];

            for (let i = 0; i < cardsData.length; i++) {
                const card = cardsData[i];
                const uploadResult = mediaUploadResults[i];
                if(uploadResult.error) return { error: `Card ${i+1} media error: ${uploadResult.error}` };

                const cardComponents: any[] = [];
                if (uploadResult.handle && card.headerFormat !== 'NONE') {
                    cardComponents.push({ type: 'HEADER', format: card.headerFormat, example: { header_handle: [uploadResult.handle] }});
                }
                cardComponents.push({ type: 'BODY', text: card.body });
                if (card.buttons && card.buttons.length > 0) {
                    const formattedButtons = card.buttons.map((b: any) => ({ type: b.type, text: b.text, ...(b.url && { url: b.url }) }));
                    cardComponents.push({ type: 'BUTTONS', buttons: formattedButtons });
                }
                finalCards.push({ components: cardComponents });
            }
            
            payload.components.push({ type: 'CAROUSEL', cards: finalCards });
            
        } else { 
            const bodyText = cleanText(formData.get('body') as string);
            const footerText = cleanText(formData.get('footer') as string);
            const buttonsJson = formData.get('buttons') as string;
            const headerFormat = formData.get('headerFormat') as string;
            const headerText = cleanText(formData.get('headerText') as string);
            const headerSampleFile = formData.get('headerSampleFile') as File;
            const headerSampleUrl = (formData.get('headerSampleUrl') as string || '').trim();
            finalTemplateToInsert.body = bodyText;
            finalTemplateToInsert.headerSampleUrl = headerSampleUrl;

            const buttons = (buttonsJson ? JSON.parse(buttonsJson) : []).map((button: any) => ({
                ...button,
                text: cleanText(button.text),
                url: (button.url || '').trim(),
                phone_number: (button.phone_number || '').trim(),
                example: Array.isArray(button.example) ? button.example.map((ex: string) => (ex || '').trim()) : button.example,
            }));

            if (!bodyText) return { error: 'Body text is required for standard templates.' };
            
            if (headerFormat !== 'NONE') {
                const headerComponent: any = { type: 'HEADER', format: headerFormat };
                if (headerFormat === 'TEXT') {
                    if (!headerText) return { error: 'Header text is required for TEXT header format.' };
                    headerComponent.text = headerText;
                    if (headerText.match(/{{\s*(\d+)\s*}}/g)) headerComponent.example = { header_text: ['example_header_var'] };
                } else {
                    const { handle, error } = await getMediaHandleForTemplate(headerSampleFile, headerSampleUrl, accessToken, appId);
                    if(error) return { error };
                    if(handle) headerComponent.example = { header_handle: [handle] };
                }
                payload.components.push(headerComponent);
            }
            
            const bodyComponent: any = { type: 'BODY', text: bodyText };
            if (bodyText.match(/{{\s*(\d+)\s*}}/g)) bodyComponent.example = { body_text: [['example_body_var']] };
            payload.components.push(bodyComponent);

            if (footerText) payload.components.push({ type: 'FOOTER', text: footerText });
            if (buttons.length > 0) {
                const formattedButtons = buttons.map((button: any) => ({ type: button.type, text: button.text, ...(button.url && { url: button.url, example: button.example }), ...(button.phone_number && { phone_number: button.phone_number }) }));
                payload.components.push({ type: 'BUTTONS', buttons: formattedButtons });
            }
        }
    
        const response = await fetch(
            `https://graph.facebook.com/${API_VERSION}/${wabaId}/message_templates`,
            {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            }
        );
    
        const responseText = await response.text();
        const responseData = responseText ? JSON.parse(responseText) : null;
    
        if (!response.ok) {
            const errorMessage = getErrorMessage({ response: { data: responseData }});
            return { error: `API Error: ${errorMessage}`, payload: JSON.stringify(payload, null, 2) };
        }

        const newMetaTemplateId = responseData?.id;
        if (!newMetaTemplateId) {
            return { error: 'Template created on Meta, but no ID was returned. Please sync manually.' };
        }

        const templateToInsert = {
            ...finalTemplateToInsert,
            status: responseData?.status || 'PENDING',
            metaId: newMetaTemplateId,
            components: payload.components,
        };

        await db.collection('templates').insertOne(templateToInsert as any);
    
        revalidatePath('/dashboard/templates');
    
        const message = `Template "${name}" submitted successfully!`;
        return { message };
  
    } catch (e: any) {
        console.error('Error in handleCreateTemplate:', e);
        return { error: e.message || 'An unexpected error occurred.' };
    }
}

export async function handleBulkCreateTemplate(
    prevState: CreateTemplateState,
    formData: FormData
): Promise<CreateTemplateState> {
    const projectIdsString = formData.get('projectIds') as string;
    const projectIds = projectIdsString.split(',');
    const { db } = await connectToDatabase();
    
    const cleanText = (text: string | null | undefined): string => {
        if (!text) return '';
        return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    };

    let successes = 0;
    const errors: string[] = [];
    
    try {
        const name = (formData.get('name') as string || '').trim();
        const category = formData.get('category') as 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
        const language = formData.get('language') as string;
        const bodyText = cleanText(formData.get('body') as string);
        const footerText = cleanText(formData.get('footer') as string);
        const buttonsJson = formData.get('buttons') as string;
        const headerFormat = formData.get('headerFormat') as string;
        const headerText = cleanText(formData.get('headerText') as string);
        const headerSampleFile = formData.get('headerSampleFile') as File;
        
        const buttons = (buttonsJson ? JSON.parse(buttonsJson) : []).map((button: any) => ({
            ...button, text: cleanText(button.text), url: (button.url || '').trim(),
            phone_number: (button.phone_number || '').trim(),
            example: Array.isArray(button.example) ? button.example.map((ex: string) => (ex || '').trim()) : button.example,
        }));
        
        let headerMediaDataUri: string | null = null;
        if (headerFormat && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat) && headerSampleFile && headerSampleFile.size > 0) {
            const buffer = Buffer.from(await headerSampleFile.arrayBuffer());
            headerMediaDataUri = `data:${headerSampleFile.type};base64,${buffer.toString('base64')}`;
        }
        
        const components: any[] = [];
        if (headerFormat !== 'NONE') {
            const headerComponent: any = { type: 'HEADER', format: headerFormat };
            if (headerFormat === 'TEXT') {
                headerComponent.text = headerText;
            }
            components.push(headerComponent);
        }
        components.push({ type: 'BODY', text: bodyText });
        if (footerText) components.push({ type: 'FOOTER', text: footerText });
        if (buttons.length > 0) {
            const formattedButtons = buttons.map((button: any) => ({
                type: button.type, text: button.text, ...(button.url && { url: button.url, example: button.example }), ...(button.phone_number && { phone_number: button.phone_number })
            }));
            components.push({ type: 'BUTTONS', buttons: formattedButtons });
        }


        for (const projectId of projectIds) {
            try {
                const projectObjectId = new ObjectId(projectId);
                
                await db.collection('templates').insertOne({
                    projectId: projectObjectId,
                    name, category, language,
                    body: bodyText,
                    components,
                    headerMediaDataUri,
                    status: 'LOCAL',
                    qualityScore: 'UNKNOWN',
                    createdAt: new Date()
                } as any);

                successes++;
            } catch (e: any) {
                const errorMessage = `Project ID ${projectId}: ${getErrorMessage(e)}`;
                console.warn(errorMessage);
                errors.push(errorMessage);
            }
        }
        
        let message = `Template saved as 'LOCAL' for ${successes} project(s). They will be submitted by the next cron run.`;
        if (errors.length > 0) {
            message += ` Failed on ${errors.length} project(s).`;
            return { error: `Errors:\n- ${errors.join('\n- ')}`, message };
        }

        revalidatePath('/dashboard/templates');
        return { message };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


export async function handleCreateFlowTemplate(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const flowId = formData.get('flowId') as string; 
    
    const templateName = formData.get('templateName') as string;
    const language = formData.get('language') as string;
    const category = formData.get('category') as 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
    const bodyText = formData.get('bodyText') as string;
    const buttonText = formData.get('buttonText') as string;

    if (!projectId || !flowId || !templateName || !language || !category || !bodyText || !buttonText) {
        return { error: 'All fields are required.' };
    }

    const project = await getProjectById(projectId);
    if (!project) {
        return { error: 'Project not found or you do not have access.' };
    }

    let payload: any = {
        name: templateName.toLowerCase().replace(/\s+/g, '_'),
        language,
        category,
        components: [
            {
                type: 'BODY',
                text: bodyText
            },
            {
                type: 'BUTTONS',
                buttons: [
                    {
                        type: 'FLOW',
                        text: buttonText,
                        flow_id: flowId
                    }
                ]
            }
        ]
    };

    try {
        const { wabaId, accessToken } = project;
        const response = await axios.post(
            `https://graph.facebook.com/${API_VERSION}/${wabaId}/message_templates`,
            payload,
            { headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
        );

        if (response.data.error) {
            throw new Error(getErrorMessage({ response: { data: response.data } }));
        }

        const newMetaTemplateId = response.data?.id;
        if (!newMetaTemplateId) {
            return { error: 'Template created on Meta, but no ID was returned. Please sync manually.' };
        }

        const { db } = await connectToDatabase();
        const templateToInsert: Omit<Template, '_id'> & { projectId: ObjectId } = {
            name: payload.name,
            category,
            language,
            status: response.data?.status || 'PENDING',
            metaId: newMetaTemplateId,
            components: payload.components,
            body: bodyText,
            projectId: new ObjectId(projectId),
            qualityScore: 'UNKNOWN',
        };

        await db.collection('templates').insertOne(templateToInsert as any);
        revalidatePath('/dashboard/templates');

        return { message: `Template "${templateName}" created successfully and is now pending approval.` };

    } catch (e: any) {
        console.error('Error creating flow template:', e);
        return { error: getErrorMessage(e) || 'An unexpected error occurred.' };
    }
}

export async function saveLibraryTemplate(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { error: 'Permission denied.' };
    
    const name = (formData.get('name') as string || '').trim();
    const nameRegex = /^[a-z0-9_]+$/;

    if (!name) {
        return { error: 'Template name is required.' };
    }
    if (name.length > 512) {
        return { error: 'Template name cannot exceed 512 characters.' };
    }
    if (!nameRegex.test(name)) {
        return { error: 'Template name can only contain lowercase letters, numbers, and underscores (_).' };
    }

    try {
        const templateData: LibraryTemplate = {
            name: name,
            category: formData.get('category') as Template['category'],
            language: formData.get('language') as string,
            body: formData.get('body') as string,
            components: JSON.parse(formData.get('components') as string),
            isCustom: true,
            createdAt: new Date(),
        };

        if (!templateData.category || !templateData.language || !templateData.body) {
            return { error: 'Category, language, and body are required.' };
        }

        const { db } = await connectToDatabase();
        await db.collection('library_templates').insertOne(templateData as any);

        revalidatePath('/admin/dashboard/template-library');
        revalidatePath('/dashboard/templates/library');
        return { message: `Template "${templateData.name}" added to the library.` };

    } catch (e: any) {
        console.error("Failed to save library template:", e);
        return { error: e.message || 'An unexpected error occurred.' };
    }
}

export async function deleteLibraryTemplate(id: string): Promise<{ message?: string; error?: string }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { error: 'Permission denied.' };

    if (!ObjectId.isValid(id)) return { error: 'Invalid template ID.' };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('library_templates').deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) {
            return { error: 'Could not find the custom library template to delete.' };
        }
        revalidatePath('/admin/dashboard/template-library');
        revalidatePath('/dashboard/templates/library');
        return { message: 'Custom template removed from the library.' };
    } catch (e: any) {
        return { error: e.message || 'An unexpected error occurred.' };
    }
}

export async function getLibraryTemplates() {
    try {
        const { db } = await connectToDatabase();
        const customTemplates = await db.collection('library_templates').find({}).sort({ name: 1 }).toArray();
        const allTemplates = [...premadeTemplates, ...customTemplates];
        return JSON.parse(JSON.stringify(allTemplates));
    } catch (e) {
        console.error("Failed to fetch library templates:", e);
        return premadeTemplates; 
    }
}

export async function handleApplyTemplateToProjects(sourceTemplateId: string, targetProjectIds: string[]): Promise<{ success: boolean, error?: string }> {
    if (!sourceTemplateId || targetProjectIds.length === 0) {
        return { success: false, error: 'Source template and target projects are required.' };
    }

    try {
        const { db } = await connectToDatabase();
        const sourceTemplate = await db.collection<Template>('templates').findOne({ _id: new ObjectId(sourceTemplateId) });

        if (!sourceTemplate) {
            return { success: false, error: 'Source template not found.' };
        }

        const bulkOps = targetProjectIds.map(projectId => {
            const newTemplate = {
                ...sourceTemplate,
                _id: new ObjectId(), // generate new ID
                projectId: new ObjectId(projectId),
                status: 'LOCAL', // Mark as local for the cron job to pick up
                metaId: '', // Clear meta ID as it's a new template for the target project
                createdAt: new Date(),
            };
            delete newTemplate.headerSampleUrl; // Don't copy sample URL directly

            return {
                updateOne: {
                    filter: { projectId: new ObjectId(projectId), name: sourceTemplate.name, language: sourceTemplate.language },
                    update: { $set: newTemplate },
                    upsert: true,
                }
            };
        });

        await db.collection('templates').bulkWrite(bulkOps);

        return { success: true };
    } catch (e: any) {
        console.error("Error applying template to projects:", e);
        return { success: false, error: getErrorMessage(e) };
    }
}

    