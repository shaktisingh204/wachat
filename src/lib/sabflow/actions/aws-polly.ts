'use server';

import { createHmac, createHash } from 'crypto';

function sha256(data: string | Buffer): string {
    return createHash('sha256').update(data).digest('hex');
}
function hmacSha256(key: Buffer | string, data: string): Buffer {
    return createHmac('sha256', key).update(data).digest();
}
function getSigningKey(secretKey: string, date: string, region: string, service: string): Buffer {
    const kDate    = hmacSha256('AWS4' + secretKey, date);
    const kRegion  = hmacSha256(kDate, region);
    const kService = hmacSha256(kRegion, service);
    return hmacSha256(kService, 'aws4_request');
}
function signedFetch(method: string, url: string, region: string, service: string, accessKeyId: string, secretAccessKey: string, body: string, extraHeaders: Record<string, string> = {}) {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
    const dateStamp = amzDate.slice(0, 8);
    const parsedUrl = new URL(url);
    const bodyHash = sha256(body);
    const headers: Record<string, string> = {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Date': amzDate,
        'Host': parsedUrl.host,
        ...extraHeaders,
    };
    const signedHeaders = Object.keys(headers).map(k => k.toLowerCase()).sort().join(';');
    const canonicalHeaders = Object.entries(headers).map(([k, v]) => `${k.toLowerCase()}:${v}\n`).sort().join('');
    const canonicalRequest = [method, parsedUrl.pathname, parsedUrl.search.slice(1), canonicalHeaders, signedHeaders, bodyHash].join('\n');
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${sha256(canonicalRequest)}`;
    const signature = hmacSha256(getSigningKey(secretAccessKey, dateStamp, region, service), stringToSign).toString('hex');
    headers['Authorization'] = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope},SignedHeaders=${signedHeaders},Signature=${signature}`;
    return fetch(url, { method, headers, body: body || undefined });
}

function signedFetchJson(method: string, url: string, region: string, service: string, accessKeyId: string, secretAccessKey: string, body: string) {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
    const dateStamp = amzDate.slice(0, 8);
    const parsedUrl = new URL(url);
    const bodyHash = sha256(body);
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Amz-Date': amzDate,
        'Host': parsedUrl.host,
    };
    const signedHeaders = Object.keys(headers).map(k => k.toLowerCase()).sort().join(';');
    const canonicalHeaders = Object.entries(headers).map(([k, v]) => `${k.toLowerCase()}:${v}\n`).sort().join('');
    const canonicalRequest = [method, parsedUrl.pathname, parsedUrl.search.slice(1), canonicalHeaders, signedHeaders, bodyHash].join('\n');
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${sha256(canonicalRequest)}`;
    const signature = hmacSha256(getSigningKey(secretAccessKey, dateStamp, region, service), stringToSign).toString('hex');
    headers['Authorization'] = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope},SignedHeaders=${signedHeaders},Signature=${signature}`;
    return fetch(url, { method, headers, body: body || undefined });
}

function signedFetchGet(url: string, region: string, service: string, accessKeyId: string, secretAccessKey: string) {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
    const dateStamp = amzDate.slice(0, 8);
    const parsedUrl = new URL(url);
    const bodyHash = sha256('');
    const headers: Record<string, string> = {
        'X-Amz-Date': amzDate,
        'Host': parsedUrl.host,
    };
    const signedHeaders = Object.keys(headers).map(k => k.toLowerCase()).sort().join(';');
    const canonicalHeaders = Object.entries(headers).map(([k, v]) => `${k.toLowerCase()}:${v}\n`).sort().join('');
    const searchStr = parsedUrl.search ? parsedUrl.search.slice(1) : '';
    const canonicalRequest = ['GET', parsedUrl.pathname, searchStr, canonicalHeaders, signedHeaders, bodyHash].join('\n');
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${sha256(canonicalRequest)}`;
    const signature = hmacSha256(getSigningKey(secretAccessKey, dateStamp, region, service), stringToSign).toString('hex');
    headers['Authorization'] = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope},SignedHeaders=${signedHeaders},Signature=${signature}`;
    return fetch(url, { method: 'GET', headers });
}

