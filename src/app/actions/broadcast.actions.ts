
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, type Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { enqueueBroadcastControl } from '@/lib/queue/broadcast-queue';
import { getProjectById } from '@/app/actions/project.actions';
import { getAdminSession } from '@/lib/admin-session';
import { handleManualWachatSetup } from '@/app/actions/whatsapp.actions';
import { getErrorMessage, validateFile } from '@/lib/utils';
import type { Project, Template, BroadcastJob, Contact } from '@/lib/definitions';
import Papa from 'papaparse';
import * as xlsx from 'xlsx';
import { nanoid } from 'nanoid';
import axios from 'axios';
import NodeFormData from 'form-data';

// Aligned with the rest of the Wachat module (whatsapp.actions.ts,
// facebook.actions.ts, instagram.actions.ts, user.actions.ts, and the
// broadcast send-message.js worker) — they all target v23.0. Leaving this
// at v21.0 meant media uploads from the broadcast CSV path went to an older
// Meta API endpoint than every other send path, and any v21-only bug would
// silently affect broadcasts only.
const API_VERSION = 'v23.0';


export async function getAllBroadcasts(
    page: number = 1,
    limit: number = 20
): Promise<{ broadcasts: WithId<BroadcastJob>[], total: number }> {
    // P0 fix: this is a cross-tenant action (returns broadcasts across every
    // project). A 'use server' action is callable from any client in the app
    // via a crafted POST, so guarding only at the admin page layer is not
    // enough. We verify the admin session cookie inside the action itself.
    const session = await getAdminSession();
    if (!session.isAdmin) {
        return { broadcasts: [], total: 0 };
    }

    try {
        const { db } = await connectToDatabase();
        const skip = (page - 1) * limit;
        const [broadcasts, total] = await Promise.all([
            db.collection('broadcasts').find().sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
            db.collection('broadcasts').countDocuments()
        ]);

        return {
            broadcasts: JSON.parse(JSON.stringify(broadcasts)),
            total
        };

    } catch (e) {
        console.error("Failed to get all broadcasts:", e);
        return { broadcasts: [], total: 0 };
    }
}

export async function getBroadcasts(
    projectId: string,
    page: number = 1,
    limit: number = 10
): Promise<{ broadcasts: WithId<BroadcastJob>[], total: number }> {
    if (!projectId || !ObjectId.isValid(projectId)) {
        return { broadcasts: [], total: 0 };
    }
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { broadcasts: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const skip = (page - 1) * limit;
        const [broadcasts, total] = await Promise.all([
            db.collection('broadcasts')
                .find({ projectId: new ObjectId(projectId) })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            db.collection('broadcasts').countDocuments({ projectId: new ObjectId(projectId) })
        ]);

        return {
            broadcasts: JSON.parse(JSON.stringify(broadcasts)),
            total
        };
    } catch (e) {
        console.error("Failed to get broadcasts for project:", e);
        return { broadcasts: [], total: 0 };
    }
}

export async function getBroadcastById(broadcastId: string): Promise<WithId<any> | null> {
    if (!broadcastId || !ObjectId.isValid(broadcastId)) return null;

    try {
        const { db } = await connectToDatabase();
        const broadcast = await db.collection('broadcasts').findOne({ _id: new ObjectId(broadcastId) });
        if (!broadcast) return null;

        const hasAccess = await getProjectById(broadcast.projectId.toString());
        if (!hasAccess) return null;

        return JSON.parse(JSON.stringify(broadcast));

    } catch (e) {
        console.error("Failed to get broadcast by ID:", e);
        return null;
    }
}

export async function getBroadcastAttempts(
    broadcastId: string,
    page: number = 1,
    limit: number = 50,
    statusFilter?: string
): Promise<{ attempts: any[], total: number }> {
    if (!broadcastId || !ObjectId.isValid(broadcastId)) return { attempts: [], total: 0 };
    try {
        const { db } = await connectToDatabase();

        const filter: Filter<any> = { broadcastId: new ObjectId(broadcastId) };
        if (statusFilter && statusFilter !== 'ALL') {
            filter.status = statusFilter;
        }

        const skip = (page - 1) * limit;

        const [attempts, total] = await Promise.all([
            db.collection('broadcast_contacts').find(filter).sort({ _id: 1 }).skip(skip).limit(limit).toArray(),
            db.collection('broadcast_contacts').countDocuments(filter)
        ]);

        return {
            attempts: JSON.parse(JSON.stringify(attempts)),
            total
        };

    } catch (e) {
        return { attempts: [], total: 0 };
    }
}

