
'use server';

async function appwriteRequest(
    method: string,
    url: string,
    projectId: string,
    apiKey: string,
    body?: any,
    isMultipart?: boolean
): Promise<any> {
    const headers: Record<string, string> = {
        'X-Appwrite-Project': projectId,
        'X-Appwrite-Key': apiKey,
    };
    if (!isMultipart) headers['Content-Type'] = 'application/json';

    const res = await fetch(url, {
        method,
        headers,
        ...(body !== undefined ? { body: isMultipart ? body : JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) {
        const msg = data?.message || text || `HTTP ${res.status}`;
        throw new Error(msg);
    }
    return data;
}

export async function executeAppwriteAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const serverUrl = String(inputs.serverUrl ?? '').replace(/\/$/, '').trim();
        if (!serverUrl) throw new Error('"serverUrl" is required.');
        const projectId = String(inputs.projectId ?? '').trim();
        if (!projectId) throw new Error('"projectId" is required.');
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('"apiKey" is required.');
        const base = `${serverUrl}/v1`;

        switch (actionName) {
            case 'listDocuments': {
                const databaseId = String(inputs.databaseId ?? '').trim();
                const collectionId = String(inputs.collectionId ?? '').trim();
                if (!databaseId) throw new Error('"databaseId" is required.');
                if (!collectionId) throw new Error('"collectionId" is required.');
                logger.log(`[Appwrite] listDocuments db=${databaseId} col=${collectionId}`);
                const data = await appwriteRequest('GET', `${base}/databases/${encodeURIComponent(databaseId)}/collections/${encodeURIComponent(collectionId)}/documents`, projectId, apiKey);
                return { output: data };
            }

            case 'getDocument': {
                const databaseId = String(inputs.databaseId ?? '').trim();
                const collectionId = String(inputs.collectionId ?? '').trim();
                const documentId = String(inputs.documentId ?? '').trim();
                if (!databaseId || !collectionId || !documentId) throw new Error('"databaseId", "collectionId", and "documentId" are required.');
                logger.log(`[Appwrite] getDocument ${documentId}`);
                const data = await appwriteRequest('GET', `${base}/databases/${encodeURIComponent(databaseId)}/collections/${encodeURIComponent(collectionId)}/documents/${encodeURIComponent(documentId)}`, projectId, apiKey);
                return { output: data };
            }

            case 'createDocument': {
                const databaseId = String(inputs.databaseId ?? '').trim();
                const collectionId = String(inputs.collectionId ?? '').trim();
                const docData = inputs.data ?? {};
                const permissions = inputs.permissions ?? [];
                if (!databaseId || !collectionId) throw new Error('"databaseId" and "collectionId" are required.');
                logger.log(`[Appwrite] createDocument db=${databaseId} col=${collectionId}`);
                const data = await appwriteRequest('POST', `${base}/databases/${encodeURIComponent(databaseId)}/collections/${encodeURIComponent(collectionId)}/documents`, projectId, apiKey, { documentId: 'unique()', data: docData, permissions });
                return { output: data };
            }

            case 'updateDocument': {
                const databaseId = String(inputs.databaseId ?? '').trim();
                const collectionId = String(inputs.collectionId ?? '').trim();
                const documentId = String(inputs.documentId ?? '').trim();
                const docData = inputs.data ?? {};
                if (!databaseId || !collectionId || !documentId) throw new Error('"databaseId", "collectionId", and "documentId" are required.');
                logger.log(`[Appwrite] updateDocument ${documentId}`);
                const data = await appwriteRequest('PATCH', `${base}/databases/${encodeURIComponent(databaseId)}/collections/${encodeURIComponent(collectionId)}/documents/${encodeURIComponent(documentId)}`, projectId, apiKey, { data: docData });
                return { output: data };
            }

            case 'deleteDocument': {
                const databaseId = String(inputs.databaseId ?? '').trim();
                const collectionId = String(inputs.collectionId ?? '').trim();
                const documentId = String(inputs.documentId ?? '').trim();
                if (!databaseId || !collectionId || !documentId) throw new Error('"databaseId", "collectionId", and "documentId" are required.');
                logger.log(`[Appwrite] deleteDocument ${documentId}`);
                await appwriteRequest('DELETE', `${base}/databases/${encodeURIComponent(databaseId)}/collections/${encodeURIComponent(collectionId)}/documents/${encodeURIComponent(documentId)}`, projectId, apiKey);
                return { output: { success: true, deleted: documentId } };
            }

            case 'createDatabase': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('"name" is required.');
                const databaseId = String(inputs.databaseId ?? 'unique()').trim();
                logger.log(`[Appwrite] createDatabase: ${name}`);
                const data = await appwriteRequest('POST', `${base}/databases`, projectId, apiKey, { databaseId, name });
                return { output: data };
            }

            case 'listDatabases': {
                logger.log('[Appwrite] listDatabases');
                const data = await appwriteRequest('GET', `${base}/databases`, projectId, apiKey);
                return { output: data };
            }

            case 'getDatabase': {
                const databaseId = String(inputs.databaseId ?? '').trim();
                if (!databaseId) throw new Error('"databaseId" is required.');
                logger.log(`[Appwrite] getDatabase: ${databaseId}`);
                const data = await appwriteRequest('GET', `${base}/databases/${encodeURIComponent(databaseId)}`, projectId, apiKey);
                return { output: data };
            }

            case 'listCollections': {
                const databaseId = String(inputs.databaseId ?? '').trim();
                if (!databaseId) throw new Error('"databaseId" is required.');
                logger.log(`[Appwrite] listCollections db=${databaseId}`);
                const data = await appwriteRequest('GET', `${base}/databases/${encodeURIComponent(databaseId)}/collections`, projectId, apiKey);
                return { output: data };
            }

            case 'createCollection': {
                const databaseId = String(inputs.databaseId ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                if (!databaseId) throw new Error('"databaseId" is required.');
                if (!name) throw new Error('"name" is required.');
                const collectionId = String(inputs.collectionId ?? 'unique()').trim();
                logger.log(`[Appwrite] createCollection: ${name}`);
                const data = await appwriteRequest('POST', `${base}/databases/${encodeURIComponent(databaseId)}/collections`, projectId, apiKey, { collectionId, name, permissions: inputs.permissions ?? [] });
                return { output: data };
            }

            case 'listBuckets': {
                logger.log('[Appwrite] listBuckets');
                const data = await appwriteRequest('GET', `${base}/storage/buckets`, projectId, apiKey);
                return { output: data };
            }

            case 'uploadFile': {
                const bucketId = String(inputs.bucketId ?? '').trim();
                const fileContent = inputs.fileContent;
                const fileName = String(inputs.fileName ?? 'upload').trim();
                const mimeType = String(inputs.mimeType ?? 'application/octet-stream').trim();
                if (!bucketId) throw new Error('"bucketId" is required.');
                if (!fileContent) throw new Error('"fileContent" is required.');
                logger.log(`[Appwrite] uploadFile bucket=${bucketId} name=${fileName}`);
                const formData = new FormData();
                formData.append('fileId', String(inputs.fileId ?? 'unique()'));
                const blob = new Blob([typeof fileContent === 'string' ? fileContent : JSON.stringify(fileContent)], { type: mimeType });
                formData.append('file', blob, fileName);
                if (inputs.permissions) formData.append('permissions', JSON.stringify(inputs.permissions));
                const data = await appwriteRequest('POST', `${base}/storage/buckets/${encodeURIComponent(bucketId)}/files`, projectId, apiKey, formData, true);
                return { output: data };
            }

            case 'getFile': {
                const bucketId = String(inputs.bucketId ?? '').trim();
                const fileId = String(inputs.fileId ?? '').trim();
                if (!bucketId || !fileId) throw new Error('"bucketId" and "fileId" are required.');
                logger.log(`[Appwrite] getFile ${fileId}`);
                const data = await appwriteRequest('GET', `${base}/storage/buckets/${encodeURIComponent(bucketId)}/files/${encodeURIComponent(fileId)}`, projectId, apiKey);
                return { output: data };
            }

            case 'deleteFile': {
                const bucketId = String(inputs.bucketId ?? '').trim();
                const fileId = String(inputs.fileId ?? '').trim();
                if (!bucketId || !fileId) throw new Error('"bucketId" and "fileId" are required.');
                logger.log(`[Appwrite] deleteFile ${fileId}`);
                await appwriteRequest('DELETE', `${base}/storage/buckets/${encodeURIComponent(bucketId)}/files/${encodeURIComponent(fileId)}`, projectId, apiKey);
                return { output: { success: true, deleted: fileId } };
            }

            case 'createUser': {
                const email = String(inputs.email ?? '').trim();
                const password = String(inputs.password ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                if (!email || !password) throw new Error('"email" and "password" are required.');
                logger.log(`[Appwrite] createUser email=${email}`);
                const data = await appwriteRequest('POST', `${base}/users`, projectId, apiKey, { userId: String(inputs.userId ?? 'unique()'), email, password, name: name || undefined });
                return { output: data };
            }

            case 'listUsers': {
                logger.log('[Appwrite] listUsers');
                const data = await appwriteRequest('GET', `${base}/users`, projectId, apiKey);
                return { output: data };
            }

            case 'getUser': {
                const userId = String(inputs.userId ?? '').trim();
                if (!userId) throw new Error('"userId" is required.');
                logger.log(`[Appwrite] getUser ${userId}`);
                const data = await appwriteRequest('GET', `${base}/users/${encodeURIComponent(userId)}`, projectId, apiKey);
                return { output: data };
            }

            case 'createSession': {
                const userId = String(inputs.userId ?? '').trim();
                if (!userId) throw new Error('"userId" is required.');
                logger.log(`[Appwrite] createSession for user=${userId}`);
                const data = await appwriteRequest('POST', `${base}/users/${encodeURIComponent(userId)}/sessions`, projectId, apiKey);
                return { output: data };
            }

            case 'listFunctions': {
                logger.log('[Appwrite] listFunctions');
                const data = await appwriteRequest('GET', `${base}/functions`, projectId, apiKey);
                return { output: data };
            }

            case 'executeFunction': {
                const functionId = String(inputs.functionId ?? '').trim();
                if (!functionId) throw new Error('"functionId" is required.');
                logger.log(`[Appwrite] executeFunction ${functionId}`);
                const body: any = {};
                if (inputs.data) body.data = typeof inputs.data === 'string' ? inputs.data : JSON.stringify(inputs.data);
                if (inputs.async !== undefined) body.async = inputs.async;
                const data = await appwriteRequest('POST', `${base}/functions/${encodeURIComponent(functionId)}/executions`, projectId, apiKey, body);
                return { output: data };
            }

            default:
                throw new Error(`Unknown Appwrite action: "${actionName}"`);
        }
    } catch (err: any) {
        logger.log(`[Appwrite] Error in ${actionName}: ${err.message}`);
        return { error: err.message || 'Unknown Appwrite error' };
    }
}
