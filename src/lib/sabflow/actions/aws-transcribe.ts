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

export async function executeAwsTranscribeAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessKeyId: string = inputs.accessKeyId || inputs.access_key_id;
        const secretAccessKey: string = inputs.secretAccessKey || inputs.secret_access_key;
        const region: string = inputs.region || 'us-east-1';
        const endpoint = `https://transcribe.${region}.amazonaws.com`;

        const targetMap: Record<string, string> = {
            startTranscriptionJob: 'Transcribe.StartTranscriptionJob',
            getTranscriptionJob: 'Transcribe.GetTranscriptionJob',
            listTranscriptionJobs: 'Transcribe.ListTranscriptionJobs',
            deleteTranscriptionJob: 'Transcribe.DeleteTranscriptionJob',
            startMedicalTranscriptionJob: 'Transcribe.StartMedicalTranscriptionJob',
            getMedicalTranscriptionJob: 'Transcribe.GetMedicalTranscriptionJob',
            createVocabulary: 'Transcribe.CreateVocabulary',
            getVocabulary: 'Transcribe.GetVocabulary',
            listVocabularies: 'Transcribe.ListVocabularies',
            deleteVocabulary: 'Transcribe.DeleteVocabulary',
            startCallAnalyticsJob: 'Transcribe.StartCallAnalyticsJob',
            getCallAnalyticsJob: 'Transcribe.GetCallAnalyticsJob',
            listCallAnalyticsJobs: 'Transcribe.ListCallAnalyticsJobs',
        };

        const target = targetMap[actionName];
        if (!target) {
            return { error: `Unknown Transcribe action: ${actionName}` };
        }

        let body: Record<string, any> = {};

        switch (actionName) {
            case 'startTranscriptionJob': {
                body = {
                    TranscriptionJobName: inputs.transcriptionJobName,
                    LanguageCode: inputs.languageCode || 'en-US',
                    MediaFormat: inputs.mediaFormat || 'mp3',
                    Media: inputs.media,
                    OutputBucketName: inputs.outputBucketName,
                    OutputKey: inputs.outputKey,
                    Settings: inputs.settings,
                };
                break;
            }
            case 'getTranscriptionJob': {
                body = { TranscriptionJobName: inputs.transcriptionJobName };
                break;
            }
            case 'listTranscriptionJobs': {
                body = {
                    Status: inputs.status,
                    JobNameContains: inputs.jobNameContains,
                    NextToken: inputs.nextToken,
                    MaxResults: inputs.maxResults || 100,
                };
                break;
            }
            case 'deleteTranscriptionJob': {
                body = { TranscriptionJobName: inputs.transcriptionJobName };
                break;
            }
            case 'startMedicalTranscriptionJob': {
                body = {
                    MedicalTranscriptionJobName: inputs.medicalTranscriptionJobName,
                    LanguageCode: inputs.languageCode || 'en-US',
                    MediaFormat: inputs.mediaFormat || 'mp3',
                    Media: inputs.media,
                    OutputBucketName: inputs.outputBucketName,
                    OutputKey: inputs.outputKey,
                    Specialty: inputs.specialty || 'PRIMARYCARE',
                    Type: inputs.type || 'CONVERSATION',
                };
                break;
            }
            case 'getMedicalTranscriptionJob': {
                body = { MedicalTranscriptionJobName: inputs.medicalTranscriptionJobName };
                break;
            }
            case 'createVocabulary': {
                body = {
                    VocabularyName: inputs.vocabularyName,
                    LanguageCode: inputs.languageCode || 'en-US',
                    Phrases: inputs.phrases,
                    VocabularyFileUri: inputs.vocabularyFileUri,
                };
                break;
            }
            case 'getVocabulary': {
                body = { VocabularyName: inputs.vocabularyName };
                break;
            }
            case 'listVocabularies': {
                body = {
                    StateEquals: inputs.stateEquals,
                    NameContains: inputs.nameContains,
                    NextToken: inputs.nextToken,
                    MaxResults: inputs.maxResults || 100,
                };
                break;
            }
            case 'deleteVocabulary': {
                body = { VocabularyName: inputs.vocabularyName };
                break;
            }
            case 'startCallAnalyticsJob': {
                body = {
                    CallAnalyticsJobName: inputs.callAnalyticsJobName,
                    Media: inputs.media,
                    OutputLocation: inputs.outputLocation,
                    DataAccessRoleArn: inputs.dataAccessRoleArn,
                    ChannelDefinitions: inputs.channelDefinitions,
                    Settings: inputs.settings,
                };
                break;
            }
            case 'getCallAnalyticsJob': {
                body = { CallAnalyticsJobName: inputs.callAnalyticsJobName };
                break;
            }
            case 'listCallAnalyticsJobs': {
                body = {
                    Status: inputs.status,
                    JobNameContains: inputs.jobNameContains,
                    NextToken: inputs.nextToken,
                    MaxResults: inputs.maxResults || 100,
                };
                break;
            }
        }

        const bodyStr = JSON.stringify(body);
        logger.log(`Executing Transcribe action: ${actionName}`, { target });

        const res = await signedFetch('POST', endpoint, region, 'transcribe', accessKeyId, secretAccessKey, bodyStr, {
            'X-Amz-Target': target,
        });

        const data = await res.json();
        if (!res.ok) {
            return { error: data.message || data.Message || `Transcribe error: ${res.status}` };
        }
        return { output: data };
    } catch (err: any) {
        logger.log(`Transcribe error: ${err.message}`);
        return { error: err.message };
    }
}