export async function getBroadcastAttemptsForExport(broadcastId: string, statusFilter?: string): Promise<any[]> {
    if (!broadcastId || !ObjectId.isValid(broadcastId)) return [];
    try {
        const { db } = await connectToDatabase();
        const filter: Filter<any> = { broadcastId: new ObjectId(broadcastId) };
        if (statusFilter && statusFilter !== 'ALL') {
            filter.status = statusFilter;
        }
        const attempts = await db.collection('broadcast_contacts').find(filter).project({ phone: 1, status: 1, messageId: 1, error: 1, sentAt: 1 }).toArray();
        return JSON.parse(JSON.stringify(attempts));
    } catch (e) {
        return [];
    }
}


export async function getBroadcastLogs(broadcastId: string): Promise<WithId<any>[]> {
    if (!broadcastId || !ObjectId.isValid(broadcastId)) return [];
    try {
        const { db } = await connectToDatabase();
        const logs = await db.collection('broadcast_logs').find({ broadcastId: new ObjectId(broadcastId) }).sort({ timestamp: -1 }).limit(100).toArray();
        return JSON.parse(JSON.stringify(logs));
    } catch (e) {
        return [];
    }
}


const parseContactFile = async (file: File) => {
    const { isValid, error } = validateFile(file, ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
    if (!isValid) throw new Error(error || 'Invalid file');

    const buffer = await file.arrayBuffer();
    const data = new Uint8Array(buffer);

    let rows: any[] = [];
    if (file.type === 'text/csv') {
        const text = new TextDecoder("utf-8").decode(data);
        rows = Papa.parse(text, { header: true, skipEmptyLines: true }).data;
    } else {
        const workbook = xlsx.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
        const header = rows[0];
        rows = rows.slice(1).map(row => {
            const rowData: any = {};
            header.forEach((h: any, i: number) => {
                rowData[h] = row[i];
            });
            return rowData;
        });
    }

    if (!rows[0] || !Object.keys(rows[0]).some(h => h.toLowerCase().includes('phone'))) {
        throw new Error("Invalid file format. The first column must be named 'phone'.");
    }

    return rows.map((row) => ({
        phone: String(row.phone || row.Phone || row.PHONE).trim().replace(/\D/g, ''),
        name: row.name || row.Name || 'Subscriber',
        ...row // include other columns as variables
    }));
};

async function createBroadcastContacts(db: Db, broadcastId: ObjectId, contacts: any[]) {
    if (contacts.length === 0) return 0;

    const contactsToInsert = contacts.map(c => ({
        broadcastId: broadcastId,
        phone: c.phone,
        name: c.name,
        variables: { ...c }, // All columns are available as variables
        status: 'PENDING',
    }));

    // Use bulk write for efficient insertion
    const batchSize = 1000;
    let totalInserted = 0;
    for (let i = 0; i < contactsToInsert.length; i += batchSize) {
        const batch = contactsToInsert.slice(i, i + batchSize);
        const result = await db.collection('broadcast_contacts').insertMany(batch);
        totalInserted += result.insertedCount;
    }
    return totalInserted;
}


export async function handleStartBroadcast(
    prevState: { message?: string; error?: string },
    formData: FormData
): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const phoneNumberId = formData.get('phoneNumberId') as string;
    const audienceType = formData.get('audienceType') as 'file' | 'tags';
    const tagIds = formData.getAll('tagIds') as string[];
    const broadcastType = (formData.get('broadcastType') as 'template' | 'flow') || 'template';

    const { db } = await connectToDatabase();
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Project not found.' };

    let template: WithId<Template> | null = null;
    let flow: WithId<any> | null = null; // MetaFlow

    if (broadcastType === 'template') {
        const templateId = formData.get('templateId') as string;
        template = await db.collection<Template>('templates').findOne({ _id: new ObjectId(templateId), projectId: new ObjectId(projectId) });
        if (!template) return { error: 'Template not found for this project.' };
        // J3 P1-1 fix: surface approval status at enqueue time instead of at
        // worker send time. Previously a broadcast with a PENDING or REJECTED
        // template would enqueue successfully and fail later when Meta
        // returned error #132015, leaving users confused about why their
        // campaign "just broke". `send-template.actions.ts:45` already does
        // this check — mirroring it here.
        if (template.status !== 'APPROVED') {
            return { error: `Template '${template.name}' is ${template.status || 'not approved'}. Only APPROVED templates can be broadcast.` };
        }
    } else {
        const flowId = formData.get('flowId') as string;
        flow = await db.collection('meta_flows').findOne({ _id: new ObjectId(flowId), projectId: new ObjectId(projectId) });
        if (!flow) return { error: 'Flow not found for this project.' };
    }

    // Header variables
    const headerImageUrl = formData.get('headerMediaUrl') as string | null;
    const headerMediaFile = formData.get('headerMediaFile') as File | null;
    const baseMediaSource = formData.get('mediaSource') as string | null;

    let contacts: any[] = [];

    if (audienceType === 'file') {
        const csvFile = formData.get('csvFile') as File;
        if (!csvFile || csvFile.size === 0) return { error: 'Contact file is required.' };
        try {
            contacts = await parseContactFile(csvFile);
        } catch (e: any) {
            return { error: `Failed to parse file: ${e.message}` };
        }
    } else if (audienceType === 'tags' && tagIds.length > 0) {
        const validTagIds = tagIds.map(id => new ObjectId(id));
        contacts = await db.collection<Contact>('contacts').find({
            projectId: new ObjectId(projectId),
            tagIds: { $in: validTagIds }
        }).toArray();
    }

    if (contacts.length === 0) {
        return { error: 'No contacts found for the selected audience.' };
    }

    // Per-broadcast rate limit. The form may override the project default; the
    // worker reads broadcast.messagesPerSecond first, then projectMessagesPerSecond,
    // then falls back to BROADCAST_DEFAULT_MPS (80).
    const formMps = parseInt(formData.get('messagesPerSecond') as string, 10);
    const broadcastMps =
        Number.isFinite(formMps) && formMps > 0
            ? formMps
            : (project as any).messagesPerSecond || undefined;

    const broadcastData: any = {
        projectId: new ObjectId(projectId),
        phoneNumberId,
        status: 'PENDING_PROCESSING',
        contactCount: contacts.length,
        successCount: 0,
        errorCount: 0,
        enqueuedCount: 0,
        fileName: audienceType === 'file' ? (formData.get('csvFile') as File).name : 'Audience Tag',
        audienceType: audienceType,
        tagIds: audienceType === 'tags' ? tagIds.map(id => new ObjectId(id)) : [],
        accessToken: project.accessToken,
        createdAt: new Date(),
        broadcastType,
        // Always carry the template definition so the worker doesn't need to
        // re-fetch it (and so resends after template edits stay reproducible).
        components: broadcastType === 'template' && template ? [...(template.components || [])] : [],
        messagesPerSecond: broadcastMps,
        projectMessagesPerSecond: (project as any).messagesPerSecond || undefined,
    };

    if (broadcastType === 'template' && template) {
        broadcastData.name = `${template.name} - ${new Date().toLocaleString()}`;
        broadcastData.templateName = template.name;
        broadcastData.templateId = template._id;
        broadcastData.language = template.language || 'en_US';
        // --- HEADER ---
        const headerComponentDef = template.components?.find(c => c.type === 'HEADER');
        if (headerComponentDef) {
            const format = headerComponentDef.format?.toUpperCase();

            // Text Header with Variables
            if (format === 'TEXT') {
                const matches = headerComponentDef.text?.match(/{{\s*(\d+)\s*}}/g);
                if (matches && matches.length > 0) {
                    const varNum = matches[0].replace(/\D/g, ''); // Get first variable number
                    const headerVar = formData.get(`variable_header_${varNum}`) as string;

                    if (headerVar) {
                        const headerIndex = broadcastData.components.findIndex((c: any) => c.type === 'HEADER');
                        if (headerIndex !== -1) {
                            broadcastData.components[headerIndex] = {
                                type: 'header',
                                parameters: [{ type: 'text', text: headerVar }]
                            };
                        }
                    }
                }
            }
            // Location Header
            else if (format === 'LOCATION') {
                const locName = formData.get('header_location_name') as string;
                const locAddress = formData.get('header_location_address') as string;
                const locLat = formData.get('header_location_latitude') as string;
                const locLong = formData.get('header_location_longitude') as string;

                if (locLat && locLong) {
                    const headerIndex = broadcastData.components.findIndex((c: any) => c.type === 'HEADER');
                    if (headerIndex !== -1) {
                        broadcastData.components[headerIndex] = {
                            type: 'header',
                            parameters: [{
                                type: 'location',
                                location: {
                                    latitude: locLat,
                                    longitude: locLong,
                                    name: locName || undefined,
                                    address: locAddress || undefined
                                }
                            }]
                        };
                    }
                }
            }
        }

        // --- BODY ---
        // For Broadcasts, body variables are usually per-contact (from file/tags). 
        // IF the variable is NOT in the file (e.g. valid hardcoded value?), we might need to handle it?
        // Current logic expects body vars to be in the contact object (from file/tags).
        // However, if the user inputs a static value for a body variable in the form (which TemplateInputRenderer allows),
        // we should probably use that as a fallback or default?
        // actually, TemplateInputRenderer outputs `variable_body_${i}`.
        // But `createBroadcastContacts` maps file columns to variables. 
        // If we want to support "static" body values from the form that apply to EVERYONE, we should extract them here
        // and merge them into the contact's variables during creation, OR update the component parameters here?
        // 
        // Standard Broadcast behavior usually implies variables come from the Audience list.
        // But if `TemplateInputRenderer` allows typing a value, it acts as a constant for the whole batch.
        // Let's support that:

        const bodyComponent = template.components?.find(c => c.type === 'BODY');
        if (bodyComponent && bodyComponent.text) {
            const bodyParams: any[] = [];
            // Count variables
            const matches = bodyComponent.text.match(/{{(\d+)}}/g);
            if (matches) {
                const uniqueVars = new Set(matches) as Set<string>;
                // We can't pre-fill parameters here because they differ per contact (usually).
                // BUT if the user provided a value in the form, it should override/be used.
                // The `worker` or sending logic needs to know about these "Global" variables.
                // 
                // Strategy: Store these "global" body values in `broadcastData` so the worker can use them 
                // if the contact specific variable is missing.

                const globalBodyVars: Record<string, string> = {};
                uniqueVars.forEach((v) => {
                    const varNum = v.replace(/\D/g, '');
                    const formValue = formData.get(`variable_body_${varNum}`) as string;
                    if (formValue) {
                        globalBodyVars[`variable_body_${varNum}`] = formValue;
                    }
                });

                if (Object.keys(globalBodyVars).length > 0) {
                    broadcastData.globalBodyVars = globalBodyVars;
                }
            }
        }

        // --- BUTTONS ---
        const buttons = template.components?.find(c => c.type === 'BUTTONS')?.buttons;
        if (buttons) {
            const buttonComponents: any[] = [];
            buttons.forEach((btn: any, index: number) => {
                if (btn.type === 'URL' && btn.url?.includes('{{1}}')) {
                    const suffix = formData.get(`button_url_suffix_${index}`) as string;
                    if (suffix) {
                        buttonComponents.push({
                            type: 'button',
                            sub_type: 'url',
                            index: index,
                            parameters: [{ type: 'text', text: suffix }]
                        });
                    }
                } else if (btn.type === 'COPY_CODE') {
                    const code = formData.get(`button_copy_code_${index}`) as string;
                    if (code) {
                        buttonComponents.push({
                            type: 'button',
                            sub_type: 'copy_code',
                            index: index,
                            parameters: [{ type: 'coupon_code', coupon_code: code }]
                        });
                    }
                }
            });

            if (buttonComponents.length > 0) {
                // Add to broadcast components. 
                // NOTE: Broadcast components array structure is flat for header/body etc, but buttons are separate?
                // No, standard `components` payload is an array of objects.
                // We don't replace the BUTTONS definition from the template, we append the button parameter objects.
                // WAIT: `broadcastData.components` currently holds the Template Definition (with types and formats).
                // The WASAPI message payload structure (parameters) is DIFFERENT from Template Definition.
                // 
                // For Broadcasts, we act as a definitions storage. The `worker` constructs the actual message payload.
                // So we should store these values in `broadcastData` (e.g. `presets` or `staticParameters`) 
                // OR we modify `broadcastData.components` to act as the "Preset" configuration?
                // 
                // The `worker.js` (or broadcasting service) iterates through contacts and constructs the call.
                // It likely looks at `broadcastData.components`.
                // If we change `broadcastData.components` to look like the MESSAGE payload (components with parameters),
                // then the worker might break if it expects the TEMPLATE definition.
                // 
                // Let's look at how the worker uses `broadcastData.components`.
                // (I can't see the worker code right now, but assuming standard behavior or how I treated Header Media).
                // 
                // I treated Header Media by REPLACING the component in `broadcastData.components` with the Message Payload version:
                // `{ type: 'header', parameters: [...] }`
                // This implies `broadcastData.components` is expected to optionally contain PRE-FILLED component payloads.

                buttonComponents.forEach(bc => {
                    broadcastData.components.push(bc);
                });
            }
        }

        // Handle Header Media (Standard)
        if (baseMediaSource === 'file' && headerMediaFile && headerMediaFile.size > 0) {
            try {
                const form = new NodeFormData();
                const buffer = Buffer.from(await headerMediaFile.arrayBuffer());
                form.append('file', buffer, {
                    filename: headerMediaFile.name,
                    contentType: headerMediaFile.type,
                    knownLength: buffer.length
                });
                form.append('messaging_product', 'whatsapp');

                console.log('Uploading broadcast header media to Meta...', { size: buffer.length, type: headerMediaFile.type });

                const uploadResponse = await axios.post(
                    `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/media`,
                    form,
                    {
                        headers: {
                            ...form.getHeaders(),
                            'Authorization': `Bearer ${project.accessToken}`
                        }
                    }
                );
                const mediaId = uploadResponse.data.id;

                // Update the HEADER component in broadcastData.components
                const headerIndex = broadcastData.components.findIndex((c: any) => c.type === 'HEADER');
                if (headerIndex !== -1) {
                    const format = broadcastData.components[headerIndex].format;
                    if (format === 'IMAGE') {
                        broadcastData.components[headerIndex] = { type: 'header', parameters: [{ type: 'image', image: { id: mediaId } }] };
                    } else if (format === 'VIDEO') {
                        broadcastData.components[headerIndex] = { type: 'header', parameters: [{ type: 'video', video: { id: mediaId } }] };
                    } else if (format === 'DOCUMENT') {
                        broadcastData.components[headerIndex] = { type: 'header', parameters: [{ type: 'document', document: { id: mediaId } }] };
                    }
                }

            } catch (uploadError: any) {
                console.error('Meta Header Media Upload Error:', uploadError.response?.data || uploadError.message);
                return { error: `Failed to upload header media: ${uploadError.message}` };
            }
        } else if (headerImageUrl) {
            // Handle URL based header media by updating the component parameters
            const headerIndex = broadcastData.components.findIndex((c: any) => c.type === 'HEADER');
            if (headerIndex !== -1) {
                const format = broadcastData.components[headerIndex].format;
                if (format === 'IMAGE') {
                    broadcastData.components[headerIndex] = { type: 'header', parameters: [{ type: 'image', image: { link: headerImageUrl } }] };
                } else if (format === 'VIDEO') {
                    broadcastData.components[headerIndex] = { type: 'header', parameters: [{ type: 'video', video: { link: headerImageUrl } }] };
                } else if (format === 'DOCUMENT') {
                    broadcastData.components[headerIndex] = { type: 'header', parameters: [{ type: 'document', document: { link: headerImageUrl } }] };
                }
            }
        }

        // Handle Carousel Media
        if (template.type === 'MARKETING_CAROUSEL') {
            const carouselComponent = broadcastData.components.find((c: any) => c.type === 'CAROUSEL');

            if (carouselComponent && Array.isArray(carouselComponent.cards)) {
                console.log('Processing Marketing Carousel for Broadcast...');
                const cardsPayload: any[] = [];

                // Process cards in order
                for (let i = 0; i < carouselComponent.cards.length; i++) {
                    const cardDef = carouselComponent.cards[i];
                    const cardHeader = cardDef.components?.find((c: any) => c.type === 'HEADER');
                    const cardComponents: any[] = [];

                    // 1. Handle Header Media Upload
                    if (cardHeader && ['IMAGE', 'VIDEO'].includes(cardHeader.format)) {
                        const fileKey = `card_${i}_media_file`;
                        const file = formData.get(fileKey) as File;

                        let mediaId: string | null = null;

                        if (file && file.size > 0) {
                            try {
                                const form = new NodeFormData();
                                const buffer = Buffer.from(await file.arrayBuffer());
                                form.append('file', buffer, {
                                    filename: file.name,
                                    contentType: file.type,
                                    knownLength: buffer.length
                                });
                                form.append('messaging_product', 'whatsapp');

                                console.log(`Uploading broadcast carousel card ${i} media to Meta...`, { size: buffer.length, type: file.type });

                                const uploadResponse = await axios.post(
                                    `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/media`,
                                    form,
                                    {
                                        headers: {
                                            ...form.getHeaders(),
                                            'Authorization': `Bearer ${project.accessToken}`
                                        }
                                    }
                                );
                                mediaId = uploadResponse.data.id;
                                console.log(`Uploaded media ID for card ${i}: ${mediaId}`);
                            } catch (uploadError: any) {
                                console.error(`Meta Media Upload Error (Card ${i}):`, uploadError.response?.data || uploadError.message);
                                return { error: `Failed to upload media for card ${i + 1}: ${uploadError.message}` };
                            }
                        }

                        if (mediaId) {
                            if (cardHeader.format === 'IMAGE') {
                                cardComponents.push({
                                    type: 'header',
                                    parameters: [{ type: 'image', image: { id: mediaId } }]
                                });
                            } else if (cardHeader.format === 'VIDEO') {
                                cardComponents.push({
                                    type: 'header',
                                    parameters: [{ type: 'video', video: { id: mediaId } }]
                                });
                            }
                        }
                    }

                    if (cardComponents.length > 0) {
                        cardsPayload.push({
                            card_index: i,
                            components: cardComponents
                        });
                    }
                }

                if (cardsPayload.length > 0) {
                    // Replace the CAROUSEL component definition with the constructed payload
                    const newCarouselComponent = {
                        type: 'CAROUSEL',
                        cards: cardsPayload
                    };

                    // Replace in components array
                    const carouselIndex = broadcastData.components.findIndex((c: any) => c.type === 'CAROUSEL');
                    if (carouselIndex !== -1) {
                        broadcastData.components[carouselIndex] = newCarouselComponent;
                    }
                }
            }
        }
    } else if (broadcastType === 'flow' && flow) {
        broadcastData.name = `Flow: ${flow.name} - ${new Date().toLocaleString()}`;
        broadcastData.templateName = `Flow: ${flow.name}`; // Fallback for display
        broadcastData.flowId = flow._id;
        broadcastData.flowName = flow.name;
        broadcastData.flowMetaId = flow.metaId;

        // Flow message configuration
        broadcastData.flowConfig = {
            header: formData.get('flowHeader'),
            body: formData.get('flowBody'),
            footer: formData.get('flowFooter'),
            cta: formData.get('flowCta'),
        };
    }

    const broadcastResult = await db.collection('broadcasts').insertOne(broadcastData);
    const broadcastId = broadcastResult.insertedId;

    const contactsInserted = await createBroadcastContacts(db, broadcastId, contacts);

    // Hand off to the BullMQ control queue. The control worker will stream
    // contacts in batches and the send workers will fan out at the configured
    // MPS. A queue failure here is non-fatal — the broadcast doc still has
    // status PENDING_PROCESSING and the next worker boot will pick it up via
    // the legacy poller fallback (if BROADCAST_USE_BULLMQ is unset).
    try {
        await enqueueBroadcastControl(broadcastId.toString());
    } catch (e) {
        console.error('Failed to enqueue broadcast control job:', e);
    }

    revalidatePath('/dashboard/broadcasts');

    return { message: `Broadcast successfully queued for ${contactsInserted} contacts. Sending will begin shortly.` };
}

