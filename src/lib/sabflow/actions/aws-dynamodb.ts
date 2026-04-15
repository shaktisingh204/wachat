'use server';
import { createHmac, createHash } from 'crypto';

function signAwsRequest(method: string, url: string, service: string, region: string, accessKeyId: string, secretAccessKey: string, body: string, contentType: string = 'application/x-amz-json-1.0') {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').substring(0, 15) + 'Z';
    const dateStamp = amzDate.substring(0, 8);
    const urlObj = new URL(url);
    const canonicalUri = urlObj.pathname || '/';
    const canonicalQueryString = Array.from(urlObj.searchParams.entries()).sort().map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    const payloadHash = createHash('sha256').update(body).digest('hex');
    const canonicalHeaders = `content-type:${contentType}\nhost:${urlObj.host}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'content-type;host;x-amz-date';
    const canonicalRequest = [method, canonicalUri, canonicalQueryString, canonicalHeaders, signedHeaders, payloadHash].join('\n');
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${createHash('sha256').update(canonicalRequest).digest('hex')}`;
    const signingKey = [dateStamp, region, service, 'aws4_request'].reduce((key: any, data) => createHmac('sha256', key).update(data).digest(), `AWS4${secretAccessKey}` as any);
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
    return { amzDate, authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}` };
}

export async function executeAWSDynamoDBAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessKeyId = String(inputs.accessKeyId ?? '').trim();
        const secretAccessKey = String(inputs.secretAccessKey ?? '').trim();
        const region = String(inputs.region ?? 'us-east-1').trim();
        const baseUrl = `https://dynamodb.${region}.amazonaws.com/`;

        const post = async (target: string, payload: object) => {
            const body = JSON.stringify(payload);
            const { amzDate, authorization } = signAwsRequest('POST', baseUrl, 'dynamodb', region, accessKeyId, secretAccessKey, body);
            const res = await fetch(baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-amz-json-1.0',
                    'X-Amz-Date': amzDate,
                    'Authorization': authorization,
                    'X-Amz-Target': `DynamoDB_20120810.${target}`,
                },
                body,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || data?.Message || `API error: ${res.status}`);
            return data;
        };

        switch (actionName) {
            case 'listTables': {
                const data = await post('ListTables', {
                    ...(inputs.exclusiveStartTableName ? { ExclusiveStartTableName: inputs.exclusiveStartTableName } : {}),
                    ...(inputs.limit ? { Limit: Number(inputs.limit) } : {}),
                });
                return { output: { result: data } };
            }
            case 'describeTable': {
                const data = await post('DescribeTable', { TableName: String(inputs.tableName) });
                return { output: { result: data } };
            }
            case 'createTable': {
                const data = await post('CreateTable', {
                    TableName: String(inputs.tableName),
                    AttributeDefinitions: inputs.attributeDefinitions,
                    KeySchema: inputs.keySchema,
                    BillingMode: inputs.billingMode ?? 'PAY_PER_REQUEST',
                    ...(inputs.provisionedThroughput ? { ProvisionedThroughput: inputs.provisionedThroughput } : {}),
                    ...(inputs.globalSecondaryIndexes ? { GlobalSecondaryIndexes: inputs.globalSecondaryIndexes } : {}),
                    ...(inputs.localSecondaryIndexes ? { LocalSecondaryIndexes: inputs.localSecondaryIndexes } : {}),
                });
                return { output: { result: data } };
            }
            case 'deleteTable': {
                const data = await post('DeleteTable', { TableName: String(inputs.tableName) });
                return { output: { result: data } };
            }
            case 'putItem': {
                const data = await post('PutItem', {
                    TableName: String(inputs.tableName),
                    Item: inputs.item,
                    ...(inputs.conditionExpression ? { ConditionExpression: inputs.conditionExpression } : {}),
                    ...(inputs.returnValues ? { ReturnValues: inputs.returnValues } : {}),
                });
                return { output: { result: data } };
            }
            case 'getItem': {
                const data = await post('GetItem', {
                    TableName: String(inputs.tableName),
                    Key: inputs.key,
                    ...(inputs.projectionExpression ? { ProjectionExpression: inputs.projectionExpression } : {}),
                    ...(inputs.consistentRead !== undefined ? { ConsistentRead: Boolean(inputs.consistentRead) } : {}),
                });
                return { output: { result: data } };
            }
            case 'updateItem': {
                const data = await post('UpdateItem', {
                    TableName: String(inputs.tableName),
                    Key: inputs.key,
                    UpdateExpression: String(inputs.updateExpression),
                    ...(inputs.conditionExpression ? { ConditionExpression: inputs.conditionExpression } : {}),
                    ...(inputs.expressionAttributeNames ? { ExpressionAttributeNames: inputs.expressionAttributeNames } : {}),
                    ...(inputs.expressionAttributeValues ? { ExpressionAttributeValues: inputs.expressionAttributeValues } : {}),
                    ...(inputs.returnValues ? { ReturnValues: inputs.returnValues } : {}),
                });
                return { output: { result: data } };
            }
            case 'deleteItem': {
                const data = await post('DeleteItem', {
                    TableName: String(inputs.tableName),
                    Key: inputs.key,
                    ...(inputs.conditionExpression ? { ConditionExpression: inputs.conditionExpression } : {}),
                    ...(inputs.returnValues ? { ReturnValues: inputs.returnValues } : {}),
                });
                return { output: { result: data } };
            }
            case 'query': {
                const data = await post('Query', {
                    TableName: String(inputs.tableName),
                    KeyConditionExpression: String(inputs.keyConditionExpression),
                    ...(inputs.filterExpression ? { FilterExpression: inputs.filterExpression } : {}),
                    ...(inputs.expressionAttributeNames ? { ExpressionAttributeNames: inputs.expressionAttributeNames } : {}),
                    ...(inputs.expressionAttributeValues ? { ExpressionAttributeValues: inputs.expressionAttributeValues } : {}),
                    ...(inputs.indexName ? { IndexName: inputs.indexName } : {}),
                    ...(inputs.limit ? { Limit: Number(inputs.limit) } : {}),
                    ...(inputs.scanIndexForward !== undefined ? { ScanIndexForward: Boolean(inputs.scanIndexForward) } : {}),
                    ...(inputs.exclusiveStartKey ? { ExclusiveStartKey: inputs.exclusiveStartKey } : {}),
                    ...(inputs.projectionExpression ? { ProjectionExpression: inputs.projectionExpression } : {}),
                });
                return { output: { result: data } };
            }
            case 'scan': {
                const data = await post('Scan', {
                    TableName: String(inputs.tableName),
                    ...(inputs.filterExpression ? { FilterExpression: inputs.filterExpression } : {}),
                    ...(inputs.expressionAttributeNames ? { ExpressionAttributeNames: inputs.expressionAttributeNames } : {}),
                    ...(inputs.expressionAttributeValues ? { ExpressionAttributeValues: inputs.expressionAttributeValues } : {}),
                    ...(inputs.limit ? { Limit: Number(inputs.limit) } : {}),
                    ...(inputs.exclusiveStartKey ? { ExclusiveStartKey: inputs.exclusiveStartKey } : {}),
                    ...(inputs.projectionExpression ? { ProjectionExpression: inputs.projectionExpression } : {}),
                    ...(inputs.indexName ? { IndexName: inputs.indexName } : {}),
                    ...(inputs.segment !== undefined ? { Segment: Number(inputs.segment) } : {}),
                    ...(inputs.totalSegments !== undefined ? { TotalSegments: Number(inputs.totalSegments) } : {}),
                });
                return { output: { result: data } };
            }
            case 'batchGetItem': {
                const data = await post('BatchGetItem', {
                    RequestItems: inputs.requestItems,
                    ...(inputs.returnConsumedCapacity ? { ReturnConsumedCapacity: inputs.returnConsumedCapacity } : {}),
                });
                return { output: { result: data } };
            }
            case 'batchWriteItem': {
                const data = await post('BatchWriteItem', {
                    RequestItems: inputs.requestItems,
                    ...(inputs.returnConsumedCapacity ? { ReturnConsumedCapacity: inputs.returnConsumedCapacity } : {}),
                    ...(inputs.returnItemCollectionMetrics ? { ReturnItemCollectionMetrics: inputs.returnItemCollectionMetrics } : {}),
                });
                return { output: { result: data } };
            }
            case 'transactGetItems': {
                const data = await post('TransactGetItems', {
                    TransactItems: inputs.transactItems,
                    ...(inputs.returnConsumedCapacity ? { ReturnConsumedCapacity: inputs.returnConsumedCapacity } : {}),
                });
                return { output: { result: data } };
            }
            case 'transactWriteItems': {
                const data = await post('TransactWriteItems', {
                    TransactItems: inputs.transactItems,
                    ...(inputs.clientRequestToken ? { ClientRequestToken: inputs.clientRequestToken } : {}),
                    ...(inputs.returnConsumedCapacity ? { ReturnConsumedCapacity: inputs.returnConsumedCapacity } : {}),
                    ...(inputs.returnItemCollectionMetrics ? { ReturnItemCollectionMetrics: inputs.returnItemCollectionMetrics } : {}),
                });
                return { output: { result: data } };
            }
            case 'describeTableReplicaAutoScaling': {
                const data = await post('DescribeTableReplicaAutoScaling', { TableName: String(inputs.tableName) });
                return { output: { result: data } };
            }
            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
