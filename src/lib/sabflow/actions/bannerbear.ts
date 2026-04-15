
'use server';

const BB_BASE = 'https://api.bannerbear.com/v2';

async function bbFetch(
    apiKey: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    const url = `${BB_BASE}${path}`;
    logger?.log(`[Bannerbear] ${method} ${path}`);

    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);

    const res = await fetch(url, options);

    if (res.status === 204) return {};

    const text = await res.text();
    let data: any;
    try {
        data = JSON.parse(text);
    } catch {
        data = text;
    }

    if (!res.ok) {
        throw new Error(
            (typeof data === 'object' ? data?.message || data?.error : undefined) ||
            `Bannerbear API error: ${res.status}`
        );
    }
    return data;
}

async function pollImage(apiKey: string, imageUid: string, logger?: any): Promise<any> {
    const maxAttempts = 20; // ~60 seconds at 3s intervals
    let attempt = 0;

    while (attempt < maxAttempts) {
        const data = await bbFetch(apiKey, 'GET', `/images/${imageUid}`, undefined, logger);
        if (data.status === 'completed') return data;
        if (data.status === 'failed') throw new Error(`Bannerbear image generation failed for uid: ${imageUid}`);
        // Wait 3 seconds before next poll
        await new Promise((resolve) => setTimeout(resolve, 3000));
        attempt++;
    }
    throw new Error(`Bannerbear image polling timed out after ${maxAttempts * 3}s for uid: ${imageUid}`);
}

