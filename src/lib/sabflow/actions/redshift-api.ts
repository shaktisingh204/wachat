'use server';

import { createHmac, createHash } from 'crypto';

function hmacSha256(key: Buffer | string, data: string): Buffer {
    return createHmac('sha256', key).update(data).digest();
}

function sha256Hex(data: string): string {
    return createHash('sha256').update(data).digest('hex');
}

function toHex(buf: Buffer): string {
    return buf.toString('hex');
}

function getSignatureKey(secretKey: string, dateStamp: string, regionName: string, serviceName: string): Buffer {
    const kDate = hmacSha256(`AWS4${secretKey}`, dateStamp);
    const kRegion = hmacSha256(kDate, regionName);
    const kService = hmacSha256(kRegion, serviceName);
    const kSigning = hmacSha256(kService, 'aws4_request');
    return kSigning;
}

async function signedRedshiftRequest(
    method: string,
    host: string,
    path: string,
    body: string,
    accessKeyId: string,
    secretAccessKey: string,
    region: string,
    amzTarget: string,
): Promise<Response> {
    const service = 'redshift-data';
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
    const dateStamp = amzDate.slice(0, 8);

    const canonicalUri = path || '/';
    const canonicalQuerystring = '';
    const payloadHash = sha256Hex(body);

    const canonicalHeaders =
        `content-type:application/x-amz-json-1.1\n` +
        `host:${host}\n` +
        `x-amz-date:${amzDate}\n` +
        `x-amz-target:${amzTarget}\n`;
    const signedHeaders = 'content-type;host;x-amz-date;x-amz-target';

    const canonicalRequest = [
        method,
        canonicalUri,
        canonicalQuerystring,
        canonicalHeaders,
        signedHeaders,
        payloadHash,
    ].join('\n');

    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
        'AWS4-HMAC-SHA256',
        amzDate,
        credentialScope,
        sha256Hex(canonicalRequest),
    ].join('\n');

    const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, service);
    const signature = toHex(hmacSha256(signingKey, stringToSign));

    const authorizationHeader =
        `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const url = `https://${host}${canonicalUri}`;
    return fetch(url, {
        method,
        headers: {
            'Content-Type': 'application/x-amz-json-1.1',
            'X-Amz-Date': amzDate,
            'X-Amz-Target': amzTarget,
            'Authorization': authorizationHeader,
            'Host': host,
        },
        body,
    });
}

