'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';
import { getProjectById } from '@/app/actions/project.actions';
import { rustClient, RustApiError } from '@/lib/rust-client';
import type {
    ContactRecord,
    StartBroadcastBody,
} from '@/lib/rust-client/wachat-broadcast';
import { getErrorMessage, validateFile } from '@/lib/utils';
import type { BroadcastJob } from '@/lib/definitions';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import { recordFlowAction } from '@/lib/sabflow/audit/middleware';
import { getSession } from '@/app/actions/user.actions';

async function _wachatBcActorId(): Promise<string | null> {
    try {
        const session = await getSession();
        const u = (session as { user?: { _id?: unknown; id?: unknown } } | null)?.user;
        const raw = u?._id ?? u?.id;
        if (!raw) return null;
        return typeof raw === 'string' ? raw : String(raw);
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// Phase 6 (final): every server action below is a thin shim around the
// Rust `wachat-broadcast` crate — Mongo I/O, BullMQ enqueue, tenancy
// gates, AND multipart media uploads to Meta all live in Rust now. CSV
// / XLSX parsing remains on the TS side because file decoding is
// inherently transport-coupled to the Next.js request body.
//
// Error contract: the legacy actions returned `{ error?, message? }`.
// `RustApiError` carries the same human-readable message in `.message`,
// so we surface that to callers and never re-throw — the UI components
// switch on the presence of `error` vs `message`.
// ---------------------------------------------------------------------------

function toErrorResponse<T extends { error?: string }>(e: unknown, base?: T): T {
    const msg = e instanceof RustApiError ? e.message : getErrorMessage(e);
    return { ...(base ?? ({} as T)), error: msg };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getAllBroadcasts(
    page: number = 1,
    limit: number = 20,
): Promise<{ broadcasts: WithId<BroadcastJob>[]; total: number }> {
    try {
        const r = await rustClient.wachatBroadcast.adminList({ page, limit });
        return { broadcasts: r.broadcasts as WithId<BroadcastJob>[], total: r.total };
    } catch (e) {
        console.error('Failed to get all broadcasts:', e);
        return { broadcasts: [], total: 0 };
    }
}

export async function getBroadcasts(
    projectId: string,
    page: number = 1,
    limit: number = 10,
): Promise<{ broadcasts: WithId<BroadcastJob>[]; total: number }> {
    if (!projectId || !ObjectId.isValid(projectId)) {
        return { broadcasts: [], total: 0 };
    }
    try {
        const r = await rustClient.wachatBroadcast.listForProject(projectId, { page, limit });
        return { broadcasts: r.broadcasts as WithId<BroadcastJob>[], total: r.total };
    } catch (e) {
        console.error('Failed to get broadcasts for project:', e);
        return { broadcasts: [], total: 0 };
    }
}

export async function getBroadcastById(broadcastId: string): Promise<WithId<any> | null> {
    if (!broadcastId || !ObjectId.isValid(broadcastId)) return null;
    try {
        return (await rustClient.wachatBroadcast.getById(broadcastId)) as WithId<any>;
    } catch (e) {
        console.error('Failed to get broadcast by ID:', e);
        return null;
    }
}

export async function getBroadcastAttempts(
    broadcastId: string,
    page: number = 1,
    limit: number = 50,
    statusFilter?: string,
): Promise<{ attempts: any[]; total: number }> {
    if (!broadcastId || !ObjectId.isValid(broadcastId)) return { attempts: [], total: 0 };
    try {
        return await rustClient.wachatBroadcast.listAttempts(broadcastId, {
            page,
            limit,
            statusFilter,
        });
    } catch {
        return { attempts: [], total: 0 };
    }
}

export async function getBroadcastAttemptsForExport(
    broadcastId: string,
    statusFilter?: string,
): Promise<any[]> {
    if (!broadcastId || !ObjectId.isValid(broadcastId)) return [];
    try {
        return await rustClient.wachatBroadcast.exportAttempts(broadcastId, statusFilter);
    } catch {
        return [];
    }
}

export async function getBroadcastLogs(broadcastId: string): Promise<WithId<any>[]> {
    if (!broadcastId || !ObjectId.isValid(broadcastId)) return [];
    try {
        return (await rustClient.wachatBroadcast.listLogs(broadcastId)) as WithId<any>[];
    } catch {
        return [];
    }
}

// ---------------------------------------------------------------------------
// FormData / file helpers
// ---------------------------------------------------------------------------

const parseContactFile = async (file: File): Promise<ContactRecord[]> => {
    const { isValid, error } = validateFile(file, [
        'text/csv',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]);
    if (!isValid) throw new Error(error || 'Invalid file');

    const buffer = await file.arrayBuffer();
    const data = new Uint8Array(buffer);

    let rows: any[] = [];
    if (file.type === 'text/csv') {
        const text = new TextDecoder('utf-8').decode(data);
        rows = Papa.parse(text, { header: true, skipEmptyLines: true }).data as any[];
    } else {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(data);
        const worksheet = workbook.worksheets[0];
        const allRows: any[][] = [];
        worksheet?.eachRow((row) => { allRows.push((row.values as any[]).slice(1)); });
        const header = (allRows[0] ?? []) as string[];
        rows = allRows.slice(1).map((row: any[]) => {
            const rowData: any = {};
            header.forEach((h: any, i: number) => { rowData[h] = row[i]; });
            return rowData;
        });
    }

    if (!rows[0] || !Object.keys(rows[0]).some(h => h.toLowerCase().includes('phone'))) {
        throw new Error("Invalid file format. The first column must be named 'phone'.");
    }

    return rows.map((row: any) => ({
        phone: String(row.phone || row.Phone || row.PHONE).trim().replace(/\D/g, ''),
        name: row.name || row.Name || 'Subscriber',
        variables: { ...row },
    }));
};

/**
 * Upload a single header-media file to Meta via the Rust BFF and
 * return the resulting media id. The Rust endpoint resolves the
 * project's access token server-side, so we no longer thread it
 * through here — pass the bare `projectId` the action already has.
 */
async function uploadMediaToMeta(
    file: File,
    projectId: string,
    phoneNumberId: string,
): Promise<string> {
    const r = await rustClient.wachatBroadcast.uploadMedia(
        projectId,
        phoneNumberId,
        file,
    );
    return r.id;
}

// ---------------------------------------------------------------------------
// Mutations — the heavy ones (build a normalized JSON body, then call Rust)
// ---------------------------------------------------------------------------

export async function handleStartBroadcast(
    _prevState: { message?: string; error?: string },
    formData: FormData,
): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const phoneNumberId = formData.get('phoneNumberId') as string;
    const audienceType = (formData.get('audienceType') as 'file' | 'tags') || 'file';
    const tagIds = formData.getAll('tagIds') as string[];
    const broadcastType = (formData.get('broadcastType') as 'template' | 'flow') || 'template';

    const project = await getProjectById(projectId);
    if (!project) return { error: 'Project not found.' };

    // Pre-resolve template / flow via the Rust BFF so we can build the
    // `components` array (with header media ids substituted in) before
    // forwarding to `rustClient.wachatBroadcast.start()`. The Rust
    // handler re-validates project ownership and the template's
    // APPROVED status — these early checks exist for UX (skip media
    // uploads when we already know the broadcast can't go out).
    let template: {
        id: string;
        name: string;
        status: string;
        components: any[];
        type?: string | null;
    } | null = null;
    let flow: { id: string; name: string; metaId: string } | null = null;

    if (broadcastType === 'template') {
        const templateId = formData.get('templateId') as string;
        if (!templateId || !ObjectId.isValid(templateId)) {
            return { error: 'Invalid templateId.' };
        }
        try {
            const t = await rustClient.templates.getById(templateId, projectId);
            if (!t) return { error: 'Template not found for this project.' };
            if (t.status !== 'APPROVED') {
                return {
                    error: `Template '${t.name}' is ${
                        t.status || 'not approved'
                    }. Only APPROVED templates can be broadcast.`,
                };
            }
            template = {
                id: t.id,
                name: t.name,
                status: t.status,
                components: (t.components as any[]) ?? [],
                type: t.type ?? null,
            };
        } catch (e) {
            return toErrorResponse(e, { error: 'Template not found for this project.' });
        }
    } else {
        const flowId = formData.get('flowId') as string;
        if (!flowId || !ObjectId.isValid(flowId)) return { error: 'Invalid flowId.' };
        try {
            const f = await rustClient.metaFlows.getFlow(flowId);
            if (!f || f.projectId !== projectId) {
                return { error: 'Flow not found for this project.' };
            }
            flow = { id: f._id, name: f.name, metaId: f.metaId };
        } catch (e) {
            return toErrorResponse(e, { error: 'Flow not found for this project.' });
        }
    }

    // Audience: file → CSV / XLSX parsing happens here.
    let contacts: ContactRecord[] = [];
    if (audienceType === 'file') {
        const csvFile = formData.get('csvFile') as File;
        if (!csvFile || csvFile.size === 0) return { error: 'Contact file is required.' };
        try {
            contacts = await parseContactFile(csvFile);
        } catch (e: any) {
            return { error: `Failed to parse file: ${e.message}` };
        }
    }

    // Per-broadcast MPS override (worker reads broadcast → project →
    // BROADCAST_DEFAULT_MPS).
    const formMps = parseInt(formData.get('messagesPerSecond') as string, 10);
    const broadcastMps =
        Number.isFinite(formMps) && formMps > 0 ? formMps : undefined;
    const createContacts = formData.get('createContacts') === 'true';

    // Build the `components` array. Start from the template definition
    // (so the worker doesn't need to re-fetch) and rewrite header /
    // carousel / button entries based on the form inputs.
    const components: any[] = template ? [...(template.components || [])] : [];

    if (template) {
        const headerImageUrl = formData.get('headerMediaUrl') as string | null;
        const headerMediaFile = formData.get('headerMediaFile') as File | null;
        const baseMediaSource = formData.get('mediaSource') as string | null;

        // Header — text variable, location, image / video / document.
        const headerComponentDef = template.components?.find(c => c.type === 'HEADER');
        if (headerComponentDef) {
            const format = headerComponentDef.format?.toUpperCase();
            if (format === 'TEXT') {
                const matches = headerComponentDef.text?.match(/{{\s*(\d+)\s*}}/g);
                if (matches && matches.length > 0) {
                    const varNum = matches[0].replace(/\D/g, '');
                    const headerVar = formData.get(`variable_header_${varNum}`) as string;
                    if (headerVar) {
                        const headerIndex = components.findIndex(
                            (c: any) => c.type === 'HEADER',
                        );
                        if (headerIndex !== -1) {
                            components[headerIndex] = {
                                type: 'header',
                                parameters: [{ type: 'text', text: headerVar }],
                            };
                        }
                    }
                }
            } else if (format === 'LOCATION') {
                const locName = formData.get('header_location_name') as string;
                const locAddress = formData.get('header_location_address') as string;
                const locLat = formData.get('header_location_latitude') as string;
                const locLong = formData.get('header_location_longitude') as string;
                if (locLat && locLong) {
                    const headerIndex = components.findIndex(
                        (c: any) => c.type === 'HEADER',
                    );
                    if (headerIndex !== -1) {
                        components[headerIndex] = {
                            type: 'header',
                            parameters: [
                                {
                                    type: 'location',
                                    location: {
                                        latitude: locLat,
                                        longitude: locLong,
                                        name: locName || undefined,
                                        address: locAddress || undefined,
                                    },
                                },
                            ],
                        };
                    }
                }
            } else if (
                baseMediaSource === 'file' &&
                headerMediaFile &&
                headerMediaFile.size > 0
            ) {
                try {
                    const mediaId = await uploadMediaToMeta(
                        headerMediaFile,
                        projectId,
                        phoneNumberId,
                    );
                    const headerIndex = components.findIndex(
                        (c: any) => c.type === 'HEADER',
                    );
                    if (headerIndex !== -1) {
                        const f = components[headerIndex].format;
                        if (f === 'IMAGE') {
                            components[headerIndex] = {
                                type: 'header',
                                parameters: [{ type: 'image', image: { id: mediaId } }],
                            };
                        } else if (f === 'VIDEO') {
                            components[headerIndex] = {
                                type: 'header',
                                parameters: [{ type: 'video', video: { id: mediaId } }],
                            };
                        } else if (f === 'DOCUMENT') {
                            components[headerIndex] = {
                                type: 'header',
                                parameters: [
                                    { type: 'document', document: { id: mediaId } },
                                ],
                            };
                        }
                    }
                } catch (uploadError: any) {
                    return { error: `Failed to upload header media: ${uploadError.message}` };
                }
            } else if (headerImageUrl) {
                const headerIndex = components.findIndex(
                    (c: any) => c.type === 'HEADER',
                );
                if (headerIndex !== -1) {
                    const f = components[headerIndex].format;
                    if (f === 'IMAGE') {
                        components[headerIndex] = {
                            type: 'header',
                            parameters: [
                                { type: 'image', image: { link: headerImageUrl } },
                            ],
                        };
                    } else if (f === 'VIDEO') {
                        components[headerIndex] = {
                            type: 'header',
                            parameters: [
                                { type: 'video', video: { link: headerImageUrl } },
                            ],
                        };
                    } else if (f === 'DOCUMENT') {
                        components[headerIndex] = {
                            type: 'header',
                            parameters: [
                                { type: 'document', document: { link: headerImageUrl } },
                            ],
                        };
                    }
                }
            }
        }

        // Body — collect any global static variable values.
        let globalBodyVars: Record<string, string> | null = null;
        const bodyComponent = template.components?.find(c => c.type === 'BODY');
        if (bodyComponent && bodyComponent.text) {
            const matches = bodyComponent.text.match(/{{(\d+)}}/g);
            if (matches) {
                const uniqueVars = new Set(matches) as Set<string>;
                const collected: Record<string, string> = {};
                uniqueVars.forEach(v => {
                    const varNum = v.replace(/\D/g, '');
                    const formValue = formData.get(`variable_body_${varNum}`) as string;
                    if (formValue) collected[`variable_body_${varNum}`] = formValue;
                });
                if (Object.keys(collected).length > 0) globalBodyVars = collected;
            }
        }

        // Buttons — append URL-suffix / copy-code parameter components.
        const buttons = template.components?.find(c => c.type === 'BUTTONS')?.buttons;
        if (buttons) {
            buttons.forEach((btn: any, index: number) => {
                if (btn.type === 'URL' && btn.url?.includes('{{1}}')) {
                    const suffix = formData.get(`button_url_suffix_${index}`) as string;
                    if (suffix) {
                        components.push({
                            type: 'button',
                            sub_type: 'url',
                            index,
                            parameters: [{ type: 'text', text: suffix }],
                        });
                    }
                } else if (btn.type === 'COPY_CODE') {
                    const code = formData.get(`button_copy_code_${index}`) as string;
                    if (code) {
                        components.push({
                            type: 'button',
                            sub_type: 'copy_code',
                            index,
                            parameters: [{ type: 'coupon_code', coupon_code: code }],
                        });
                    }
                }
            });
        }

        // Carousel media — upload each card image / video and rewrite
        // the CAROUSEL component's `cards` array.
        if (template.type === 'MARKETING_CAROUSEL') {
            const carouselComponent = components.find((c: any) => c.type === 'CAROUSEL');
            if (carouselComponent && Array.isArray(carouselComponent.cards)) {
                const cardsPayload: any[] = [];
                for (let i = 0; i < carouselComponent.cards.length; i++) {
                    const cardDef = carouselComponent.cards[i];
                    const cardHeader = cardDef.components?.find(
                        (c: any) => c.type === 'HEADER',
                    );
                    const cardComponents: any[] = [];
                    if (cardHeader && ['IMAGE', 'VIDEO'].includes(cardHeader.format)) {
                        const fileKey = `card_${i}_media_file`;
                        const file = formData.get(fileKey) as File;
                        if (file && file.size > 0) {
                            try {
                                const mediaId = await uploadMediaToMeta(
                                    file,
                                    projectId,
                                    phoneNumberId,
                                );
                                cardComponents.push({
                                    type: 'header',
                                    parameters: [
                                        cardHeader.format === 'IMAGE'
                                            ? { type: 'image', image: { id: mediaId } }
                                            : { type: 'video', video: { id: mediaId } },
                                    ],
                                });
                            } catch (uploadError: any) {
                                return {
                                    error: `Failed to upload media for card ${i + 1}: ${uploadError.message}`,
                                };
                            }
                        }
                    }
                    if (cardComponents.length > 0) {
                        cardsPayload.push({ card_index: i, components: cardComponents });
                    }
                }
                if (cardsPayload.length > 0) {
                    const carouselIndex = components.findIndex(
                        (c: any) => c.type === 'CAROUSEL',
                    );
                    if (carouselIndex !== -1) {
                        components[carouselIndex] = {
                            type: 'CAROUSEL',
                            cards: cardsPayload,
                        };
                    }
                }
            }
        }

        const body: StartBroadcastBody = {
            projectId,
            phoneNumberId,
            broadcastType: 'template',
            templateId: template.id,
            audienceType,
            contacts: audienceType === 'file' ? contacts : undefined,
            tagIds: audienceType === 'tags' ? tagIds : undefined,
            fileName:
                audienceType === 'file'
                    ? (formData.get('csvFile') as File).name
                    : 'Audience Tag',
            messagesPerSecond: broadcastMps,
            createContacts,
            components,
            globalBodyVars,
        };

        try {
            const r = await rustClient.wachatBroadcast.start(body);
            revalidatePath('/wachat/broadcasts');
            return { message: r.message };
        } catch (e) {
            return toErrorResponse(e);
        }
    }

    // Flow path
    const body: StartBroadcastBody = {
        projectId,
        phoneNumberId,
        broadcastType: 'flow',
        flowId: flow!.id,
        audienceType,
        contacts: audienceType === 'file' ? contacts : undefined,
        tagIds: audienceType === 'tags' ? tagIds : undefined,
        fileName:
            audienceType === 'file'
                ? (formData.get('csvFile') as File).name
                : 'Audience Tag',
        messagesPerSecond: broadcastMps,
        createContacts,
        components: [],
        flowName: flow!.name,
        flowMetaId: flow!.metaId,
        flowConfig: {
            header: (formData.get('flowHeader') as string) || undefined,
            body: (formData.get('flowBody') as string) || undefined,
            footer: (formData.get('flowFooter') as string) || undefined,
            cta: (formData.get('flowCta') as string) || undefined,
        },
    };

    try {
        const r = await rustClient.wachatBroadcast.start(body);
        revalidatePath('/wachat/broadcasts');
        const actor = await _wachatBcActorId();
        if (actor) {
            void recordFlowAction('wachat.campaign.launched', {
                userId: actor,
                target: (r as { broadcastId?: string; id?: string }).broadcastId
                    ?? (r as { id?: string }).id,
                metadata: {
                    projectId: body.projectId,
                    templateName: (body as { templateName?: string }).templateName,
                },
            });
        }
        return { message: r.message };
    } catch (e) {
        return toErrorResponse(e);
    }
}

export async function handleBulkBroadcast(
    _prevState: { message?: string; error?: string },
    formData: FormData,
): Promise<{ message?: string; error?: string }> {
    const projectIdsString = formData.get('projectIds') as string;
    const templateName = formData.get('templateName') as string;
    const language = formData.get('language') as string;
    const contactFile = formData.get('contactFile') as File;

    if (!projectIdsString || !templateName || !language || !contactFile || contactFile.size === 0) {
        return { error: 'Missing required fields for bulk broadcast.' };
    }

    let allContacts: ContactRecord[];
    try {
        allContacts = await parseContactFile(contactFile);
    } catch (e: any) {
        return { error: `Failed to parse file: ${e.message}` };
    }
    if (allContacts.length === 0) {
        return { error: 'Contact file is empty or could not be parsed.' };
    }

    try {
        const r = await rustClient.wachatBroadcast.bulkStart({
            projectIds: projectIdsString.split(','),
            templateName,
            language,
            fileName: contactFile.name,
            contacts: allContacts,
        });
        revalidatePath('/wachat/bulk');
        revalidatePath('/wachat/broadcasts');
        return { message: r.message };
    } catch (e) {
        return toErrorResponse(e);
    }
}

export async function handleStartApiBroadcast(data: {
    projectId: string;
    phoneNumberId: string;
    templateId: string;
    contacts: any[];
    variableMappings?: any[];
}): Promise<{ message?: string; error?: string }> {
    try {
        const r = await rustClient.wachatBroadcast.apiStart({
            projectId: data.projectId,
            phoneNumberId: data.phoneNumberId,
            templateId: data.templateId,
            contacts: data.contacts.map(c => ({
                phone: String(c.phone ?? c.Phone ?? c.PHONE ?? '').trim(),
                name: c.name ?? c.Name ?? 'Subscriber',
                variables: c,
            })),
            variableMappings: data.variableMappings,
        });
        return { message: r.message };
    } catch (e) {
        return toErrorResponse(e);
    }
}

export async function handleRequeueBroadcast(
    _prevState: { message?: string; error?: string },
    formData: FormData,
): Promise<{ message?: string; error?: string }> {
    const broadcastId = formData.get('broadcastId') as string;
    const requeueScope = (formData.get('requeueScope') as 'ALL' | 'FAILED') || 'ALL';
    const newTemplateId = (formData.get('templateId') as string) || undefined;
    const headerImageUrl = (formData.get('headerImageUrl') as string) || undefined;

    if (!broadcastId) return { error: 'Original broadcast ID is missing.' };
    if (!ObjectId.isValid(broadcastId)) return { error: 'Invalid broadcast id.' };

    try {
        const r = await rustClient.wachatBroadcast.requeue(broadcastId, {
            requeueScope,
            templateId: newTemplateId,
            headerImageUrl,
        });
        revalidatePath('/wachat/broadcasts');
        return { message: r.message };
    } catch (e) {
        return toErrorResponse(e);
    }
}

export async function handleStopBroadcast(
    broadcastId: string,
): Promise<{ message?: string; error?: string }> {
    if (!broadcastId || !ObjectId.isValid(broadcastId)) {
        return { error: 'Invalid Broadcast ID.' };
    }
    try {
        const r = await rustClient.wachatBroadcast.stop(broadcastId);
        revalidatePath('/wachat/broadcasts');
        const actor = await _wachatBcActorId();
        if (actor) {
            void recordFlowAction('wachat.campaign.cancelled', {
                userId: actor,
                target: broadcastId,
            });
        }
        return { message: r.message };
    } catch (e) {
        return toErrorResponse(e);
    }
}

// ---------------------------------------------------------------------------
// Cron Broadcast — start a tags-only broadcast from a plain object.
// Used by the Broadcast Cron page to fire multiple queued entries in
// parallel without constructing FormData objects.
// ---------------------------------------------------------------------------

export async function startCronBroadcast(config: {
    projectId: string;
    phoneNumberId: string;
    templateId: string;
    tagIds: string[];
    createContacts?: boolean;
}): Promise<{ message?: string; error?: string }> {
    const { projectId, phoneNumberId, templateId, tagIds, createContacts } = config;

    if (!projectId || !ObjectId.isValid(projectId)) return { error: 'Invalid project.' };
    if (!phoneNumberId) return { error: 'Phone number is required.' };
    if (!templateId || !ObjectId.isValid(templateId)) return { error: 'Invalid template.' };
    if (!tagIds || tagIds.length === 0) return { error: 'At least one tag is required.' };

    const project = await getProjectById(projectId);
    if (!project) return { error: 'Project not found.' };

    let template: { id: string; name: string; components: any[] };
    try {
        const t = await rustClient.templates.getById(templateId, projectId);
        if (!t) return { error: 'Template not found for this project.' };
        if (t.status !== 'APPROVED') {
            return {
                error: `Template '${t.name}' is not approved (status: ${t.status}).`,
            };
        }
        template = { id: t.id, name: t.name, components: (t.components as any[]) ?? [] };
    } catch (e) {
        return toErrorResponse(e, { error: 'Template not found for this project.' });
    }

    try {
        const r = await rustClient.wachatBroadcast.start({
            projectId,
            phoneNumberId,
            broadcastType: 'template',
            templateId: template.id,
            audienceType: 'tags',
            tagIds,
            fileName: `cron-${template.name}`,
            components: template.components,
            createContacts: createContacts ?? false,
        });
        revalidatePath('/wachat/broadcasts');
        revalidatePath('/wachat/broadcast-cron');
        return { message: r.message };
    } catch (e) {
        return toErrorResponse(e);
    }
}
