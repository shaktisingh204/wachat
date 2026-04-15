
'use server';

import { createHmac, createHash } from 'crypto';

function sign(key: Buffer, msg: string): Buffer {
    return createHmac('sha256', key).update(msg).digest();
}

function getSignatureKey(secret: string, date: string, region: string, service: string): Buffer {
    return sign(sign(sign(sign(Buffer.from('AWS4' + secret), date), region), service), 'aws4_request');
}

function buildSigV4Headers(method: string, url: string, body: string, service: string, region: string, accessKeyId: string, secretAccessKey: string, sessionToken?: string, extraHeaders?: Record<string, string>): Record<string, string> {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
    const dateStamp = amzDate.slice(0, 8);
    const parsedUrl = new URL(url);
    const host = parsedUrl.host;
    const canonicalUri = parsedUrl.pathname;
    const canonicalQuerystring = parsedUrl.searchParams.toString();
    const payloadHash = createHash('sha256').update(body).digest('hex');
    const headersObj: Record<string, string> = { host, 'x-amz-date': amzDate, 'x-amz-content-sha256': payloadHash, ...(sessionToken ? { 'x-amz-security-token': sessionToken } : {}), ...extraHeaders };
    const signedHeaders = Object.keys(headersObj).sort().join(';');
    const canonicalHeaders = Object.keys(headersObj).sort().map(k => `${k}:${headersObj[k]}\n`).join('');
    const canonicalRequest = [method, canonicalUri, canonicalQuerystring, canonicalHeaders, signedHeaders, payloadHash].join('\n');
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, createHash('sha256').update(canonicalRequest).digest('hex')].join('\n');
    const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, service);
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
    return { ...headersObj, 'Authorization': `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`, 'Content-Type': 'application/x-amz-json-1.0' };
}

async function dynamoRequest(target: string, body: Record<string, any>, region: string, accessKeyId: string, secretAccessKey: string, sessionToken?: string): Promise<any> {
    const url = `https://dynamodb.${region}.amazonaws.com/`;
    const bodyStr = JSON.stringify(body);
    const headers = buildSigV4Headers('POST', url, bodyStr, 'dynamodb', region, accessKeyId, secretAccessKey, sessionToken, { 'x-amz-target': target });
    const res = await fetch(url, { method: 'POST', headers, body: bodyStr });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message ?? data.Message ?? JSON.stringify(data));
    return data;
}

