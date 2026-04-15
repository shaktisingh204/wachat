'use server';

export async function executeGoogleCloudStorageAction(actionName: string, inputs: any, user: any, logger: any) {
    const { accessToken, projectId, bucket, objectName, destinationBucket, destinationObject } = inputs;
    const base = 'https://storage.googleapis.com/storage/v1';
    const uploadBase = 'https://storage.googleapis.com/upload/storage/v1';
    const headers: Record<string, string> = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listBuckets': {
                const params = new URLSearchParams({ project: projectId });
                if (inputs.maxResults) params.set('maxResults', String(inputs.maxResults));
                if (inputs.pageToken) params.set('pageToken', inputs.pageToken);
                if (inputs.prefix) params.set('prefix', inputs.prefix);
                const res = await fetch(`${base}/b?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'listBuckets failed' };
                return { output: data };
            }
            case 'createBucket': {
                const params = new URLSearchParams({ project: projectId });
                const body: any = { name: bucket };
                if (inputs.location) body.location = inputs.location;
                if (inputs.storageClass) body.storageClass = inputs.storageClass;
                const res = await fetch(`${base}/b?${params}`, {
                    method: 'POST', headers, body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'createBucket failed' };
                return { output: data };
            }
            case 'deleteBucket': {
                const res = await fetch(`${base}/b/${bucket}`, { method: 'DELETE', headers });
                if (res.status === 204 || res.ok) return { output: { success: true } };
                const data = await res.json();
                return { error: data.error?.message || 'deleteBucket failed' };
            }
            case 'getBucketMetadata': {
                const res = await fetch(`${base}/b/${bucket}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'getBucketMetadata failed' };
                return { output: data };
            }
            case 'listObjects': {
                const params = new URLSearchParams();
                if (inputs.prefix) params.set('prefix', inputs.prefix);
                if (inputs.delimiter) params.set('delimiter', inputs.delimiter);
                if (inputs.maxResults) params.set('maxResults', String(inputs.maxResults));
                if (inputs.pageToken) params.set('pageToken', inputs.pageToken);
                const res = await fetch(`${base}/b/${bucket}/o?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'listObjects failed' };
                return { output: data };
            }
            case 'getObject': {
                const res = await fetch(`${base}/b/${bucket}/o/${encodeURIComponent(objectName)}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'getObject failed' };
                return { output: data };
            }
            case 'downloadObject': {
                const res = await fetch(`${base}/b/${bucket}/o/${encodeURIComponent(objectName)}?alt=media`, { headers });
                if (!res.ok) {
                    const data = await res.json();
                    return { error: data.error?.message || 'downloadObject failed' };
                }
                const contentType = res.headers.get('content-type') || 'application/octet-stream';
                const buffer = await res.arrayBuffer();
                const base64Content = Buffer.from(buffer).toString('base64');
                return { output: { content: base64Content, contentType, encoding: 'base64' } };
            }
            case 'uploadObject': {
                const content = inputs.content;
                const contentType = inputs.contentType || 'application/octet-stream';
                const params = new URLSearchParams({ uploadType: 'multipart', name: objectName });
                const boundary = 'boundary_gcs_upload';
                const metadataJson = JSON.stringify({ name: objectName, contentType });
                const bodyContent = inputs.isBase64
                    ? Buffer.from(content, 'base64')
                    : Buffer.from(content);
                const multipartBody = [
                    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${metadataJson}\r\n`,
                    `--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`,
                ].join('');
                const endBoundary = `\r\n--${boundary}--`;
                const fullBody = Buffer.concat([
                    Buffer.from(multipartBody),
                    bodyContent,
                    Buffer.from(endBoundary),
                ]);
                const uploadHeaders = {
                    ...headers,
                    'Content-Type': `multipart/related; boundary=${boundary}`,
                };
                const res = await fetch(`${uploadBase}/b/${bucket}/o?${params}`, {
                    method: 'POST',
                    headers: uploadHeaders,
                    body: fullBody,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'uploadObject failed' };
                return { output: data };
            }
            case 'deleteObject': {
                const res = await fetch(`${base}/b/${bucket}/o/${encodeURIComponent(objectName)}`, {
                    method: 'DELETE', headers,
                });
                if (res.status === 204 || res.ok) return { output: { success: true } };
                const data = await res.json();
                return { error: data.error?.message || 'deleteObject failed' };
            }
            case 'copyObject': {
                const destBucket = destinationBucket || bucket;
                const destObject = destinationObject || objectName;
                const res = await fetch(
                    `${base}/b/${bucket}/o/${encodeURIComponent(objectName)}/copyTo/b/${destBucket}/o/${encodeURIComponent(destObject)}`,
                    { method: 'POST', headers, body: JSON.stringify({}) },
                );
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'copyObject failed' };
                return { output: data };
            }
            case 'moveObject': {
                const destBucket = destinationBucket || bucket;
                const destObject = destinationObject || objectName;
                const copyRes = await fetch(
                    `${base}/b/${bucket}/o/${encodeURIComponent(objectName)}/copyTo/b/${destBucket}/o/${encodeURIComponent(destObject)}`,
                    { method: 'POST', headers, body: JSON.stringify({}) },
                );
                const copyData = await copyRes.json();
                if (!copyRes.ok) return { error: copyData.error?.message || 'moveObject (copy) failed' };
                const delRes = await fetch(`${base}/b/${bucket}/o/${encodeURIComponent(objectName)}`, {
                    method: 'DELETE', headers,
                });
                if (!delRes.ok && delRes.status !== 204) {
                    return { error: 'moveObject: copy succeeded but delete source failed' };
                }
                return { output: copyData };
            }
            case 'setObjectMetadata': {
                const metadata = inputs.metadata || {};
                const body: any = { metadata };
                if (inputs.contentType) body.contentType = inputs.contentType;
                if (inputs.cacheControl) body.cacheControl = inputs.cacheControl;
                const res = await fetch(`${base}/b/${bucket}/o/${encodeURIComponent(objectName)}`, {
                    method: 'PATCH', headers, body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'setObjectMetadata failed' };
                return { output: data };
            }
            case 'makeObjectPublic': {
                const body = { entity: 'allUsers', role: 'READER' };
                const res = await fetch(`${base}/b/${bucket}/o/${encodeURIComponent(objectName)}/acl`, {
                    method: 'POST', headers, body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'makeObjectPublic failed' };
                const publicUrl = `https://storage.googleapis.com/${bucket}/${objectName}`;
                return { output: { ...data, publicUrl } };
            }
            case 'getSignedUrl': {
                // Construct a simple signed URL placeholder using object details
                const expiry = inputs.expiry || '3600';
                const method = inputs.method || 'GET';
                const signedUrl = `https://storage.googleapis.com/${bucket}/${encodeURIComponent(objectName)}?X-Goog-Expires=${expiry}&X-Goog-SignedHeaders=host&method=${method}`;
                return { output: { signedUrl, note: 'Use Google Cloud client library for proper HMAC signing' } };
            }
            case 'listBucketIamPolicies': {
                const res = await fetch(`${base}/b/${bucket}/iam`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'listBucketIamPolicies failed' };
                return { output: data };
            }
            default:
                return { error: `Unknown Cloud Storage action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Cloud Storage action error: ${err.message}`);
        return { error: err.message || 'Cloud Storage action failed' };
    }
}
