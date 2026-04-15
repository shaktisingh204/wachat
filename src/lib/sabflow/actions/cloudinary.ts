
'use server';

import crypto from 'crypto';

const CLOUDINARY_BASE = 'https://api.cloudinary.com/v1_1';
const CLOUDINARY_UPLOAD_BASE = 'https://api.cloudinary.com/v1_1';

function generateSignature(params: Record<string, string>, apiSecret: string): string {
    const sortedParams = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
    return crypto.createHash('sha256').update(sortedParams + apiSecret).digest('hex');
}

async function cloudinaryApi(cloudName: string, apiKey: string, apiSecret: string, method: string, endpoint: string, params?: any, logger?: any) {
    logger?.log(`[Cloudinary] ${method} ${endpoint}`);
    const timestamp = String(Math.round(Date.now() / 1000));
    const signParams = { ...params, timestamp };
    delete signParams.file;
    const signature = generateSignature(signParams, apiSecret);

    if (method === 'GET') {
        const url = new URL(`${CLOUDINARY_BASE}/${cloudName}${endpoint}`);
        if (params) {
            for (const [k, v] of Object.entries(params)) {
                url.searchParams.set(k, String(v));
            }
        }
        url.searchParams.set('api_key', apiKey);
        url.searchParams.set('timestamp', timestamp);
        url.searchParams.set('signature', signature);
        const res = await fetch(url.toString());
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error?.message || `Cloudinary API error: ${res.status}`);
        return data;
    }

    const body = new FormData();
    body.append('api_key', apiKey);
    body.append('timestamp', timestamp);
    body.append('signature', signature);
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            if (v !== undefined) body.append(k, String(v));
        }
    }
    const res = await fetch(`${CLOUDINARY_UPLOAD_BASE}/${cloudName}${endpoint}`, { method, body });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `Cloudinary API error: ${res.status}`);
    return data;
}

