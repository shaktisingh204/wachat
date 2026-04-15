'use server';

import { createHmac, createHash } from 'crypto';

function sha256(d: string): string { return createHash('sha256').update(d).digest('hex'); }
function hmac(k: Buffer | string, d: string): Buffer { return createHmac('sha256', k).update(d).digest(); }
function signingKey(secret: string, date: string, region: string, svc: string): Buffer {
    return hmac(hmac(hmac(hmac('AWS4' + secret, date), region), svc), 'aws4_request');
}
function awsFetch(method: string, url: string, region: string, svc: string, keyId: string, secret: string, body: string, extraHeaders: Record<string, string> = {}) {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
    const ds = amzDate.slice(0, 8);
    const u = new URL(url);
    const allHeaders: Record<string, string> = { 'Content-Type': 'application/x-amz-json-1.1', 'X-Amz-Date': amzDate, 'Host': u.host, ...extraHeaders };
    const sh = Object.keys(allHeaders).map(k => k.toLowerCase()).sort().join(';');
    const ch = Object.entries(allHeaders).map(([k, v]) => `${k.toLowerCase()}:${v}\n`).sort().join('');
    const cr = [method, u.pathname, u.search.slice(1), ch, sh, sha256(body)].join('\n');
    const scope = `${ds}/${region}/${svc}/aws4_request`;
    const sts = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256(cr)}`;
    const sig = hmac(signingKey(secret, ds, region, svc), sts).toString('hex');
    allHeaders['Authorization'] = `AWS4-HMAC-SHA256 Credential=${keyId}/${scope},SignedHeaders=${sh},Signature=${sig}`;
    return fetch(url, { method, headers: allHeaders, body: body || undefined });
}

// Route53 uses REST XML API. We use a minimal XML builder approach.
function xmlTag(tag: string, content: string): string { return `<${tag}>${content}</${tag}>`; }

export async function executeAwsRoute53Action(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessKeyId = String(inputs.accessKeyId ?? '').trim();
        const secretAccessKey = String(inputs.secretAccessKey ?? '').trim();
        // Route53 is global — region for signing is us-east-1
        const signingRegion = 'us-east-1';
        if (!accessKeyId || !secretAccessKey) throw new Error('accessKeyId and secretAccessKey are required.');

        const base = 'https://route53.amazonaws.com/2013-04-01';

        const callXml = async (method: string, path: string, xmlBody = '') => {
            const contentType = xmlBody ? 'application/xml' : 'application/x-amz-json-1.1';
            const res = await awsFetch(method, `${base}${path}`, signingRegion, 'route53', accessKeyId, secretAccessKey, xmlBody, {
                'Content-Type': contentType,
            });
            const text = await res.text();
            if (!res.ok) throw new Error(text.slice(0, 400));
            return text;
        };

        // Minimal XML -> object parser for common patterns
        const extractTag = (xml: string, tag: string): string => {
            const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
            return m ? m[1].trim() : '';
        };
        const extractAll = (xml: string, tag: string): string[] => {
            const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'g');
            const results: string[] = [];
            let m;
            while ((m = re.exec(xml)) !== null) results.push(m[1].trim());
            return results;
        };

        switch (actionName) {
            case 'listHostedZones': {
                logger.log('[Route53] Listing hosted zones');
                const xml = await callXml('GET', '/hostedzone');
                const ids = extractAll(xml, 'Id');
                const names = extractAll(xml, 'Name');
                const zones = ids.map((id, i) => ({ id, name: names[i] ?? '' }));
                return { output: { hostedZones: zones, count: String(zones.length) } };
            }
            case 'getHostedZone': {
                const id = String(inputs.hostedZoneId ?? '').trim().replace('/hostedzone/', '');
                if (!id) throw new Error('hostedZoneId is required.');
                logger.log(`[Route53] Getting hosted zone ${id}`);
                const xml = await callXml('GET', `/hostedzone/${id}`);
                return { output: { name: extractTag(xml, 'Name'), callerReference: extractTag(xml, 'CallerReference'), id } };
            }
            case 'createHostedZone': {
                const name = String(inputs.name ?? '').trim();
                const callerReference = String(inputs.callerReference ?? Date.now().toString()).trim();
                if (!name) throw new Error('name is required.');
                logger.log(`[Route53] Creating hosted zone ${name}`);
                const body = `<?xml version="1.0" encoding="UTF-8"?><CreateHostedZoneRequest xmlns="https://route53.amazonaws.com/doc/2013-04-01/">${xmlTag('Name', name)}${xmlTag('CallerReference', callerReference)}</CreateHostedZoneRequest>`;
                const xml = await callXml('POST', '/hostedzone', body);
                return { output: { id: extractTag(xml, 'Id'), name: extractTag(xml, 'Name'), callerReference } };
            }
            case 'deleteHostedZone': {
                const id = String(inputs.hostedZoneId ?? '').trim().replace('/hostedzone/', '');
                if (!id) throw new Error('hostedZoneId is required.');
                logger.log(`[Route53] Deleting hosted zone ${id}`);
                const xml = await callXml('DELETE', `/hostedzone/${id}`);
                return { output: { changeId: extractTag(xml, 'Id'), status: extractTag(xml, 'Status') } };
            }
            case 'listResourceRecordSets': {
                const id = String(inputs.hostedZoneId ?? '').trim().replace('/hostedzone/', '');
                if (!id) throw new Error('hostedZoneId is required.');
                logger.log(`[Route53] Listing resource record sets for ${id}`);
                const xml = await callXml('GET', `/hostedzone/${id}/rrset`);
                const names = extractAll(xml, 'Name');
                const types = extractAll(xml, 'Type');
                const records = names.map((n, i) => ({ name: n, type: types[i] ?? '' }));
                return { output: { resourceRecordSets: records, count: String(records.length) } };
            }
            case 'changeResourceRecordSets': {
                const id = String(inputs.hostedZoneId ?? '').trim().replace('/hostedzone/', '');
                const recordName = String(inputs.recordName ?? '').trim();
                const recordType = String(inputs.recordType ?? 'A').trim();
                const recordValue = String(inputs.recordValue ?? '').trim();
                const ttl = String(inputs.ttl ?? '300');
                const action = String(inputs.action ?? 'UPSERT').toUpperCase();
                if (!id || !recordName || !recordValue) throw new Error('hostedZoneId, recordName, and recordValue are required.');
                logger.log(`[Route53] Changing record set ${recordName}`);
                const body = `<?xml version="1.0" encoding="UTF-8"?><ChangeResourceRecordSetsRequest xmlns="https://route53.amazonaws.com/doc/2013-04-01/"><ChangeBatch><Changes><Change><Action>${action}</Action><ResourceRecordSet><Name>${recordName}</Name><Type>${recordType}</Type><TTL>${ttl}</TTL><ResourceRecords><ResourceRecord><Value>${recordValue}</Value></ResourceRecord></ResourceRecords></ResourceRecordSet></Change></Changes></ChangeBatch></ChangeResourceRecordSetsRequest>`;
                const xml = await callXml('POST', `/hostedzone/${id}/rrset`, body);
                return { output: { changeId: extractTag(xml, 'Id'), status: extractTag(xml, 'Status') } };
            }
            case 'getChange': {
                const changeId = String(inputs.changeId ?? '').trim().replace('/change/', '');
                if (!changeId) throw new Error('changeId is required.');
                logger.log(`[Route53] Getting change ${changeId}`);
                const xml = await callXml('GET', `/change/${changeId}`);
                return { output: { id: extractTag(xml, 'Id'), status: extractTag(xml, 'Status'), submittedAt: extractTag(xml, 'SubmittedAt') } };
            }
            case 'listHealthChecks': {
                logger.log('[Route53] Listing health checks');
                const xml = await callXml('GET', '/healthcheck');
                const ids = extractAll(xml, 'Id');
                return { output: { healthChecks: ids.map(id => ({ id })), count: String(ids.length) } };
            }
            case 'createHealthCheck': {
                const ipAddress = String(inputs.ipAddress ?? '').trim();
                const port = String(inputs.port ?? '80');
                const type = String(inputs.type ?? 'HTTP').toUpperCase();
                const resourcePath = String(inputs.resourcePath ?? '/').trim();
                const callerReference = String(inputs.callerReference ?? Date.now().toString()).trim();
                if (!ipAddress) throw new Error('ipAddress is required.');
                logger.log(`[Route53] Creating health check for ${ipAddress}`);
                const body = `<?xml version="1.0" encoding="UTF-8"?><CreateHealthCheckRequest xmlns="https://route53.amazonaws.com/doc/2013-04-01/">${xmlTag('CallerReference', callerReference)}<HealthCheckConfig>${xmlTag('IPAddress', ipAddress)}${xmlTag('Port', port)}${xmlTag('Type', type)}${xmlTag('ResourcePath', resourcePath)}</HealthCheckConfig></CreateHealthCheckRequest>`;
                const xml = await callXml('POST', '/healthcheck', body);
                return { output: { id: extractTag(xml, 'Id'), callerReference } };
            }
            case 'deleteHealthCheck': {
                const healthCheckId = String(inputs.healthCheckId ?? '').trim();
                if (!healthCheckId) throw new Error('healthCheckId is required.');
                logger.log(`[Route53] Deleting health check ${healthCheckId}`);
                await callXml('DELETE', `/healthcheck/${healthCheckId}`);
                return { output: { deleted: 'true', healthCheckId } };
            }
            case 'getHealthCheck': {
                const healthCheckId = String(inputs.healthCheckId ?? '').trim();
                if (!healthCheckId) throw new Error('healthCheckId is required.');
                logger.log(`[Route53] Getting health check ${healthCheckId}`);
                const xml = await callXml('GET', `/healthcheck/${healthCheckId}`);
                return { output: { id: extractTag(xml, 'Id'), status: extractTag(xml, 'Status') } };
            }
            case 'listTrafficPolicies': {
                logger.log('[Route53] Listing traffic policies');
                const xml = await callXml('GET', '/trafficpolicy');
                const ids = extractAll(xml, 'Id');
                const names = extractAll(xml, 'Name');
                const policies = ids.map((id, i) => ({ id, name: names[i] ?? '' }));
                return { output: { trafficPolicies: policies, count: String(policies.length) } };
            }
            case 'getAccountLimit': {
                const type = String(inputs.type ?? 'MAX_HEALTH_CHECKS_BY_OWNER').trim();
                logger.log(`[Route53] Getting account limit ${type}`);
                const xml = await callXml('GET', `/accountlimit/${type}`);
                return { output: { limitType: type, value: extractTag(xml, 'Value'), count: extractTag(xml, 'Count') } };
            }
            case 'getHostedZoneLimit': {
                const id = String(inputs.hostedZoneId ?? '').trim().replace('/hostedzone/', '');
                const type = String(inputs.type ?? 'MAX_RRSETS_BY_ZONE').trim();
                if (!id) throw new Error('hostedZoneId is required.');
                logger.log(`[Route53] Getting hosted zone limit ${type} for ${id}`);
                const xml = await callXml('GET', `/hostedzonelimit/${id}/${type}`);
                return { output: { limitType: type, value: extractTag(xml, 'Value'), count: extractTag(xml, 'Count') } };
            }
            case 'listTagsForResource': {
                const resourceType = String(inputs.resourceType ?? 'hostedzone').trim();
                const resourceId = String(inputs.resourceId ?? '').trim();
                if (!resourceId) throw new Error('resourceId is required.');
                logger.log(`[Route53] Listing tags for ${resourceType}/${resourceId}`);
                const xml = await callXml('GET', `/tags/${resourceType}/${resourceId}`);
                const keys = extractAll(xml, 'Key');
                const values = extractAll(xml, 'Value');
                const tags = keys.map((k, i) => ({ Key: k, Value: values[i] ?? '' }));
                return { output: { tags, count: String(tags.length) } };
            }
            default:
                return { error: `AWS Route53 action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'AWS Route53 action failed.' };
    }
}
