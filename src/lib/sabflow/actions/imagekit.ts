'use server';

const IK_BASE = 'https://api.imagekit.io/v1';

async function ikFetch(
    privateKey: string,
    method: string,
    path: string,
    body?: any,
    isFormData?: boolean,
    logger?: any
): Promise<any> {
    const url = `${IK_BASE}${path}`;
    logger?.log(`[ImageKit] ${method} ${path}`);

    const authHeader = `Basic ${Buffer.from(`${privateKey}:`).toString('base64')}`;

    const options: RequestInit = {
        method,
        headers: {
            Authorization: authHeader,
            ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        },
    };

    if (body !== undefined) {
        if (isFormData) {
            options.body = body;
        } else {
            options.body = JSON.stringify(body);
        }
    }

    const res = await fetch(url, options);

    if (res.status === 204) return {};

    const text = await res.text();
    let data: any;
    try {
        data = JSON.parse(text);
    } catch {
        data = { raw: text };
    }

    if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
    return data;
}

export async function executeImagekitAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const privateKey: string = inputs.privateKey;
        const imagekitId: string = inputs.imagekitId;
        const cdnBase = `https://ik.imagekit.io/${imagekitId}`;

        switch (actionName) {
            case 'uploadFile': {
                const form = new FormData();
                form.append('fileName', inputs.fileName);
                form.append('file', inputs.file);
                if (inputs.folder) form.append('folder', inputs.folder);
                if (inputs.tags) form.append('tags', Array.isArray(inputs.tags) ? inputs.tags.join(',') : inputs.tags);
                if (inputs.useUniqueFileName !== undefined) form.append('useUniqueFileName', String(inputs.useUniqueFileName));
                const data = await ikFetch(privateKey, 'POST', '/files/upload', form, true, logger);
                return { output: { ...data, cdnBase } };
            }

            case 'listFiles': {
                const params = new URLSearchParams();
                if (inputs.type) params.set('type', inputs.type);
                if (inputs.sort) params.set('sort', inputs.sort);
                if (inputs.path) params.set('path', inputs.path);
                if (inputs.fileType) params.set('fileType', inputs.fileType);
                if (inputs.tags) params.set('tags', inputs.tags);
                if (inputs.includeFolder !== undefined) params.set('includeFolder', String(inputs.includeFolder));
                if (inputs.name) params.set('name', inputs.name);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.skip) params.set('skip', String(inputs.skip));
                const data = await ikFetch(privateKey, 'GET', `/files?${params}`, undefined, false, logger);
                return { output: data };
            }

            case 'getFileDetails': {
                const data = await ikFetch(privateKey, 'GET', `/files/${inputs.fileId}/details`, undefined, false, logger);
                return { output: data };
            }

            case 'updateFileDetails': {
                const body: any = {};
                if (inputs.tags !== undefined) body.tags = inputs.tags;
                if (inputs.customCoordinates !== undefined) body.customCoordinates = inputs.customCoordinates;
                if (inputs.removeAITags !== undefined) body.removeAITags = inputs.removeAITags;
                if (inputs.extensions !== undefined) body.extensions = inputs.extensions;
                if (inputs.webhookUrl !== undefined) body.webhookUrl = inputs.webhookUrl;
                const data = await ikFetch(privateKey, 'PATCH', `/files/${inputs.fileId}/details`, body, false, logger);
                return { output: data };
            }

            case 'deleteFile': {
                const data = await ikFetch(privateKey, 'DELETE', `/files/${inputs.fileId}`, undefined, false, logger);
                return { output: data };
            }

            case 'bulkDeleteFiles': {
                const data = await ikFetch(privateKey, 'POST', '/files/batch/deleteByFileIds', {
                    fileIds: inputs.fileIds,
                }, false, logger);
                return { output: data };
            }

            case 'copyFile': {
                const data = await ikFetch(privateKey, 'POST', '/files/copy', {
                    sourceFilePath: inputs.sourceFilePath,
                    destinationPath: inputs.destinationPath,
                    includeFileVersions: inputs.includeFileVersions ?? false,
                }, false, logger);
                return { output: data };
            }

            case 'moveFile': {
                const data = await ikFetch(privateKey, 'POST', '/files/move', {
                    sourceFilePath: inputs.sourceFilePath,
                    destinationPath: inputs.destinationPath,
                }, false, logger);
                return { output: data };
            }

            case 'renameFile': {
                const data = await ikFetch(privateKey, 'PUT', '/files/rename', {
                    filePath: inputs.filePath,
                    newFileName: inputs.newFileName,
                    purgeCache: inputs.purgeCache ?? false,
                }, false, logger);
                return { output: data };
            }

            case 'createFolder': {
                const data = await ikFetch(privateKey, 'POST', '/folder', {
                    folderName: inputs.folderName,
                    parentFolderPath: inputs.parentFolderPath ?? '/',
                }, false, logger);
                return { output: data };
            }

            case 'deleteFolder': {
                const data = await ikFetch(privateKey, 'DELETE', '/folder', {
                    folderPath: inputs.folderPath,
                }, false, logger);
                return { output: data };
            }

            case 'getFolder': {
                const params = new URLSearchParams();
                params.set('path', inputs.path);
                const data = await ikFetch(privateKey, 'GET', `/files?${params}`, undefined, false, logger);
                return { output: data };
            }

            case 'purgeCache': {
                const data = await ikFetch(privateKey, 'POST', '/files/purge', {
                    url: inputs.url,
                }, false, logger);
                return { output: data };
            }

            case 'getPurgeCacheStatus': {
                const data = await ikFetch(privateKey, 'GET', `/files/purge/${inputs.requestId}`, undefined, false, logger);
                return { output: data };
            }

            case 'getUsage': {
                const data = await ikFetch(privateKey, 'GET', '/usage', undefined, false, logger);
                return { output: { ...data, cdnBase } };
            }

            default:
                return { error: `ImageKit action "${actionName}" is not supported.` };
        }
    } catch (err: any) {
        logger?.log(`[ImageKit] Error: ${err.message}`);
        return { error: err.message || 'Unknown error from ImageKit' };
    }
}