export async function executeAwsDynamoDbAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const region = String(inputs.region ?? 'us-east-1').trim();
        const accessKeyId = String(inputs.accessKeyId ?? '').trim();
        const secretAccessKey = String(inputs.secretAccessKey ?? '').trim();
        const sessionToken = inputs.sessionToken ? String(inputs.sessionToken).trim() : undefined;

        if (!accessKeyId || !secretAccessKey) throw new Error('accessKeyId and secretAccessKey are required.');

        switch (actionName) {
            case 'getItem': {
                const tableName = String(inputs.tableName ?? '').trim();
                const key = inputs.key;
                if (!tableName || !key) throw new Error('tableName and key are required.');
                const data = await dynamoRequest('DynamoDB_20120810.GetItem', { TableName: tableName, Key: key, ...(inputs.projectionExpression ? { ProjectionExpression: inputs.projectionExpression } : {}) }, region, accessKeyId, secretAccessKey, sessionToken);
                logger.log(`[DynamoDB] GetItem from ${tableName}`);
                return { output: { item: data.Item ?? null, found: String(!!data.Item) } };
            }

            case 'putItem': {
                const tableName = String(inputs.tableName ?? '').trim();
                const item = inputs.item;
                if (!tableName || !item) throw new Error('tableName and item are required.');
                const params: Record<string, any> = { TableName: tableName, Item: item };
                if (inputs.conditionExpression) params.ConditionExpression = inputs.conditionExpression;
                if (inputs.expressionAttributeNames) params.ExpressionAttributeNames = inputs.expressionAttributeNames;
                if (inputs.expressionAttributeValues) params.ExpressionAttributeValues = inputs.expressionAttributeValues;
                await dynamoRequest('DynamoDB_20120810.PutItem', params, region, accessKeyId, secretAccessKey, sessionToken);
                return { output: { tableName, status: 'put' } };
            }

            case 'updateItem': {
                const tableName = String(inputs.tableName ?? '').trim();
                const key = inputs.key;
                const updateExpression = String(inputs.updateExpression ?? '').trim();
                if (!tableName || !key || !updateExpression) throw new Error('tableName, key, and updateExpression are required.');
                const params: Record<string, any> = { TableName: tableName, Key: key, UpdateExpression: updateExpression, ReturnValues: inputs.returnValues ?? 'UPDATED_NEW' };
                if (inputs.expressionAttributeNames) params.ExpressionAttributeNames = inputs.expressionAttributeNames;
                if (inputs.expressionAttributeValues) params.ExpressionAttributeValues = inputs.expressionAttributeValues;
                if (inputs.conditionExpression) params.ConditionExpression = inputs.conditionExpression;
                const data = await dynamoRequest('DynamoDB_20120810.UpdateItem', params, region, accessKeyId, secretAccessKey, sessionToken);
                return { output: { tableName, attributes: data.Attributes ?? {}, status: 'updated' } };
            }

            case 'deleteItem': {
                const tableName = String(inputs.tableName ?? '').trim();
                const key = inputs.key;
                if (!tableName || !key) throw new Error('tableName and key are required.');
                const params: Record<string, any> = { TableName: tableName, Key: key };
                if (inputs.conditionExpression) params.ConditionExpression = inputs.conditionExpression;
                if (inputs.returnValues) params.ReturnValues = inputs.returnValues;
                const data = await dynamoRequest('DynamoDB_20120810.DeleteItem', params, region, accessKeyId, secretAccessKey, sessionToken);
                return { output: { tableName, attributes: data.Attributes ?? {}, status: 'deleted' } };
            }

            case 'query': {
                const tableName = String(inputs.tableName ?? '').trim();
                const keyConditionExpression = String(inputs.keyConditionExpression ?? '').trim();
                if (!tableName || !keyConditionExpression) throw new Error('tableName and keyConditionExpression are required.');
                const params: Record<string, any> = { TableName: tableName, KeyConditionExpression: keyConditionExpression };
                if (inputs.expressionAttributeNames) params.ExpressionAttributeNames = inputs.expressionAttributeNames;
                if (inputs.expressionAttributeValues) params.ExpressionAttributeValues = inputs.expressionAttributeValues;
                if (inputs.filterExpression) params.FilterExpression = inputs.filterExpression;
                if (inputs.projectionExpression) params.ProjectionExpression = inputs.projectionExpression;
                if (inputs.indexName) params.IndexName = inputs.indexName;
                if (inputs.limit) params.Limit = Number(inputs.limit);
                if (inputs.scanIndexForward !== undefined) params.ScanIndexForward = Boolean(inputs.scanIndexForward);
                if (inputs.exclusiveStartKey) params.ExclusiveStartKey = inputs.exclusiveStartKey;
                const data = await dynamoRequest('DynamoDB_20120810.Query', params, region, accessKeyId, secretAccessKey, sessionToken);
                logger.log(`[DynamoDB] Query ${tableName} returned ${data.Count} items`);
                return { output: { items: data.Items ?? [], count: String(data.Count ?? 0), scannedCount: String(data.ScannedCount ?? 0), lastEvaluatedKey: data.LastEvaluatedKey ?? null } };
            }

            case 'scan': {
                const tableName = String(inputs.tableName ?? '').trim();
                if (!tableName) throw new Error('tableName is required.');
                const params: Record<string, any> = { TableName: tableName };
                if (inputs.filterExpression) params.FilterExpression = inputs.filterExpression;
                if (inputs.expressionAttributeNames) params.ExpressionAttributeNames = inputs.expressionAttributeNames;
                if (inputs.expressionAttributeValues) params.ExpressionAttributeValues = inputs.expressionAttributeValues;
                if (inputs.projectionExpression) params.ProjectionExpression = inputs.projectionExpression;
                if (inputs.indexName) params.IndexName = inputs.indexName;
                if (inputs.limit) params.Limit = Number(inputs.limit);
                if (inputs.exclusiveStartKey) params.ExclusiveStartKey = inputs.exclusiveStartKey;
                const data = await dynamoRequest('DynamoDB_20120810.Scan', params, region, accessKeyId, secretAccessKey, sessionToken);
                return { output: { items: data.Items ?? [], count: String(data.Count ?? 0), scannedCount: String(data.ScannedCount ?? 0), lastEvaluatedKey: data.LastEvaluatedKey ?? null } };
            }

            case 'batchGetItem': {
                const requestItems = inputs.requestItems;
                if (!requestItems) throw new Error('requestItems is required.');
                const data = await dynamoRequest('DynamoDB_20120810.BatchGetItem', { RequestItems: requestItems }, region, accessKeyId, secretAccessKey, sessionToken);
                return { output: { responses: data.Responses ?? {}, unprocessedKeys: data.UnprocessedKeys ?? {} } };
            }

            case 'batchWriteItem': {
                const requestItems = inputs.requestItems;
                if (!requestItems) throw new Error('requestItems is required.');
                const data = await dynamoRequest('DynamoDB_20120810.BatchWriteItem', { RequestItems: requestItems }, region, accessKeyId, secretAccessKey, sessionToken);
                return { output: { unprocessedItems: data.UnprocessedItems ?? {}, status: 'batch_written' } };
            }

            case 'createTable': {
                const tableName = String(inputs.tableName ?? '').trim();
                const attributeDefinitions = inputs.attributeDefinitions;
                const keySchema = inputs.keySchema;
                const billingMode = String(inputs.billingMode ?? 'PAY_PER_REQUEST');
                if (!tableName || !attributeDefinitions || !keySchema) throw new Error('tableName, attributeDefinitions, and keySchema are required.');
                const params: Record<string, any> = { TableName: tableName, AttributeDefinitions: attributeDefinitions, KeySchema: keySchema, BillingMode: billingMode };
                if (inputs.provisionedThroughput) params.ProvisionedThroughput = inputs.provisionedThroughput;
                if (inputs.globalSecondaryIndexes) params.GlobalSecondaryIndexes = inputs.globalSecondaryIndexes;
                if (inputs.localSecondaryIndexes) params.LocalSecondaryIndexes = inputs.localSecondaryIndexes;
                const data = await dynamoRequest('DynamoDB_20120810.CreateTable', params, region, accessKeyId, secretAccessKey, sessionToken);
                return { output: { tableDescription: data.TableDescription ?? {}, status: 'creating' } };
            }

            case 'deleteTable': {
                const tableName = String(inputs.tableName ?? '').trim();
                if (!tableName) throw new Error('tableName is required.');
                const data = await dynamoRequest('DynamoDB_20120810.DeleteTable', { TableName: tableName }, region, accessKeyId, secretAccessKey, sessionToken);
                return { output: { tableDescription: data.TableDescription ?? {}, status: 'deleting' } };
            }

            case 'describeTable': {
                const tableName = String(inputs.tableName ?? '').trim();
                if (!tableName) throw new Error('tableName is required.');
                const data = await dynamoRequest('DynamoDB_20120810.DescribeTable', { TableName: tableName }, region, accessKeyId, secretAccessKey, sessionToken);
                return { output: { table: data.Table ?? {} } };
            }

            case 'listTables': {
                const params: Record<string, any> = {};
                if (inputs.exclusiveStartTableName) params.ExclusiveStartTableName = inputs.exclusiveStartTableName;
                if (inputs.limit) params.Limit = Number(inputs.limit);
                const data = await dynamoRequest('DynamoDB_20120810.ListTables', params, region, accessKeyId, secretAccessKey, sessionToken);
                return { output: { tableNames: data.TableNames ?? [], lastEvaluatedTableName: data.LastEvaluatedTableName ?? null } };
            }

            case 'transactGetItems': {
                const transactItems = inputs.transactItems;
                if (!transactItems) throw new Error('transactItems is required.');
                const data = await dynamoRequest('DynamoDB_20120810.TransactGetItems', { TransactItems: transactItems }, region, accessKeyId, secretAccessKey, sessionToken);
                return { output: { responses: data.Responses ?? [] } };
            }

            case 'transactWriteItems': {
                const transactItems = inputs.transactItems;
                if (!transactItems) throw new Error('transactItems is required.');
                const params: Record<string, any> = { TransactItems: transactItems };
                if (inputs.clientRequestToken) params.ClientRequestToken = inputs.clientRequestToken;
                await dynamoRequest('DynamoDB_20120810.TransactWriteItems', params, region, accessKeyId, secretAccessKey, sessionToken);
                return { output: { status: 'transact_written' } };
            }

            default:
                throw new Error(`Unknown DynamoDB action: ${actionName}`);
        }
    } catch (err: any) {
        return { error: err.message ?? String(err) };
    }
}
