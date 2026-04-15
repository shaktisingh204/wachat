'use server';

import { createHmac, createHash } from 'crypto';

function sha256(d: string): string { return createHash('sha256').update(d).digest('hex'); }
function hmac(k: Buffer | string, d: string): Buffer { return createHmac('sha256', k).update(d).digest(); }
function signingKey(secret: string, date: string, region: string, svc: string): Buffer {
    return hmac(hmac(hmac(hmac('AWS4' + secret, date), region), svc), 'aws4_request');
}
function awsQueryFetch(url: string, region: string, svc: string, keyId: string, secret: string, params: Record<string, string>) {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
    const ds = amzDate.slice(0, 8);
    const u = new URL(url);
    const allHeaders: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Amz-Date': amzDate,
        'Host': u.host,
    };
    const body = new URLSearchParams(params).toString();
    const sh = Object.keys(allHeaders).map(k => k.toLowerCase()).sort().join(';');
    const ch = Object.entries(allHeaders).map(([k, v]) => `${k.toLowerCase()}:${v}\n`).sort().join('');
    const cr = ['POST', u.pathname, '', ch, sh, sha256(body)].join('\n');
    const scope = `${ds}/${region}/${svc}/aws4_request`;
    const sts = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256(cr)}`;
    const sig = hmac(signingKey(secret, ds, region, svc), sts).toString('hex');
    allHeaders['Authorization'] = `AWS4-HMAC-SHA256 Credential=${keyId}/${scope},SignedHeaders=${sh},Signature=${sig}`;
    return fetch(url, { method: 'POST', headers: allHeaders, body });
}

export async function executeAwsRdsAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessKeyId = String(inputs.accessKeyId ?? '').trim();
        const secretAccessKey = String(inputs.secretAccessKey ?? '').trim();
        const region = String(inputs.region ?? 'us-east-1').trim();
        if (!accessKeyId || !secretAccessKey) throw new Error('accessKeyId and secretAccessKey are required.');

        const endpoint = `https://rds.${region}.amazonaws.com/`;

        const call = async (action: string, extra: Record<string, string> = {}) => {
            const params: Record<string, string> = { Action: action, Version: '2014-10-31', ...extra };
            const res = await awsQueryFetch(endpoint, region, 'rds', accessKeyId, secretAccessKey, params);
            const text = await res.text();
            if (!res.ok) throw new Error(text.slice(0, 500));
            return text;
        };

        const extractTag = (xml: string, tag: string): string => {
            const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
            return m ? m[1].trim() : '';
        };
        const extractAll = (xml: string, tag: string): string[] => {
            const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'g');
            const out: string[] = [];
            let m;
            while ((m = re.exec(xml)) !== null) out.push(m[1].trim());
            return out;
        };

        switch (actionName) {
            case 'describeDBInstances': {
                logger.log('[RDS] Describing DB instances');
                const extra: Record<string, string> = {};
                if (inputs.dbInstanceIdentifier) extra['DBInstanceIdentifier'] = String(inputs.dbInstanceIdentifier);
                const xml = await call('DescribeDBInstances', extra);
                const ids = extractAll(xml, 'DBInstanceIdentifier');
                const classes = extractAll(xml, 'DBInstanceClass');
                const statuses = extractAll(xml, 'DBInstanceStatus');
                const instances = ids.map((id, i) => ({ dbInstanceIdentifier: id, dbInstanceClass: classes[i] ?? '', status: statuses[i] ?? '' }));
                return { output: { instances, count: String(instances.length) } };
            }
            case 'createDBInstance': {
                const dbInstanceIdentifier = String(inputs.dbInstanceIdentifier ?? '').trim();
                const dbInstanceClass = String(inputs.dbInstanceClass ?? 'db.t3.micro').trim();
                const engine = String(inputs.engine ?? 'mysql').trim();
                const masterUsername = String(inputs.masterUsername ?? '').trim();
                const masterUserPassword = String(inputs.masterUserPassword ?? '').trim();
                const allocatedStorage = String(inputs.allocatedStorage ?? '20');
                if (!dbInstanceIdentifier || !masterUsername || !masterUserPassword) throw new Error('dbInstanceIdentifier, masterUsername, and masterUserPassword are required.');
                logger.log(`[RDS] Creating DB instance ${dbInstanceIdentifier}`);
                const xml = await call('CreateDBInstance', {
                    DBInstanceIdentifier: dbInstanceIdentifier,
                    DBInstanceClass: dbInstanceClass,
                    Engine: engine,
                    MasterUsername: masterUsername,
                    MasterUserPassword: masterUserPassword,
                    AllocatedStorage: allocatedStorage,
                });
                return { output: { dbInstanceIdentifier, status: extractTag(xml, 'DBInstanceStatus'), engine } };
            }
            case 'deleteDBInstance': {
                const dbInstanceIdentifier = String(inputs.dbInstanceIdentifier ?? '').trim();
                if (!dbInstanceIdentifier) throw new Error('dbInstanceIdentifier is required.');
                const skipFinalSnapshot = inputs.skipFinalSnapshot !== false ? 'true' : 'false';
                logger.log(`[RDS] Deleting DB instance ${dbInstanceIdentifier}`);
                const xml = await call('DeleteDBInstance', {
                    DBInstanceIdentifier: dbInstanceIdentifier,
                    SkipFinalSnapshot: skipFinalSnapshot,
                });
                return { output: { dbInstanceIdentifier, status: extractTag(xml, 'DBInstanceStatus') } };
            }
            case 'startDBInstance': {
                const dbInstanceIdentifier = String(inputs.dbInstanceIdentifier ?? '').trim();
                if (!dbInstanceIdentifier) throw new Error('dbInstanceIdentifier is required.');
                logger.log(`[RDS] Starting DB instance ${dbInstanceIdentifier}`);
                const xml = await call('StartDBInstance', { DBInstanceIdentifier: dbInstanceIdentifier });
                return { output: { dbInstanceIdentifier, status: extractTag(xml, 'DBInstanceStatus') } };
            }
            case 'stopDBInstance': {
                const dbInstanceIdentifier = String(inputs.dbInstanceIdentifier ?? '').trim();
                if (!dbInstanceIdentifier) throw new Error('dbInstanceIdentifier is required.');
                logger.log(`[RDS] Stopping DB instance ${dbInstanceIdentifier}`);
                const xml = await call('StopDBInstance', { DBInstanceIdentifier: dbInstanceIdentifier });
                return { output: { dbInstanceIdentifier, status: extractTag(xml, 'DBInstanceStatus') } };
            }
            case 'rebootDBInstance': {
                const dbInstanceIdentifier = String(inputs.dbInstanceIdentifier ?? '').trim();
                if (!dbInstanceIdentifier) throw new Error('dbInstanceIdentifier is required.');
                logger.log(`[RDS] Rebooting DB instance ${dbInstanceIdentifier}`);
                const xml = await call('RebootDBInstance', { DBInstanceIdentifier: dbInstanceIdentifier });
                return { output: { dbInstanceIdentifier, status: extractTag(xml, 'DBInstanceStatus') } };
            }
            case 'describeDBClusters': {
                logger.log('[RDS] Describing DB clusters');
                const extra: Record<string, string> = {};
                if (inputs.dbClusterIdentifier) extra['DBClusterIdentifier'] = String(inputs.dbClusterIdentifier);
                const xml = await call('DescribeDBClusters', extra);
                const ids = extractAll(xml, 'DBClusterIdentifier');
                const statuses = extractAll(xml, 'Status');
                const clusters = ids.map((id, i) => ({ dbClusterIdentifier: id, status: statuses[i] ?? '' }));
                return { output: { clusters, count: String(clusters.length) } };
            }
            case 'createDBCluster': {
                const dbClusterIdentifier = String(inputs.dbClusterIdentifier ?? '').trim();
                const engine = String(inputs.engine ?? 'aurora-mysql').trim();
                const masterUsername = String(inputs.masterUsername ?? '').trim();
                const masterUserPassword = String(inputs.masterUserPassword ?? '').trim();
                if (!dbClusterIdentifier || !masterUsername || !masterUserPassword) throw new Error('dbClusterIdentifier, masterUsername, and masterUserPassword are required.');
                logger.log(`[RDS] Creating DB cluster ${dbClusterIdentifier}`);
                const xml = await call('CreateDBCluster', {
                    DBClusterIdentifier: dbClusterIdentifier,
                    Engine: engine,
                    MasterUsername: masterUsername,
                    MasterUserPassword: masterUserPassword,
                });
                return { output: { dbClusterIdentifier, status: extractTag(xml, 'Status'), engine } };
            }
            case 'deleteDBCluster': {
                const dbClusterIdentifier = String(inputs.dbClusterIdentifier ?? '').trim();
                if (!dbClusterIdentifier) throw new Error('dbClusterIdentifier is required.');
                const skipFinalSnapshot = inputs.skipFinalSnapshot !== false ? 'true' : 'false';
                logger.log(`[RDS] Deleting DB cluster ${dbClusterIdentifier}`);
                const xml = await call('DeleteDBCluster', {
                    DBClusterIdentifier: dbClusterIdentifier,
                    SkipFinalSnapshot: skipFinalSnapshot,
                });
                return { output: { dbClusterIdentifier, status: extractTag(xml, 'Status') } };
            }
            case 'describeDBSnapshots': {
                logger.log('[RDS] Describing DB snapshots');
                const extra: Record<string, string> = {};
                if (inputs.dbInstanceIdentifier) extra['DBInstanceIdentifier'] = String(inputs.dbInstanceIdentifier);
                if (inputs.dbSnapshotIdentifier) extra['DBSnapshotIdentifier'] = String(inputs.dbSnapshotIdentifier);
                const xml = await call('DescribeDBSnapshots', extra);
                const ids = extractAll(xml, 'DBSnapshotIdentifier');
                const statuses = extractAll(xml, 'Status');
                const snapshots = ids.map((id, i) => ({ dbSnapshotIdentifier: id, status: statuses[i] ?? '' }));
                return { output: { snapshots, count: String(snapshots.length) } };
            }
            case 'createDBSnapshot': {
                const dbInstanceIdentifier = String(inputs.dbInstanceIdentifier ?? '').trim();
                const dbSnapshotIdentifier = String(inputs.dbSnapshotIdentifier ?? '').trim();
                if (!dbInstanceIdentifier || !dbSnapshotIdentifier) throw new Error('dbInstanceIdentifier and dbSnapshotIdentifier are required.');
                logger.log(`[RDS] Creating snapshot ${dbSnapshotIdentifier}`);
                const xml = await call('CreateDBSnapshot', {
                    DBInstanceIdentifier: dbInstanceIdentifier,
                    DBSnapshotIdentifier: dbSnapshotIdentifier,
                });
                return { output: { dbSnapshotIdentifier, status: extractTag(xml, 'Status'), dbInstanceIdentifier } };
            }
            case 'restoreFromSnapshot': {
                const dbInstanceIdentifier = String(inputs.dbInstanceIdentifier ?? '').trim();
                const dbSnapshotIdentifier = String(inputs.dbSnapshotIdentifier ?? '').trim();
                const dbInstanceClass = String(inputs.dbInstanceClass ?? 'db.t3.micro').trim();
                if (!dbInstanceIdentifier || !dbSnapshotIdentifier) throw new Error('dbInstanceIdentifier and dbSnapshotIdentifier are required.');
                logger.log(`[RDS] Restoring ${dbInstanceIdentifier} from snapshot ${dbSnapshotIdentifier}`);
                const xml = await call('RestoreDBInstanceFromDBSnapshot', {
                    DBInstanceIdentifier: dbInstanceIdentifier,
                    DBSnapshotIdentifier: dbSnapshotIdentifier,
                    DBInstanceClass: dbInstanceClass,
                });
                return { output: { dbInstanceIdentifier, status: extractTag(xml, 'DBInstanceStatus'), dbSnapshotIdentifier } };
            }
            case 'describeDBSubnetGroups': {
                logger.log('[RDS] Describing DB subnet groups');
                const extra: Record<string, string> = {};
                if (inputs.dbSubnetGroupName) extra['DBSubnetGroupName'] = String(inputs.dbSubnetGroupName);
                const xml = await call('DescribeDBSubnetGroups', extra);
                const names = extractAll(xml, 'DBSubnetGroupName');
                const descriptions = extractAll(xml, 'DBSubnetGroupDescription');
                const groups = names.map((name, i) => ({ name, description: descriptions[i] ?? '' }));
                return { output: { subnetGroups: groups, count: String(groups.length) } };
            }
            case 'listTagsForResource': {
                const resourceName = String(inputs.resourceName ?? '').trim();
                if (!resourceName) throw new Error('resourceName (ARN) is required.');
                logger.log(`[RDS] Listing tags for ${resourceName}`);
                const xml = await call('ListTagsForResource', { ResourceName: resourceName });
                const keys = extractAll(xml, 'Key');
                const values = extractAll(xml, 'Value');
                const tags = keys.map((key, i) => ({ key, value: values[i] ?? '' }));
                return { output: { tags, count: String(tags.length) } };
            }
            case 'modifyDBInstance': {
                const dbInstanceIdentifier = String(inputs.dbInstanceIdentifier ?? '').trim();
                if (!dbInstanceIdentifier) throw new Error('dbInstanceIdentifier is required.');
                const extra: Record<string, string> = { DBInstanceIdentifier: dbInstanceIdentifier, ApplyImmediately: inputs.applyImmediately !== false ? 'true' : 'false' };
                if (inputs.dbInstanceClass) extra['DBInstanceClass'] = String(inputs.dbInstanceClass);
                if (inputs.allocatedStorage) extra['AllocatedStorage'] = String(inputs.allocatedStorage);
                if (inputs.masterUserPassword) extra['MasterUserPassword'] = String(inputs.masterUserPassword);
                logger.log(`[RDS] Modifying DB instance ${dbInstanceIdentifier}`);
                const xml = await call('ModifyDBInstance', extra);
                return { output: { dbInstanceIdentifier, status: extractTag(xml, 'DBInstanceStatus') } };
            }
            default:
                return { error: `Unknown RDS action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`[RDS] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
