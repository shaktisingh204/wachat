'use server';

import { createHmac, createHash } from 'crypto';

function sha256(d: string): string { return createHash('sha256').update(d).digest('hex'); }
function hmac(k: Buffer | string, d: string): Buffer { return createHmac('sha256', k).update(d).digest(); }
function signingKey(secret: string, date: string, region: string, svc: string): Buffer {
    return hmac(hmac(hmac(hmac('AWS4' + secret, date), region), svc), 'aws4_request');
}
function awsFetch(method: string, url: string, region: string, svc: string, keyId: string, secret: string, body: string, contentType = 'application/xml', extraHeaders: Record<string, string> = {}) {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
    const ds = amzDate.slice(0, 8);
    const u = new URL(url);
    const allHeaders: Record<string, string> = {
        'Content-Type': contentType,
        'X-Amz-Date': amzDate,
        'Host': u.host,
        ...extraHeaders,
    };
    const sh = Object.keys(allHeaders).map(k => k.toLowerCase()).sort().join(';');
    const ch = Object.entries(allHeaders).map(([k, v]) => `${k.toLowerCase()}:${v}\n`).sort().join('');
    const cr = [method, u.pathname, u.search.slice(1), ch, sh, sha256(body)].join('\n');
    const scope = `${ds}/${region}/${svc}/aws4_request`;
    const sts = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256(cr)}`;
    const sig = hmac(signingKey(secret, ds, region, svc), sts).toString('hex');
    allHeaders['Authorization'] = `AWS4-HMAC-SHA256 Credential=${keyId}/${scope},SignedHeaders=${sh},Signature=${sig}`;
    return fetch(url, { method, headers: allHeaders, body: body || undefined });
}

export async function executeAWSS3EnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessKeyId = String(inputs.accessKeyId ?? '').trim();
        const secretAccessKey = String(inputs.secretAccessKey ?? '').trim();
        const region = String(inputs.region ?? 'us-east-1').trim();
        if (!accessKeyId || !secretAccessKey) throw new Error('accessKeyId and secretAccessKey are required.');

        const s3Host = region === 'us-east-1' ? 's3.amazonaws.com' : `s3.${region}.amazonaws.com`;
        const bucketUrl = (bucket: string) => `https://${s3Host}/${encodeURIComponent(bucket)}`;
        const objectUrl = (bucket: string, key: string) => `https://${s3Host}/${encodeURIComponent(bucket)}/${key.split('/').map(encodeURIComponent).join('/')}`;

        switch (actionName) {
            case 'listBuckets': {
                const res = await awsFetch('GET', `https://${s3Host}/`, region, 's3', accessKeyId, secretAccessKey, '');
                const text = await res.text();
                if (!res.ok) throw new Error(text);
                return { output: { xml: text } };
            }

            case 'createBucket': {
                const bucket = String(inputs.bucket ?? '').trim();
                if (!bucket) throw new Error('bucket is required.');
                const body = region === 'us-east-1' ? '' : `<CreateBucketConfiguration><LocationConstraint>${region}</LocationConstraint></CreateBucketConfiguration>`;
                const res = await awsFetch('PUT', `${bucketUrl(bucket)}/`, region, 's3', accessKeyId, secretAccessKey, body);
                const text = await res.text();
                if (!res.ok) throw new Error(text);
                return { output: { bucket, created: true } };
            }

            case 'deleteBucket': {
                const bucket = String(inputs.bucket ?? '').trim();
                if (!bucket) throw new Error('bucket is required.');
                const res = await awsFetch('DELETE', `${bucketUrl(bucket)}/`, region, 's3', accessKeyId, secretAccessKey, '');
                if (!res.ok) { const text = await res.text(); throw new Error(text); }
                return { output: { bucket, deleted: true } };
            }

            case 'getBucketLocation': {
                const bucket = String(inputs.bucket ?? '').trim();
                if (!bucket) throw new Error('bucket is required.');
                const res = await awsFetch('GET', `${bucketUrl(bucket)}/?location`, region, 's3', accessKeyId, secretAccessKey, '');
                const text = await res.text();
                if (!res.ok) throw new Error(text);
                return { output: { xml: text } };
            }

            case 'listObjects': {
                const bucket = String(inputs.bucket ?? '').trim();
                const prefix = String(inputs.prefix ?? '');
                const maxKeys = String(inputs.maxKeys ?? '100');
                if (!bucket) throw new Error('bucket is required.');
                const qs = new URLSearchParams({ 'list-type': '2', 'max-keys': maxKeys });
                if (prefix) qs.set('prefix', prefix);
                const res = await awsFetch('GET', `${bucketUrl(bucket)}/?${qs.toString()}`, region, 's3', accessKeyId, secretAccessKey, '');
                const text = await res.text();
                if (!res.ok) throw new Error(text);
                return { output: { xml: text } };
            }

            case 'headObject': {
                const bucket = String(inputs.bucket ?? '').trim();
                const key = String(inputs.key ?? '').trim();
                if (!bucket || !key) throw new Error('bucket and key are required.');
                const res = await awsFetch('HEAD', objectUrl(bucket, key), region, 's3', accessKeyId, secretAccessKey, '');
                if (!res.ok) throw new Error(`HEAD ${res.status}: ${key}`);
                const headers: Record<string, string> = {};
                res.headers.forEach((v, k) => { headers[k] = v; });
                return { output: { exists: true, headers } };
            }

            case 'getObjectMetadata': {
                const bucket = String(inputs.bucket ?? '').trim();
                const key = String(inputs.key ?? '').trim();
                if (!bucket || !key) throw new Error('bucket and key are required.');
                const res = await awsFetch('HEAD', objectUrl(bucket, key), region, 's3', accessKeyId, secretAccessKey, '');
                if (!res.ok) throw new Error(`Object not found: ${key}`);
                const metadata: Record<string, string> = {};
                res.headers.forEach((v, k) => { if (k.startsWith('x-amz-meta-')) metadata[k.replace('x-amz-meta-', '')] = v; });
                return { output: { contentType: res.headers.get('content-type'), contentLength: res.headers.get('content-length'), lastModified: res.headers.get('last-modified'), etag: res.headers.get('etag'), metadata } };
            }

            case 'putObject': {
                const bucket = String(inputs.bucket ?? '').trim();
                const key = String(inputs.key ?? '').trim();
                const body = String(inputs.body ?? '');
                const contentType = String(inputs.contentType ?? 'application/octet-stream');
                if (!bucket || !key) throw new Error('bucket and key are required.');
                const res = await awsFetch('PUT', objectUrl(bucket, key), region, 's3', accessKeyId, secretAccessKey, body, contentType);
                if (!res.ok) { const text = await res.text(); throw new Error(text); }
                return { output: { bucket, key, etag: res.headers.get('etag') } };
            }

            case 'deleteObject': {
                const bucket = String(inputs.bucket ?? '').trim();
                const key = String(inputs.key ?? '').trim();
                if (!bucket || !key) throw new Error('bucket and key are required.');
                const res = await awsFetch('DELETE', objectUrl(bucket, key), region, 's3', accessKeyId, secretAccessKey, '');
                if (!res.ok) { const text = await res.text(); throw new Error(text); }
                return { output: { bucket, key, deleted: true } };
            }

            case 'copyObject': {
                const sourceBucket = String(inputs.sourceBucket ?? '').trim();
                const sourceKey = String(inputs.sourceKey ?? '').trim();
                const destBucket = String(inputs.destBucket ?? '').trim();
                const destKey = String(inputs.destKey ?? '').trim();
                if (!sourceBucket || !sourceKey || !destBucket || !destKey) throw new Error('sourceBucket, sourceKey, destBucket, and destKey are required.');
                const copySource = `/${sourceBucket}/${sourceKey}`;
                const res = await awsFetch('PUT', objectUrl(destBucket, destKey), region, 's3', accessKeyId, secretAccessKey, '', 'application/xml', { 'x-amz-copy-source': copySource });
                const text = await res.text();
                if (!res.ok) throw new Error(text);
                return { output: { destBucket, destKey, xml: text } };
            }

            case 'createPresignedUrl': {
                const bucket = String(inputs.bucket ?? '').trim();
                const key = String(inputs.key ?? '').trim();
                const expiresIn = Number(inputs.expiresIn ?? 3600);
                if (!bucket || !key) throw new Error('bucket and key are required.');
                const now = new Date();
                const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
                const ds = amzDate.slice(0, 8);
                const scope = `${ds}/${region}/s3/aws4_request`;
                const url = new URL(objectUrl(bucket, key));
                url.searchParams.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');
                url.searchParams.set('X-Amz-Credential', `${accessKeyId}/${scope}`);
                url.searchParams.set('X-Amz-Date', amzDate);
                url.searchParams.set('X-Amz-Expires', String(expiresIn));
                url.searchParams.set('X-Amz-SignedHeaders', 'host');
                const cr = ['GET', url.pathname, url.searchParams.toString(), `host:${url.host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n');
                const sts = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256(cr)}`;
                const sig = hmac(signingKey(secretAccessKey, ds, region, 's3'), sts).toString('hex');
                url.searchParams.set('X-Amz-Signature', sig);
                return { output: { presignedUrl: url.toString(), expiresIn } };
            }

            case 'putBucketPolicy': {
                const bucket = String(inputs.bucket ?? '').trim();
                const policy = inputs.policy;
                if (!bucket || !policy) throw new Error('bucket and policy are required.');
                const body = typeof policy === 'string' ? policy : JSON.stringify(policy);
                const res = await awsFetch('PUT', `${bucketUrl(bucket)}/?policy`, region, 's3', accessKeyId, secretAccessKey, body, 'application/json');
                if (!res.ok) { const text = await res.text(); throw new Error(text); }
                return { output: { bucket, policySet: true } };
            }

            case 'getBucketPolicy': {
                const bucket = String(inputs.bucket ?? '').trim();
                if (!bucket) throw new Error('bucket is required.');
                const res = await awsFetch('GET', `${bucketUrl(bucket)}/?policy`, region, 's3', accessKeyId, secretAccessKey, '');
                const text = await res.text();
                if (!res.ok) throw new Error(text);
                let policy: any = text;
                try { policy = JSON.parse(text); } catch {}
                return { output: { bucket, policy } };
            }

            case 'putCorsConfig': {
                const bucket = String(inputs.bucket ?? '').trim();
                const corsConfig = inputs.corsConfig;
                if (!bucket || !corsConfig) throw new Error('bucket and corsConfig are required.');
                const body = typeof corsConfig === 'string' ? corsConfig : JSON.stringify(corsConfig);
                const res = await awsFetch('PUT', `${bucketUrl(bucket)}/?cors`, region, 's3', accessKeyId, secretAccessKey, body, 'application/json');
                if (!res.ok) { const text = await res.text(); throw new Error(text); }
                return { output: { bucket, corsSet: true } };
            }

            case 'getBucketVersioning': {
                const bucket = String(inputs.bucket ?? '').trim();
                if (!bucket) throw new Error('bucket is required.');
                const res = await awsFetch('GET', `${bucketUrl(bucket)}/?versioning`, region, 's3', accessKeyId, secretAccessKey, '');
                const text = await res.text();
                if (!res.ok) throw new Error(text);
                return { output: { xml: text } };
            }

            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
