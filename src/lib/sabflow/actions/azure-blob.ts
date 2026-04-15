'use server';

export async function executeAzureBlobAction(actionName: string, inputs: any, user: any, logger: any) {
    const accountName = inputs.accountName;
    const sasToken = inputs.sasToken;
    const accessToken = inputs.accessToken;
    const baseUrl = `https://${accountName}.blob.core.windows.net`;

    function authHeaders(): Record<string, string> {
        if (accessToken) {
            return { 'Authorization': `Bearer ${accessToken}` };
        }
        return {};
    }

    function sasParam(): string {
        return sasToken ? `?${sasToken}` : '';
    }

    function sasAmpParam(): string {
        return sasToken ? `&${sasToken}` : '';
    }

    try {
        switch (actionName) {
            case 'listContainers': {
                const url = `${baseUrl}/?comp=list${sasParam()}`;
                const res = await fetch(url, { headers: authHeaders() });
                const text = await res.text();
                return { output: { status: res.status, body: text } };
            }

            case 'createContainer': {
                const containerName = inputs.containerName;
                const url = `${baseUrl}/${containerName}?restype=container${sasAmpParam()}`;
                const res = await fetch(url, { method: 'PUT', headers: authHeaders() });
                return { output: { status: res.status, created: res.ok } };
            }

            case 'deleteContainer': {
                const containerName = inputs.containerName;
                const url = `${baseUrl}/${containerName}?restype=container${sasAmpParam()}`;
                const res = await fetch(url, { method: 'DELETE', headers: authHeaders() });
                return { output: { status: res.status, deleted: res.ok } };
            }

            case 'listBlobs': {
                const containerName = inputs.containerName;
                const prefix = inputs.prefix ? `&prefix=${encodeURIComponent(inputs.prefix)}` : '';
                const url = `${baseUrl}/${containerName}?restype=container&comp=list${prefix}${sasAmpParam()}`;
                const res = await fetch(url, { headers: authHeaders() });
                const text = await res.text();
                return { output: { status: res.status, body: text } };
            }

            case 'getBlob': {
                const containerName = inputs.containerName;
                const blobName = inputs.blobName;
                const url = `${baseUrl}/${containerName}/${blobName}${sasParam()}`;
                const res = await fetch(url, { headers: authHeaders() });
                const contentType = res.headers.get('content-type') || '';
                let body: any;
                if (contentType.includes('application/json')) {
                    body = await res.json();
                } else {
                    body = await res.text();
                }
                return { output: { status: res.status, contentType, body } };
            }

            case 'uploadBlob': {
                const containerName = inputs.containerName;
                const blobName = inputs.blobName;
                const content = inputs.content || '';
                const blobType = inputs.blobType || 'BlockBlob';
                const contentType = inputs.contentType || 'application/octet-stream';
                const url = `${baseUrl}/${containerName}/${blobName}${sasParam()}`;
                const headers: Record<string, string> = {
                    ...authHeaders(),
                    'x-ms-blob-type': blobType,
                    'Content-Type': contentType,
                };
                const res = await fetch(url, { method: 'PUT', headers, body: content });
                return { output: { status: res.status, uploaded: res.ok } };
            }

            case 'deleteBlob': {
                const containerName = inputs.containerName;
                const blobName = inputs.blobName;
                const url = `${baseUrl}/${containerName}/${blobName}${sasParam()}`;
                const res = await fetch(url, { method: 'DELETE', headers: authHeaders() });
                return { output: { status: res.status, deleted: res.ok } };
            }

            case 'copyBlob': {
                const destContainer = inputs.destContainer;
                const destBlob = inputs.destBlob;
                const sourceUrl = inputs.sourceUrl;
                const url = `${baseUrl}/${destContainer}/${destBlob}${sasParam()}`;
                const headers: Record<string, string> = {
                    ...authHeaders(),
                    'x-ms-copy-source': sourceUrl,
                };
                const res = await fetch(url, { method: 'PUT', headers });
                return { output: { status: res.status, copyId: res.headers.get('x-ms-copy-id') } };
            }

            case 'getBlobProperties': {
                const containerName = inputs.containerName;
                const blobName = inputs.blobName;
                const url = `${baseUrl}/${containerName}/${blobName}${sasParam()}`;
                const res = await fetch(url, { method: 'HEAD', headers: authHeaders() });
                const props: Record<string, string | null> = {};
                res.headers.forEach((value, key) => { props[key] = value; });
                return { output: { status: res.status, properties: props } };
            }

            case 'setBlobMetadata': {
                const containerName = inputs.containerName;
                const blobName = inputs.blobName;
                const metadata = inputs.metadata || {};
                const url = `${baseUrl}/${containerName}/${blobName}?comp=metadata${sasAmpParam()}`;
                const headers: Record<string, string> = { ...authHeaders() };
                for (const [k, v] of Object.entries(metadata)) {
                    headers[`x-ms-meta-${k}`] = String(v);
                }
                const res = await fetch(url, { method: 'PUT', headers });
                return { output: { status: res.status, ok: res.ok } };
            }

            case 'createBlobSnapshot': {
                const containerName = inputs.containerName;
                const blobName = inputs.blobName;
                const url = `${baseUrl}/${containerName}/${blobName}?comp=snapshot${sasAmpParam()}`;
                const res = await fetch(url, { method: 'PUT', headers: authHeaders() });
                return { output: { status: res.status, snapshotTime: res.headers.get('x-ms-snapshot') } };
            }

            case 'getContainerProperties': {
                const containerName = inputs.containerName;
                const url = `${baseUrl}/${containerName}?restype=container${sasAmpParam()}`;
                const res = await fetch(url, { method: 'HEAD', headers: authHeaders() });
                const props: Record<string, string | null> = {};
                res.headers.forEach((value, key) => { props[key] = value; });
                return { output: { status: res.status, properties: props } };
            }

            case 'setContainerMetadata': {
                const containerName = inputs.containerName;
                const metadata = inputs.metadata || {};
                const url = `${baseUrl}/${containerName}?restype=container&comp=metadata${sasAmpParam()}`;
                const headers: Record<string, string> = { ...authHeaders() };
                for (const [k, v] of Object.entries(metadata)) {
                    headers[`x-ms-meta-${k}`] = String(v);
                }
                const res = await fetch(url, { method: 'PUT', headers });
                return { output: { status: res.status, ok: res.ok } };
            }

            case 'generateSasUrl': {
                const containerName = inputs.containerName;
                const blobName = inputs.blobName || '';
                const path = blobName ? `/${containerName}/${blobName}` : `/${containerName}`;
                const url = `${baseUrl}${path}?${sasToken}`;
                return { output: { sasUrl: url } };
            }

            case 'getAccountInfo': {
                const url = `${baseUrl}/?comp=properties${sasAmpParam()}`;
                const res = await fetch(url, { headers: authHeaders() });
                const text = await res.text();
                return { output: { status: res.status, body: text } };
            }

            default:
                return { error: `Unknown Azure Blob action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Azure Blob action error: ${err.message}`);
        return { error: err.message || 'Azure Blob action failed' };
    }
}