export async function executeRedshiftAPIAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessKeyId = String(inputs.accessKeyId ?? '').trim();
        const secretAccessKey = String(inputs.secretAccessKey ?? '').trim();
        const region = String(inputs.region ?? 'us-east-1').trim();
        const dataHost = `redshift-data.${region}.amazonaws.com`;
        const redshiftHost = `redshift.${region}.amazonaws.com`;

        switch (actionName) {
            case 'executeStatement': {
                const body = JSON.stringify({
                    ClusterIdentifier: inputs.clusterIdentifier,
                    Database: inputs.database,
                    DbUser: inputs.dbUser,
                    Sql: inputs.sql,
                    WithEvent: inputs.withEvent ?? false,
                    ...(inputs.secretArn ? { SecretArn: inputs.secretArn } : {}),
                });
                const res = await signedRedshiftRequest(
                    'POST', dataHost, '/', body,
                    accessKeyId, secretAccessKey, region,
                    'RedshiftData.ExecuteStatement',
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || data?.Message || `API error: ${res.status}`);
                return { output: { id: data.Id, clusterIdentifier: data.ClusterIdentifier, createdAt: data.CreatedAt } };
            }
            case 'batchExecuteStatement': {
                const body = JSON.stringify({
                    ClusterIdentifier: inputs.clusterIdentifier,
                    Database: inputs.database,
                    DbUser: inputs.dbUser,
                    Sqls: inputs.sqls,
                    ...(inputs.secretArn ? { SecretArn: inputs.secretArn } : {}),
                });
                const res = await signedRedshiftRequest(
                    'POST', dataHost, '/', body,
                    accessKeyId, secretAccessKey, region,
                    'RedshiftData.BatchExecuteStatement',
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || data?.Message || `API error: ${res.status}`);
                return { output: { id: data.Id, createdAt: data.CreatedAt } };
            }
            case 'getStatementResult': {
                const body = JSON.stringify({
                    Id: inputs.id,
                    ...(inputs.nextToken ? { NextToken: inputs.nextToken } : {}),
                });
                const res = await signedRedshiftRequest(
                    'POST', dataHost, '/', body,
                    accessKeyId, secretAccessKey, region,
                    'RedshiftData.GetStatementResult',
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || data?.Message || `API error: ${res.status}`);
                return { output: { records: data.Records ?? [], columnMetadata: data.ColumnMetadata ?? [], nextToken: data.NextToken, totalNumRows: data.TotalNumRows } };
            }
            case 'describeStatement': {
                const body = JSON.stringify({ Id: inputs.id });
                const res = await signedRedshiftRequest(
                    'POST', dataHost, '/', body,
                    accessKeyId, secretAccessKey, region,
                    'RedshiftData.DescribeStatement',
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || data?.Message || `API error: ${res.status}`);
                return { output: { statement: data } };
            }
            case 'listStatements': {
                const body = JSON.stringify({
                    ...(inputs.clusterIdentifier ? { ClusterIdentifier: inputs.clusterIdentifier } : {}),
                    ...(inputs.database ? { Database: inputs.database } : {}),
                    ...(inputs.maxResults ? { MaxResults: inputs.maxResults } : {}),
                    ...(inputs.nextToken ? { NextToken: inputs.nextToken } : {}),
                    ...(inputs.status ? { Status: inputs.status } : {}),
                });
                const res = await signedRedshiftRequest(
                    'POST', dataHost, '/', body,
                    accessKeyId, secretAccessKey, region,
                    'RedshiftData.ListStatements',
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || data?.Message || `API error: ${res.status}`);
                return { output: { statements: data.Statements ?? [], nextToken: data.NextToken } };
            }
            case 'cancelStatement': {
                const body = JSON.stringify({ Id: inputs.id });
                const res = await signedRedshiftRequest(
                    'POST', dataHost, '/', body,
                    accessKeyId, secretAccessKey, region,
                    'RedshiftData.CancelStatement',
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || data?.Message || `API error: ${res.status}`);
                return { output: { status: data.Status } };
            }
            case 'listDatabases': {
                const body = JSON.stringify({
                    ClusterIdentifier: inputs.clusterIdentifier,
                    Database: inputs.database,
                    DbUser: inputs.dbUser,
                    ...(inputs.maxResults ? { MaxResults: inputs.maxResults } : {}),
                    ...(inputs.nextToken ? { NextToken: inputs.nextToken } : {}),
                    ...(inputs.secretArn ? { SecretArn: inputs.secretArn } : {}),
                });
                const res = await signedRedshiftRequest(
                    'POST', dataHost, '/', body,
                    accessKeyId, secretAccessKey, region,
                    'RedshiftData.ListDatabases',
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || data?.Message || `API error: ${res.status}`);
                return { output: { databases: data.Databases ?? [], nextToken: data.NextToken } };
            }
            case 'listSchemas': {
                const body = JSON.stringify({
                    ClusterIdentifier: inputs.clusterIdentifier,
                    Database: inputs.database,
                    DbUser: inputs.dbUser,
                    ...(inputs.schemaPattern ? { SchemaPattern: inputs.schemaPattern } : {}),
                    ...(inputs.maxResults ? { MaxResults: inputs.maxResults } : {}),
                    ...(inputs.nextToken ? { NextToken: inputs.nextToken } : {}),
                    ...(inputs.secretArn ? { SecretArn: inputs.secretArn } : {}),
                });
                const res = await signedRedshiftRequest(
                    'POST', dataHost, '/', body,
                    accessKeyId, secretAccessKey, region,
                    'RedshiftData.ListSchemas',
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || data?.Message || `API error: ${res.status}`);
                return { output: { schemas: data.Schemas ?? [], nextToken: data.NextToken } };
            }
            case 'listTables': {
                const body = JSON.stringify({
                    ClusterIdentifier: inputs.clusterIdentifier,
                    Database: inputs.database,
                    DbUser: inputs.dbUser,
                    ...(inputs.schemaPattern ? { SchemaPattern: inputs.schemaPattern } : {}),
                    ...(inputs.tablePattern ? { TablePattern: inputs.tablePattern } : {}),
                    ...(inputs.maxResults ? { MaxResults: inputs.maxResults } : {}),
                    ...(inputs.nextToken ? { NextToken: inputs.nextToken } : {}),
                    ...(inputs.secretArn ? { SecretArn: inputs.secretArn } : {}),
                });
                const res = await signedRedshiftRequest(
                    'POST', dataHost, '/', body,
                    accessKeyId, secretAccessKey, region,
                    'RedshiftData.ListTables',
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || data?.Message || `API error: ${res.status}`);
                return { output: { tables: data.Tables ?? [], nextToken: data.NextToken } };
            }
            case 'describeTable': {
                const body = JSON.stringify({
                    ClusterIdentifier: inputs.clusterIdentifier,
                    Database: inputs.database,
                    DbUser: inputs.dbUser,
                    Schema: inputs.schema,
                    Table: inputs.table,
                    ...(inputs.secretArn ? { SecretArn: inputs.secretArn } : {}),
                });
                const res = await signedRedshiftRequest(
                    'POST', dataHost, '/', body,
                    accessKeyId, secretAccessKey, region,
                    'RedshiftData.DescribeTable',
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || data?.Message || `API error: ${res.status}`);
                return { output: { columnList: data.ColumnList ?? [], tableName: data.TableName } };
            }
            case 'createCluster': {
                const body = JSON.stringify({
                    ClusterIdentifier: inputs.clusterIdentifier,
                    NodeType: inputs.nodeType,
                    MasterUsername: inputs.masterUsername,
                    MasterUserPassword: inputs.masterUserPassword,
                    DBName: inputs.dbName ?? 'dev',
                    NumberOfNodes: inputs.numberOfNodes ?? 1,
                    ...(inputs.clusterType ? { ClusterType: inputs.clusterType } : {}),
                    ...(inputs.port ? { Port: inputs.port } : {}),
                });
                const res = await signedRedshiftRequest(
                    'POST', redshiftHost, '/', JSON.stringify({ Action: 'CreateCluster', Version: '2012-12-01', ...JSON.parse(body) }),
                    accessKeyId, secretAccessKey, region,
                    'AmazonRedshift.CreateCluster',
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || data?.Message || `API error: ${res.status}`);
                return { output: { cluster: data.CreateClusterResponse?.CreateClusterResult?.Cluster ?? data } };
            }
            case 'deleteCluster': {
                const body = JSON.stringify({
                    ClusterIdentifier: inputs.clusterIdentifier,
                    SkipFinalClusterSnapshot: inputs.skipFinalSnapshot ?? true,
                });
                const res = await signedRedshiftRequest(
                    'POST', redshiftHost, '/', body,
                    accessKeyId, secretAccessKey, region,
                    'AmazonRedshift.DeleteCluster',
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || data?.Message || `API error: ${res.status}`);
                return { output: { success: true, cluster: data } };
            }
            case 'listClusters': {
                const body = JSON.stringify({
                    ...(inputs.clusterIdentifier ? { ClusterIdentifier: inputs.clusterIdentifier } : {}),
                    ...(inputs.maxRecords ? { MaxRecords: inputs.maxRecords } : {}),
                    ...(inputs.marker ? { Marker: inputs.marker } : {}),
                });
                const res = await signedRedshiftRequest(
                    'POST', redshiftHost, '/', body,
                    accessKeyId, secretAccessKey, region,
                    'AmazonRedshift.DescribeClusters',
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || data?.Message || `API error: ${res.status}`);
                return { output: { clusters: data.Clusters ?? data, marker: data.Marker } };
            }
            case 'getCluster': {
                const body = JSON.stringify({ ClusterIdentifier: inputs.clusterIdentifier });
                const res = await signedRedshiftRequest(
                    'POST', redshiftHost, '/', body,
                    accessKeyId, secretAccessKey, region,
                    'AmazonRedshift.DescribeClusters',
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || data?.Message || `API error: ${res.status}`);
                const clusters = data.Clusters ?? [];
                return { output: { cluster: clusters[0] ?? null } };
            }
            case 'rebootCluster': {
                const body = JSON.stringify({ ClusterIdentifier: inputs.clusterIdentifier });
                const res = await signedRedshiftRequest(
                    'POST', redshiftHost, '/', body,
                    accessKeyId, secretAccessKey, region,
                    'AmazonRedshift.RebootCluster',
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || data?.Message || `API error: ${res.status}`);
                return { output: { success: true, cluster: data } };
            }
            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