export async function executeCloudinaryAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const cloudName = String(inputs.cloudName ?? '').trim();
        const apiKey = String(inputs.apiKey ?? '').trim();
        const apiSecret = String(inputs.apiSecret ?? '').trim();
        if (!cloudName || !apiKey || !apiSecret) throw new Error('cloudName, apiKey, and apiSecret are required.');

        switch (actionName) {
            case 'uploadImage': {
                const file = String(inputs.file ?? '').trim();
                const folder = String(inputs.folder ?? '').trim();
                const publicId = String(inputs.publicId ?? '').trim();
                const transformation = String(inputs.transformation ?? '').trim();
                if (!file) throw new Error('file (URL or base64) is required.');
                const params: any = { file };
                if (folder) params.folder = folder;
                if (publicId) params.public_id = publicId;
                if (transformation) params.transformation = transformation;
                const data = await cloudinaryApi(cloudName, apiKey, apiSecret, 'POST', '/image/upload', params, logger);
                return { output: { publicId: data.public_id, url: data.url, secureUrl: data.secure_url, format: data.format, width: String(data.width), height: String(data.height) } };
            }

            case 'uploadVideo': {
                const file = String(inputs.file ?? '').trim();
                const folder = String(inputs.folder ?? '').trim();
                if (!file) throw new Error('file is required.');
                const params: any = { file };
                if (folder) params.folder = folder;
                const data = await cloudinaryApi(cloudName, apiKey, apiSecret, 'POST', '/video/upload', params, logger);
                return { output: { publicId: data.public_id, url: data.url, secureUrl: data.secure_url, format: data.format, duration: String(data.duration ?? '') } };
            }

            case 'uploadFile': {
                const file = String(inputs.file ?? '').trim();
                const folder = String(inputs.folder ?? '').trim();
                const resourceType = String(inputs.resourceType ?? 'raw').trim();
                if (!file) throw new Error('file is required.');
                const params: any = { file };
                if (folder) params.folder = folder;
                const data = await cloudinaryApi(cloudName, apiKey, apiSecret, 'POST', `/${resourceType}/upload`, params, logger);
                return { output: { publicId: data.public_id, url: data.url, secureUrl: data.secure_url } };
            }

            case 'getResource': {
                const publicId = String(inputs.publicId ?? '').trim();
                const resourceType = String(inputs.resourceType ?? 'image').trim();
                if (!publicId) throw new Error('publicId is required.');
                const data = await cloudinaryApi(cloudName, apiKey, apiSecret, 'GET', `/resources/${resourceType}/upload/${publicId}`, {}, logger);
                return { output: { publicId: data.public_id, url: data.url, secureUrl: data.secure_url, format: data.format, bytes: String(data.bytes) } };
            }

            case 'deleteResource': {
                const publicId = String(inputs.publicId ?? '').trim();
                const resourceType = String(inputs.resourceType ?? 'image').trim();
                if (!publicId) throw new Error('publicId is required.');
                const data = await cloudinaryApi(cloudName, apiKey, apiSecret, 'POST', `/resources/${resourceType}/upload`, { public_ids: [publicId] }, logger);
                return { output: { deleted: JSON.stringify(data.deleted ?? {}), result: 'ok' } };
            }

            case 'listResources': {
                const resourceType = String(inputs.resourceType ?? 'image').trim();
                const folder = String(inputs.folder ?? '').trim();
                const maxResults = Number(inputs.maxResults ?? 30);
                const params: any = { max_results: maxResults };
                if (folder) params.prefix = folder;
                const data = await cloudinaryApi(cloudName, apiKey, apiSecret, 'GET', `/resources/${resourceType}`, params, logger);
                return { output: { resources: data.resources ?? [], count: (data.resources ?? []).length } };
            }

            case 'transformImage': {
                const publicId = String(inputs.publicId ?? '').trim();
                const width = inputs.width ? Number(inputs.width) : undefined;
                const height = inputs.height ? Number(inputs.height) : undefined;
                const crop = String(inputs.crop ?? 'fill').trim();
                const format = String(inputs.format ?? '').trim();
                const quality = String(inputs.quality ?? 'auto').trim();
                if (!publicId) throw new Error('publicId is required.');
                let transform = '';
                if (width) transform += `w_${width},`;
                if (height) transform += `h_${height},`;
                transform += `c_${crop},q_${quality}`;
                const ext = format || 'jpg';
                const url = `https://res.cloudinary.com/${cloudName}/image/upload/${transform}/${publicId}.${ext}`;
                return { output: { url, transformedUrl: url } };
            }

            case 'generateSignature': {
                const paramsToSign = inputs.params;
                if (!paramsToSign) throw new Error('params are required.');
                const paramsObj = typeof paramsToSign === 'string' ? JSON.parse(paramsToSign) : paramsToSign;
                const timestamp = String(Math.round(Date.now() / 1000));
                paramsObj.timestamp = timestamp;
                const signature = generateSignature(paramsObj, apiSecret);
                return { output: { signature, timestamp, apiKey } };
            }

            case 'createUploadPreset': {
                const presetName = String(inputs.presetName ?? '').trim();
                const folder = String(inputs.folder ?? '').trim();
                const unsigned = inputs.unsigned === true || inputs.unsigned === 'true';
                if (!presetName) throw new Error('presetName is required.');
                const params: any = { name: presetName, unsigned: String(unsigned) };
                if (folder) params.folder = folder;
                const data = await cloudinaryApi(cloudName, apiKey, apiSecret, 'POST', '/upload_presets', params, logger);
                return { output: { name: data.name ?? presetName, unsigned: String(data.unsigned ?? unsigned) } };
            }

            case 'addTag': {
                const publicIds = inputs.publicIds;
                const tag = String(inputs.tag ?? '').trim();
                if (!publicIds || !tag) throw new Error('publicIds and tag are required.');
                const ids = Array.isArray(publicIds) ? publicIds : publicIds.split(',').map((s: string) => s.trim());
                const data = await cloudinaryApi(cloudName, apiKey, apiSecret, 'POST', '/image/tags', { public_ids: ids.join(','), tag }, logger);
                return { output: { publicIds: data.public_ids ?? ids, tag } };
            }

            default:
                return { error: `Cloudinary action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Cloudinary action failed.' };
    }
}
