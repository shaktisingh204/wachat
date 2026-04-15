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

export async function executeAwsComprehendAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessKeyId: string = inputs.accessKeyId || inputs.access_key_id;
        const secretAccessKey: string = inputs.secretAccessKey || inputs.secret_access_key;
        const region: string = inputs.region || 'us-east-1';
        const endpoint = `https://comprehend.${region}.amazonaws.com`;

        const targetMap: Record<string, string> = {
            detectDominantLanguage: 'Comprehend_20171127.DetectDominantLanguage',
            detectEntities: 'Comprehend_20171127.DetectEntities',
            detectSentiment: 'Comprehend_20171127.DetectSentiment',
            detectKeyPhrases: 'Comprehend_20171127.DetectKeyPhrases',
            detectSyntax: 'Comprehend_20171127.DetectSyntax',
            detectPiiEntities: 'Comprehend_20171127.DetectPiiEntities',
            batchDetectSentiment: 'Comprehend_20171127.BatchDetectSentiment',
            batchDetectEntities: 'Comprehend_20171127.BatchDetectEntities',
            classifyDocument: 'Comprehend_20171127.ClassifyDocument',
            startSentimentDetectionJob: 'Comprehend_20171127.StartSentimentDetectionJob',
            listSentimentDetectionJobs: 'Comprehend_20171127.ListSentimentDetectionJobs',
            startEntitiesDetectionJob: 'Comprehend_20171127.StartEntitiesDetectionJob',
            listEntitiesDetectionJobs: 'Comprehend_20171127.ListEntitiesDetectionJobs',
        };

        const target = targetMap[actionName];
        if (!target) {
            return { error: `Unknown Comprehend action: ${actionName}` };
        }

        let body: Record<string, any> = {};

        switch (actionName) {
            case 'detectDominantLanguage': {
                body = { Text: inputs.text };
                break;
            }
            case 'detectEntities': {
                body = {
                    Text: inputs.text,
                    LanguageCode: inputs.languageCode || 'en',
                };
                break;
            }
            case 'detectSentiment': {
                body = {
                    Text: inputs.text,
                    LanguageCode: inputs.languageCode || 'en',
                };
                break;
            }
            case 'detectKeyPhrases': {
                body = {
                    Text: inputs.text,
                    LanguageCode: inputs.languageCode || 'en',
                };
                break;
            }
            case 'detectSyntax': {
                body = {
                    Text: inputs.text,
                    LanguageCode: inputs.languageCode || 'en',
                };
                break;
            }
            case 'detectPiiEntities': {
                body = {
                    Text: inputs.text,
                    LanguageCode: inputs.languageCode || 'en',
                };
                break;
            }
            case 'batchDetectSentiment': {
                body = {
                    TextList: inputs.textList,
                    LanguageCode: inputs.languageCode || 'en',
                };
                break;
            }
            case 'batchDetectEntities': {
                body = {
                    TextList: inputs.textList,
                    LanguageCode: inputs.languageCode || 'en',
                };
                break;
            }
            case 'classifyDocument': {
                body = {
                    Text: inputs.text,
                    EndpointArn: inputs.endpointArn,
                };
                break;
            }
            case 'startSentimentDetectionJob': {
                body = {
                    InputDataConfig: inputs.inputDataConfig,
                    OutputDataConfig: inputs.outputDataConfig,
                    DataAccessRoleArn: inputs.dataAccessRoleArn,
                    LanguageCode: inputs.languageCode || 'en',
                    JobName: inputs.jobName,
                    ClientRequestToken: inputs.clientRequestToken,
                };
                break;
            }
            case 'listSentimentDetectionJobs': {
                body = {
                    Filter: inputs.filter,
                    NextToken: inputs.nextToken,
                    MaxResults: inputs.maxResults || 100,
                };
                break;
            }
            case 'startEntitiesDetectionJob': {
                body = {
                    InputDataConfig: inputs.inputDataConfig,
                    OutputDataConfig: inputs.outputDataConfig,
                    DataAccessRoleArn: inputs.dataAccessRoleArn,
                    LanguageCode: inputs.languageCode || 'en',
                    JobName: inputs.jobName,
                    EntityRecognizerArn: inputs.entityRecognizerArn,
                    ClientRequestToken: inputs.clientRequestToken,
                };
                break;
            }
            case 'listEntitiesDetectionJobs': {
                body = {
                    Filter: inputs.filter,
                    NextToken: inputs.nextToken,
                    MaxResults: inputs.maxResults || 100,
                };
                break;
            }
        }

        const bodyStr = JSON.stringify(body);
        logger.log(`Executing Comprehend action: ${actionName}`, { target });

        const res = await signedFetch('POST', endpoint, region, 'comprehend', accessKeyId, secretAccessKey, bodyStr, {
            'X-Amz-Target': target,
        });

        const data = await res.json();
        if (!res.ok) {
            return { error: data.message || data.Message || `Comprehend error: ${res.status}` };
        }
        return { output: data };
    } catch (err: any) {
        logger.log(`Comprehend error: ${err.message}`);
        return { error: err.message };
    }
}