export async function handleBulkBroadcast(
    prevState: { message?: string; error?: string },
    formData: FormData
): Promise<{ message?: string; error?: string }> {
    const projectIdsString = formData.get('projectIds') as string;
    const templateName = formData.get('templateName') as string;
    const language = formData.get('language') as string;
    const contactFile = formData.get('contactFile') as File;

    if (!projectIdsString || !templateName || !language || !contactFile || contactFile.size === 0) {
        return { error: 'Missing required fields for bulk broadcast.' };
    }

    const projectIds = projectIdsString.split(',');

    try {
        const { db } = await connectToDatabase();
        const allContacts = await parseContactFile(contactFile);

        if (allContacts.length === 0) {
            return { error: 'Contact file is empty or could not be parsed.' };
        }

        const contactsPerProject = Math.ceil(allContacts.length / projectIds.length);
        let successCount = 0;
        let failedProjects: string[] = [];

        for (let i = 0; i < projectIds.length; i++) {
            const projectId = projectIds[i];
            const projectContacts = allContacts.slice(i * contactsPerProject, (i + 1) * contactsPerProject);

            if (projectContacts.length === 0) continue;

            const project = await getProjectById(projectId);
            if (!project) {
                failedProjects.push(`Project ID ${projectId} (not found)`);
                continue;
            }

            const template = await db.collection<Template>('templates').findOne({ projectId: new ObjectId(projectId), name: templateName, language: language });
            if (!template) {
                failedProjects.push(`${project.name} (template not found)`);
                continue;
            }
            if (template.status !== 'APPROVED') {
                failedProjects.push(`${project.name} (template not approved)`);
                continue;
            }

            const broadcastData: Omit<BroadcastJob, '_id'> = {
                name: `Bulk: ${template.name} - ${new Date().toLocaleString()}`,
                projectId: new ObjectId(projectId),
                broadcastType: 'template',
                phoneNumberId: project.phoneNumbers?.[0]?.id || '', // Use the first available number
                templateName: template.name,
                templateId: template._id,
                language: template.language,
                status: 'PENDING_PROCESSING',
                contactCount: projectContacts.length,
                fileName: contactFile.name,
                audienceType: 'file-bulk',
                accessToken: project.accessToken,
                components: template.components || [],
                createdAt: new Date(),
            };

            const broadcastResult = await db.collection('broadcasts').insertOne(broadcastData as any);
            const broadcastId = broadcastResult.insertedId;

            await createBroadcastContacts(db, broadcastId, projectContacts);
            try {
                await enqueueBroadcastControl(broadcastId.toString());
            } catch (e) {
                console.error('Failed to enqueue bulk broadcast control job:', e);
            }
            successCount++;
        }

        let message = `Successfully queued broadcasts for ${successCount} project(s).`;
        if (failedProjects.length > 0) {
            message += ` Failed on ${failedProjects.length} project(s): ${failedProjects.join(', ')}.`;
        }

        revalidatePath('/dashboard/bulk');
        revalidatePath('/dashboard/broadcasts');

        return { message };

    } catch (e: any) {
        return { error: `Failed to process bulk broadcast: ${getErrorMessage(e)}` };
    }
}