export async function executeBannerbearAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const bb = (method: string, path: string, body?: any) =>
            bbFetch(apiKey, method, path, body, logger);

        switch (actionName) {
            case 'createImage': {
                const templateUid = String(inputs.templateUid ?? '').trim();
                const modifications = inputs.modifications;
                if (!templateUid) throw new Error('templateUid is required.');
                if (!modifications) throw new Error('modifications is required.');

                const body: any = {
                    template: templateUid,
                    modifications,
                    transparent: inputs.transparent ?? false,
                    render_pdf: inputs.renderPdf ?? false,
                };
                if (inputs.webhookUrl) body.webhook_url = String(inputs.webhookUrl);

                const data = await bb('POST', '/images', body);
                logger.log(`[Bannerbear] Image created: ${data.uid}`);
                return {
                    output: {
                        uid: data.uid,
                        status: data.status,
                        imageUrl: data.image_url,
                        pngUrl: data.image_url_png,
                        jpgUrl: data.image_url_jpg,
                    },
                };
            }

            case 'getImage': {
                const imageUid = String(inputs.imageUid ?? '').trim();
                if (!imageUid) throw new Error('imageUid is required.');

                const data = await bb('GET', `/images/${imageUid}`);
                return {
                    output: {
                        uid: data.uid,
                        status: data.status,
                        imageUrl: data.image_url,
                        pngUrl: data.image_url_png,
                        jpgUrl: data.image_url_jpg,
                        createdAt: data.created_at,
                    },
                };
            }

            case 'createAndWait': {
                const templateUid = String(inputs.templateUid ?? '').trim();
                const modifications = inputs.modifications;
                if (!templateUid) throw new Error('templateUid is required.');
                if (!modifications) throw new Error('modifications is required.');

                const createData = await bb('POST', '/images', { template: templateUid, modifications });
                logger.log(`[Bannerbear] Image creation started: ${createData.uid}, polling...`);

                const data = await pollImage(apiKey, createData.uid, logger);
                logger.log(`[Bannerbear] Image completed: ${data.uid}`);
                return {
                    output: {
                        uid: data.uid,
                        imageUrl: data.image_url,
                        pngUrl: data.image_url_png,
                        jpgUrl: data.image_url_jpg,
                    },
                };
            }

            case 'listImages': {
                const params = new URLSearchParams({
                    limit: String(inputs.limit ?? 25),
                    page: String(inputs.page ?? 1),
                });
                if (inputs.template) params.set('template', String(inputs.template));

                const data = await bb('GET', `/images?${params.toString()}`);
                return { output: { images: Array.isArray(data) ? data : [] } };
            }

            case 'listTemplates': {
                const data = await bb('GET', '/templates');
                const templates = (Array.isArray(data) ? data : []).map((t: any) => ({
                    uid: t.uid,
                    name: t.name,
                    width: t.width,
                    height: t.height,
                    available_modifications: t.available_modifications ?? [],
                }));
                return { output: { templates } };
            }

            case 'getTemplate': {
                const templateUid = String(inputs.templateUid ?? '').trim();
                if (!templateUid) throw new Error('templateUid is required.');

                const data = await bb('GET', `/templates/${templateUid}`);
                return {
                    output: {
                        uid: data.uid,
                        name: data.name,
                        width: data.width,
                        height: data.height,
                        available_modifications: (data.available_modifications ?? []).map((m: any) => ({
                            name: m.name,
                            color: m.color,
                            font_family: m.font_family,
                            text: m.text,
                        })),
                    },
                };
            }

            case 'createCollection': {
                const templateSet = String(inputs.templateSet ?? '').trim();
                const modifications = inputs.modifications;
                if (!templateSet) throw new Error('templateSet is required.');
                if (!modifications) throw new Error('modifications is required.');

                const body: any = { template_set: templateSet, modifications };
                if (inputs.webhookUrl) body.webhook_url = String(inputs.webhookUrl);

                const data = await bb('POST', '/collections', body);
                logger.log(`[Bannerbear] Collection created: ${data.uid}`);
                return { output: { uid: data.uid, status: data.status, images: data.images ?? {} } };
            }

            case 'getCollection': {
                const collectionUid = String(inputs.collectionUid ?? '').trim();
                if (!collectionUid) throw new Error('collectionUid is required.');

                const data = await bb('GET', `/collections/${collectionUid}`);
                return { output: { uid: data.uid, status: data.status, images: data.images ?? {} } };
            }

            case 'listTemplateSets': {
                const data = await bb('GET', '/template_sets');
                const templateSets = (Array.isArray(data) ? data : []).map((ts: any) => ({
                    uid: ts.uid,
                    name: ts.name,
                }));
                return { output: { templateSets } };
            }

            case 'createVideo': {
                const templateUid = String(inputs.templateUid ?? '').trim();
                const modifications = inputs.modifications;
                if (!templateUid) throw new Error('templateUid is required.');
                if (!modifications) throw new Error('modifications is required.');

                const body: any = {
                    template: templateUid,
                    modifications,
                    fps: inputs.fps ?? 24,
                };
                if (inputs.webhookUrl) body.webhook_url = String(inputs.webhookUrl);

                const data = await bb('POST', '/videos', body);
                logger.log(`[Bannerbear] Video created: ${data.uid}`);
                return { output: { uid: data.uid, status: data.status, videoUrl: data.video_url } };
            }

            case 'getVideo': {
                const videoUid = String(inputs.videoUid ?? '').trim();
                if (!videoUid) throw new Error('videoUid is required.');

                const data = await bb('GET', `/videos/${videoUid}`);
                return { output: { uid: data.uid, status: data.status, videoUrl: data.video_url, gifUrl: data.gif_url } };
            }

            case 'listSignedTokens': {
                const base = String(inputs.base ?? '').trim();
                const modifications = inputs.modifications;
                if (!base) throw new Error('base is required.');
                if (!modifications) throw new Error('modifications is required.');

                const body: any = { base, modifications };
                if (inputs.expiresAt) body.expires_at = String(inputs.expiresAt);

                const data = await bb('POST', '/signed_urls', body);
                logger.log(`[Bannerbear] Signed token created`);
                return { output: { signedUrl: data.signed_url, expiresAt: data.expires_at } };
            }

            default:
                return { error: `Bannerbear action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Bannerbear action failed.' };
    }
}