export async function executeAwsPollyAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessKeyId: string = inputs.accessKeyId || inputs.access_key_id;
        const secretAccessKey: string = inputs.secretAccessKey || inputs.secret_access_key;
        const region: string = inputs.region || 'us-east-1';
        const baseEndpoint = `https://polly.${region}.amazonaws.com`;

        logger.log(`Executing Polly action: ${actionName}`);

        switch (actionName) {
            case 'synthesizeSpeech': {
                const body = JSON.stringify({
                    Text: inputs.text,
                    VoiceId: inputs.voiceId || 'Joanna',
                    OutputFormat: inputs.outputFormat || 'mp3',
                    Engine: inputs.engine || 'standard',
                    LanguageCode: inputs.languageCode,
                    LexiconNames: inputs.lexiconNames,
                    SampleRate: inputs.sampleRate,
                    SpeechMarkTypes: inputs.speechMarkTypes,
                    TextType: inputs.textType || 'text',
                });
                const res = await signedFetchJson('POST', `${baseEndpoint}/v1/speech`, region, 'polly', accessKeyId, secretAccessKey, body);
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    return { error: errData.message || errData.Message || `Polly synthesizeSpeech error: ${res.status}` };
                }
                const contentType = res.headers.get('Content-Type') || 'audio/mpeg';
                const audioBuffer = await res.arrayBuffer();
                const base64Audio = Buffer.from(audioBuffer).toString('base64');
                return {
                    output: {
                        audioBase64: base64Audio,
                        contentType,
                        audioUrl: `data:${contentType};base64,${base64Audio}`,
                    },
                };
            }
            case 'describeVoices': {
                const params = new URLSearchParams();
                if (inputs.engine) params.set('Engine', inputs.engine);
                if (inputs.languageCode) params.set('LanguageCode', inputs.languageCode);
                if (inputs.includeAdditionalLanguageCodes) params.set('IncludeAdditionalLanguageCodes', 'true');
                if (inputs.nextToken) params.set('NextToken', inputs.nextToken);
                const qs = params.toString();
                const url = `${baseEndpoint}/v1/voices${qs ? '?' + qs : ''}`;
                const res = await signedFetchGet(url, region, 'polly', accessKeyId, secretAccessKey);
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.Message || `Polly error: ${res.status}` };
                return { output: data };
            }
            case 'listLexicons': {
                const res = await signedFetchGet(`${baseEndpoint}/v1/lexicons`, region, 'polly', accessKeyId, secretAccessKey);
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.Message || `Polly error: ${res.status}` };
                return { output: data };
            }
            case 'putLexicon': {
                const lexiconName = inputs.lexiconName;
                const body = JSON.stringify({ Content: inputs.content });
                const res = await signedFetchJson('PUT', `${baseEndpoint}/v1/lexicons/${encodeURIComponent(lexiconName)}`, region, 'polly', accessKeyId, secretAccessKey, body);
                const data = await res.json().catch(() => ({}));
                if (!res.ok) return { error: data.message || data.Message || `Polly error: ${res.status}` };
                return { output: data };
            }
            case 'getLexicon': {
                const lexiconName = inputs.lexiconName;
                const res = await signedFetchGet(`${baseEndpoint}/v1/lexicons/${encodeURIComponent(lexiconName)}`, region, 'polly', accessKeyId, secretAccessKey);
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.Message || `Polly error: ${res.status}` };
                return { output: data };
            }
            case 'deleteLexicon': {
                const lexiconName = inputs.lexiconName;
                const now = new Date();
                const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
                const dateStamp = amzDate.slice(0, 8);
                const url = `${baseEndpoint}/v1/lexicons/${encodeURIComponent(lexiconName)}`;
                const parsedUrl = new URL(url);
                const bodyHash = sha256('');
                const headers: Record<string, string> = {
                    'X-Amz-Date': amzDate,
                    'Host': parsedUrl.host,
                };
                const signedHeadersStr = Object.keys(headers).map(k => k.toLowerCase()).sort().join(';');
                const canonicalHeaders = Object.entries(headers).map(([k, v]) => `${k.toLowerCase()}:${v}\n`).sort().join('');
                const canonicalRequest = ['DELETE', parsedUrl.pathname, '', canonicalHeaders, signedHeadersStr, bodyHash].join('\n');
                const credentialScope = `${dateStamp}/${region}/polly/aws4_request`;
                const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${sha256(canonicalRequest)}`;
                const signature = hmacSha256(getSigningKey(secretAccessKey, dateStamp, region, 'polly'), stringToSign).toString('hex');
                headers['Authorization'] = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope},SignedHeaders=${signedHeadersStr},Signature=${signature}`;
                const res = await fetch(url, { method: 'DELETE', headers });
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    return { error: errData.message || errData.Message || `Polly deleteLexicon error: ${res.status}` };
                }
                return { output: { deleted: true, lexiconName } };
            }
            case 'startSpeechSynthesisTask': {
                const body = JSON.stringify({
                    Text: inputs.text,
                    VoiceId: inputs.voiceId || 'Joanna',
                    OutputFormat: inputs.outputFormat || 'mp3',
                    OutputS3BucketName: inputs.outputS3BucketName,
                    OutputS3KeyPrefix: inputs.outputS3KeyPrefix,
                    Engine: inputs.engine || 'standard',
                    LanguageCode: inputs.languageCode,
                    LexiconNames: inputs.lexiconNames,
                    SampleRate: inputs.sampleRate,
                    SnsTopicArn: inputs.snsTopicArn,
                    SpeechMarkTypes: inputs.speechMarkTypes,
                    TextType: inputs.textType || 'text',
                });
                const res = await signedFetchJson('POST', `${baseEndpoint}/v1/synthesisTasks`, region, 'polly', accessKeyId, secretAccessKey, body);
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.Message || `Polly error: ${res.status}` };
                return { output: data };
            }
            case 'getSpeechSynthesisTask': {
                const taskId = inputs.taskId;
                const res = await signedFetchGet(`${baseEndpoint}/v1/synthesisTasks/${encodeURIComponent(taskId)}`, region, 'polly', accessKeyId, secretAccessKey);
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.Message || `Polly error: ${res.status}` };
                return { output: data };
            }
            case 'listSpeechSynthesisTasks': {
                const params = new URLSearchParams();
                if (inputs.status) params.set('Status', inputs.status);
                if (inputs.maxResults) params.set('MaxResults', String(inputs.maxResults));
                if (inputs.nextToken) params.set('NextToken', inputs.nextToken);
                const qs = params.toString();
                const url = `${baseEndpoint}/v1/synthesisTasks${qs ? '?' + qs : ''}`;
                const res = await signedFetchGet(url, region, 'polly', accessKeyId, secretAccessKey);
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.Message || `Polly error: ${res.status}` };
                return { output: data };
            }
            default:
                return { error: `Unknown Polly action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Polly error: ${err.message}`);
        return { error: err.message };
    }
}