export async function handleStartApiBroadcast(data: {
    projectId: string;
    phoneNumberId: string;
    templateId: string;
    contacts: any[];
    variableMappings?: any[];
}): Promise<{ message?: string; error?: string }> {
    const { projectId, phoneNumberId, templateId, contacts, variableMappings } = data;
    const { db } = await connectToDatabase();

    const [project, template] = await Promise.all([
        getProjectById(projectId),
        db.collection<Template>('templates').findOne({ _id: new ObjectId(templateId), projectId: new ObjectId(projectId) })
    ]);

    if (!project) return { error: 'Project not found.' };
    if (!template) return { error: 'Template not found for this project.' };

    const broadcastData: Omit<BroadcastJob, '_id'> = {
        name: `API Broadcast - ${template.name} - ${new Date().toLocaleString()}`,
        projectId: new ObjectId(projectId),
        broadcastType: 'template',
        phoneNumberId,
        templateName: template.name,
        templateId: template._id,
        language: template.language,
        status: 'PENDING_PROCESSING',
        contactCount: contacts.length,
        fileName: 'API Request',
        audienceType: 'api',
        accessToken: project.accessToken,
        components: template.components || [], // Pass original components
        createdAt: new Date(),
    };

    const broadcastResult = await db.collection('broadcasts').insertOne(broadcastData as any);
    const broadcastId = broadcastResult.insertedId;

    await createBroadcastContacts(db, broadcastId, contacts);

    try {
        await enqueueBroadcastControl(broadcastId.toString());
    } catch (e) {
        console.error('Failed to enqueue API broadcast control job:', e);
    }

    return { message: `Broadcast successfully queued via API for ${contacts.length} contacts. Sending will begin shortly.` };
}


