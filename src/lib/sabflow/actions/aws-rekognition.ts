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

export async function executeAwsRekognitionAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessKeyId: string = inputs.accessKeyId || inputs.access_key_id;
        const secretAccessKey: string = inputs.secretAccessKey || inputs.secret_access_key;
        const region: string = inputs.region || 'us-east-1';
        const endpoint = `https://rekognition.${region}.amazonaws.com`;

        const targetMap: Record<string, string> = {
            detectLabels: 'RekognitionService.DetectLabels',
            detectText: 'RekognitionService.DetectText',
            detectFaces: 'RekognitionService.DetectFaces',
            detectModerationLabels: 'RekognitionService.DetectModerationLabels',
            compareFaces: 'RekognitionService.CompareFaces',
            recognizeCelebrities: 'RekognitionService.RecognizeCelebrities',
            detectCustomLabels: 'RekognitionService.DetectCustomLabels',
            indexFaces: 'RekognitionService.IndexFaces',
            searchFacesByImage: 'RekognitionService.SearchFacesByImage',
            searchFaces: 'RekognitionService.SearchFaces',
            listFaces: 'RekognitionService.ListFaces',
            createCollection: 'RekognitionService.CreateCollection',
            deleteCollection: 'RekognitionService.DeleteCollection',
            listCollections: 'RekognitionService.ListCollections',
        };

        const target = targetMap[actionName];
        if (!target) {
            return { error: `Unknown Rekognition action: ${actionName}` };
        }

        let body: Record<string, any> = {};

        switch (actionName) {
            case 'detectLabels': {
                body = {
                    Image: inputs.image,
                    MaxLabels: inputs.maxLabels || 10,
                    MinConfidence: inputs.minConfidence || 55,
                };
                break;
            }
            case 'detectText': {
                body = { Image: inputs.image };
                break;
            }
            case 'detectFaces': {
                body = {
                    Image: inputs.image,
                    Attributes: inputs.attributes || ['DEFAULT'],
                };
                break;
            }
            case 'detectModerationLabels': {
                body = {
                    Image: inputs.image,
                    MinConfidence: inputs.minConfidence || 50,
                };
                break;
            }
            case 'compareFaces': {
                body = {
                    SourceImage: inputs.sourceImage,
                    TargetImage: inputs.targetImage,
                    SimilarityThreshold: inputs.similarityThreshold || 80,
                };
                break;
            }
            case 'recognizeCelebrities': {
                body = { Image: inputs.image };
                break;
            }
            case 'detectCustomLabels': {
                body = {
                    Image: inputs.image,
                    ProjectVersionArn: inputs.projectVersionArn,
                    MinConfidence: inputs.minConfidence || 50,
                };
                break;
            }
            case 'indexFaces': {
                body = {
                    CollectionId: inputs.collectionId,
                    Image: inputs.image,
                    ExternalImageId: inputs.externalImageId,
                    MaxFaces: inputs.maxFaces || 1,
                    QualityFilter: inputs.qualityFilter || 'AUTO',
                    DetectionAttributes: inputs.detectionAttributes || ['DEFAULT'],
                };
                break;
            }
            case 'searchFacesByImage': {
                body = {
                    CollectionId: inputs.collectionId,
                    Image: inputs.image,
                    MaxFaces: inputs.maxFaces || 5,
                    FaceMatchThreshold: inputs.faceMatchThreshold || 80,
                };
                break;
            }
            case 'searchFaces': {
                body = {
                    CollectionId: inputs.collectionId,
                    FaceId: inputs.faceId,
                    MaxFaces: inputs.maxFaces || 5,
                    FaceMatchThreshold: inputs.faceMatchThreshold || 80,
                };
                break;
            }
            case 'listFaces': {
                body = {
                    CollectionId: inputs.collectionId,
                    MaxResults: inputs.maxResults || 100,
                    NextToken: inputs.nextToken,
                };
                break;
            }
            case 'createCollection': {
                body = { CollectionId: inputs.collectionId };
                break;
            }
            case 'deleteCollection': {
                body = { CollectionId: inputs.collectionId };
                break;
            }
            case 'listCollections': {
                body = {
                    MaxResults: inputs.maxResults || 100,
                    NextToken: inputs.nextToken,
                };
                break;
            }
        }

        const bodyStr = JSON.stringify(body);
        logger.log(`Executing Rekognition action: ${actionName}`, { target });

        const res = await signedFetch('POST', endpoint, region, 'rekognition', accessKeyId, secretAccessKey, bodyStr, {
            'X-Amz-Target': target,
        });

        const data = await res.json();
        if (!res.ok) {
            return { error: data.message || data.Message || `Rekognition error: ${res.status}` };
        }
        return { output: data };
    } catch (err: any) {
        logger.log(`Rekognition error: ${err.message}`);
        return { error: err.message };
    }
}
