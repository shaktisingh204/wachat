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

export async function executeAwsTextractAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessKeyId: string = inputs.accessKeyId || inputs.access_key_id;
        const secretAccessKey: string = inputs.secretAccessKey || inputs.secret_access_key;
        const region: string = inputs.region || 'us-east-1';
        const endpoint = `https://textract.${region}.amazonaws.com`;

        const targetMap: Record<string, string> = {
            detectDocumentText: 'Textract.DetectDocumentText',
            analyzeDocument: 'Textract.AnalyzeDocument',
            analyzeExpense: 'Textract.AnalyzeExpense',
            analyzeID: 'Textract.AnalyzeID',
            startDocumentTextDetection: 'Textract.StartDocumentTextDetection',
            getDocumentTextDetection: 'Textract.GetDocumentTextDetection',
            startDocumentAnalysis: 'Textract.StartDocumentAnalysis',
            getDocumentAnalysis: 'Textract.GetDocumentAnalysis',
            startExpenseAnalysis: 'Textract.StartExpenseAnalysis',
            getExpenseAnalysis: 'Textract.GetExpenseAnalysis',
        };

        const target = targetMap[actionName];
        if (!target) {
            return { error: `Unknown Textract action: ${actionName}` };
        }

        let body: Record<string, any> = {};

        switch (actionName) {
            case 'detectDocumentText': {
                body = { Document: inputs.document };
                break;
            }
            case 'analyzeDocument': {
                body = {
                    Document: inputs.document,
                    FeatureTypes: inputs.featureTypes || ['TABLES', 'FORMS'],
                };
                break;
            }
            case 'analyzeExpense': {
                body = { Document: inputs.document };
                break;
            }
            case 'analyzeID': {
                body = { DocumentPages: inputs.documentPages };
                break;
            }
            case 'startDocumentTextDetection': {
                body = {
                    DocumentLocation: inputs.documentLocation,
                    ClientRequestToken: inputs.clientRequestToken,
                    NotificationChannel: inputs.notificationChannel,
                    OutputConfig: inputs.outputConfig,
                };
                break;
            }
            case 'getDocumentTextDetection': {
                body = {
                    JobId: inputs.jobId,
                    MaxResults: inputs.maxResults || 1000,
                    NextToken: inputs.nextToken,
                };
                break;
            }
            case 'startDocumentAnalysis': {
                body = {
                    DocumentLocation: inputs.documentLocation,
                    FeatureTypes: inputs.featureTypes || ['TABLES', 'FORMS'],
                    ClientRequestToken: inputs.clientRequestToken,
                    NotificationChannel: inputs.notificationChannel,
                    OutputConfig: inputs.outputConfig,
                };
                break;
            }
            case 'getDocumentAnalysis': {
                body = {
                    JobId: inputs.jobId,
                    MaxResults: inputs.maxResults || 1000,
                    NextToken: inputs.nextToken,
                };
                break;
            }
            case 'startExpenseAnalysis': {
                body = {
                    DocumentLocation: inputs.documentLocation,
                    ClientRequestToken: inputs.clientRequestToken,
                    NotificationChannel: inputs.notificationChannel,
                    OutputConfig: inputs.outputConfig,
                };
                break;
            }
            case 'getExpenseAnalysis': {
                body = {
                    JobId: inputs.jobId,
                    MaxResults: inputs.maxResults || 1000,
                    NextToken: inputs.nextToken,
                };
                break;
            }
        }

        const bodyStr = JSON.stringify(body);
        logger.log(`Executing Textract action: ${actionName}`, { target });

        const res = await signedFetch('POST', endpoint, region, 'textract', accessKeyId, secretAccessKey, bodyStr, {
            'X-Amz-Target': target,
        });

        const data = await res.json();
        if (!res.ok) {
            return { error: data.message || data.Message || `Textract error: ${res.status}` };
        }
        return { output: data };
    } catch (err: any) {
        logger.log(`Textract error: ${err.message}`);
        return { error: err.message };
    }
}