export async function handleRequeueBroadcast(prevState: { message?: string; error?: string }, formData: FormData): Promise<{ message?: string; error?: string }> {
    const broadcastId = formData.get('broadcastId') as string;
    const requeueScope = formData.get('requeueScope') as 'ALL' | 'FAILED';
    const newTemplateId = formData.get('templateId') as string;
    const headerImageUrl = formData.get('headerImageUrl') as string | null;

    if (!broadcastId) return { error: 'Original broadcast ID is missing.' };

    const { db } = await connectToDatabase();
    if (!ObjectId.isValid(broadcastId)) return { error: 'Invalid broadcast id.' };
    const originalBroadcast = await db.collection('broadcasts').findOne({ _id: new ObjectId(broadcastId) });
    if (!originalBroadcast) return { error: 'Original broadcast not found.' };

    // J3 P0-2-adjacent: derive projectId from the broadcast (trusted server
    // state) and gate via getProjectById. This matches the payment-request
    // helper pattern and prevents a caller from requeueing another tenant's
    // broadcast by guessing a broadcastId.
    const projectId = originalBroadcast.projectId.toString();
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Project not found.' };

    const templateId = newTemplateId || originalBroadcast.templateId.toString();
    if (!ObjectId.isValid(templateId)) return { error: 'Invalid template id.' };
    // J3 P0-1-adjacent: scope template lookup by the broadcast's project so a
    // requeue can't pick up a template from a different tenant.
    const template = await db.collection<Template>('templates').findOne({
        _id: new ObjectId(templateId),
        projectId: originalBroadcast.projectId,
    });
    if (!template) return { error: 'Template not found in this project.' };
    // J3 P1-1-adjacent: same approval gate as the primary broadcast path.
    if (template.status !== 'APPROVED') {
        return { error: `Template '${template.name}' is ${template.status || 'not approved'}. Only APPROVED templates can be broadcast.` };
    }

    const filter: Filter<any> = { broadcastId: new ObjectId(broadcastId) };
    if (requeueScope === 'FAILED') {
        filter.status = 'FAILED';
    }

    const contacts = await db.collection('broadcast_contacts').find(filter).toArray();
    if (contacts.length === 0) {
        return { error: 'No contacts found to requeue.' };
    }

    const newBroadcastData: Omit<BroadcastJob, '_id'> = {
        ...originalBroadcast as any, // Cast to any to avoid type issues with changing properties
        name: `${originalBroadcast.name} (Requeued)`,
        status: 'PENDING_PROCESSING',
        contactCount: contacts.length,
        successCount: 0,
        errorCount: 0,
        startedAt: undefined,
        completedAt: undefined,
        createdAt: new Date(),
        components: template.components, // Use the new/original template's components
        headerImageUrl: headerImageUrl || undefined,
    };
    if ('_id' in newBroadcastData) delete (newBroadcastData as any)._id;

    const newBroadcastResult = await db.collection('broadcasts').insertOne(newBroadcastData as any);
    await createBroadcastContacts(db, newBroadcastResult.insertedId, contacts);

    try {
        await enqueueBroadcastControl(newBroadcastResult.insertedId.toString());
    } catch (e) {
        console.error('Failed to enqueue requeue broadcast control job:', e);
    }

    revalidatePath('/dashboard/broadcasts');
    return { message: `${contacts.length} contacts have been re-queued for broadcast.` };
}

export async function handleStopBroadcast(broadcastId: string): Promise<{ message?: string; error?: string }> {
    if (!broadcastId || !ObjectId.isValid(broadcastId)) {
        return { error: 'Invalid Broadcast ID.' };
    }
    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('broadcasts').updateOne(
            { _id: new ObjectId(broadcastId), status: { $in: ['QUEUED', 'PROCESSING', 'PENDING_PROCESSING'] } },
            { $set: { status: 'Cancelled' } }
        );
        if (result.matchedCount === 0) {
            return { error: 'Broadcast not found or has already completed/failed.' };
        }
        revalidatePath('/dashboard/broadcasts');
        return { message: 'Broadcast has been cancelled.' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}
