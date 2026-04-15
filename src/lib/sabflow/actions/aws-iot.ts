'use server';

import { createHmac, createHash } from 'crypto';

function signAWS(method: string, url: string, body: string, service: string, region: string, accessKey: string, secretKey: string): Record<string, string> {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
    const dateStamp = amzDate.slice(0, 8);
    const urlObj = new URL(url);
    const canonicalUri = urlObj.pathname;
    const canonicalQuerystring = urlObj.searchParams.toString();
    const payloadHash = createHash('sha256').update(body).digest('hex');
    const canonicalHeaders = `host:${urlObj.host}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'host;x-amz-date';
    const canonicalRequest = [method, canonicalUri, canonicalQuerystring, canonicalHeaders, signedHeaders, payloadHash].join('\n');
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${createHash('sha256').update(canonicalRequest).digest('hex')}`;
    const signingKey = (() => {
        const kDate = createHmac('sha256', `AWS4${secretKey}`).update(dateStamp).digest();
        const kRegion = createHmac('sha256', kDate).update(region).digest();
        const kService = createHmac('sha256', kRegion).update(service).digest();
        return createHmac('sha256', kService).update('aws4_request').digest();
    })();
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
    const authorization = `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    return { 'Authorization': authorization, 'x-amz-date': amzDate, 'x-amz-content-sha256': payloadHash };
}

export async function executeAWSIoTAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const region = inputs.region || 'us-east-1';
        const accessKeyId = inputs.accessKeyId;
        const secretAccessKey = inputs.secretAccessKey;
        const baseUrl = `https://iot.${region}.amazonaws.com`;
        const service = 'iot';

        async function awsFetch(method: string, path: string, body: any = null): Promise<any> {
            const url = `${baseUrl}${path}`;
            const bodyStr = body ? JSON.stringify(body) : '';
            const sigHeaders = signAWS(method, url, bodyStr, service, region, accessKeyId, secretAccessKey);
            const fetchHeaders: Record<string, string> = {
                ...sigHeaders,
                'Content-Type': 'application/json',
            };
            const res = await fetch(url, {
                method,
                headers: fetchHeaders,
                body: bodyStr || undefined,
            });
            if (res.status === 204) return { success: true };
            const data = await res.json();
            if (!res.ok) return { __error: data.message || data.errorMessage || `AWS IoT ${method} ${path} failed` };
            return data;
        }

        switch (actionName) {
            case 'listThings': {
                const params = new URLSearchParams();
                if (inputs.maxResults) params.set('maxResults', String(inputs.maxResults));
                if (inputs.nextToken) params.set('nextToken', inputs.nextToken);
                if (inputs.thingTypeName) params.set('thingTypeName', inputs.thingTypeName);
                const path = `/things${params.toString() ? '?' + params.toString() : ''}`;
                const data = await awsFetch('GET', path);
                if (data.__error) return { error: data.__error };
                return { output: data };
            }

            case 'getThing': {
                const thingName = inputs.thingName || inputs.name;
                const data = await awsFetch('GET', `/things/${encodeURIComponent(thingName)}`);
                if (data.__error) return { error: data.__error };
                return { output: data };
            }

            case 'createThing': {
                const body: any = {};
                if (inputs.thingTypeName) body.thingTypeName = inputs.thingTypeName;
                if (inputs.attributePayload) body.attributePayload = inputs.attributePayload;
                if (inputs.billingGroupName) body.billingGroupName = inputs.billingGroupName;
                const thingName = inputs.thingName || inputs.name;
                const data = await awsFetch('POST', `/things/${encodeURIComponent(thingName)}`, body);
                if (data.__error) return { error: data.__error };
                return { output: data };
            }

            case 'updateThing': {
                const thingName = inputs.thingName || inputs.name;
                const body: any = {};
                if (inputs.thingTypeName) body.thingTypeName = inputs.thingTypeName;
                if (inputs.attributePayload) body.attributePayload = inputs.attributePayload;
                if (inputs.expectedVersion !== undefined) body.expectedVersion = inputs.expectedVersion;
                const data = await awsFetch('PATCH', `/things/${encodeURIComponent(thingName)}`, body);
                if (data.__error) return { error: data.__error };
                return { output: { updated: true, thingName } };
            }

            case 'deleteThing': {
                const thingName = inputs.thingName || inputs.name;
                const params = new URLSearchParams();
                if (inputs.expectedVersion !== undefined) params.set('expectedVersion', String(inputs.expectedVersion));
                const path = `/things/${encodeURIComponent(thingName)}${params.toString() ? '?' + params.toString() : ''}`;
                const data = await awsFetch('DELETE', path);
                if (data.__error) return { error: data.__error };
                return { output: { deleted: true, thingName } };
            }

            case 'listThingGroups': {
                const params = new URLSearchParams();
                if (inputs.maxResults) params.set('maxResults', String(inputs.maxResults));
                if (inputs.nextToken) params.set('nextToken', inputs.nextToken);
                if (inputs.namePrefixFilter) params.set('namePrefixFilter', inputs.namePrefixFilter);
                const path = `/thing-groups${params.toString() ? '?' + params.toString() : ''}`;
                const data = await awsFetch('GET', path);
                if (data.__error) return { error: data.__error };
                return { output: data };
            }

            case 'getThingGroup': {
                const thingGroupName = inputs.thingGroupName || inputs.name;
                const data = await awsFetch('GET', `/thing-groups/${encodeURIComponent(thingGroupName)}`);
                if (data.__error) return { error: data.__error };
                return { output: data };
            }

            case 'createThingGroup': {
                const thingGroupName = inputs.thingGroupName || inputs.name;
                const body: any = {};
                if (inputs.parentGroupName) body.parentGroupName = inputs.parentGroupName;
                if (inputs.thingGroupProperties) body.thingGroupProperties = inputs.thingGroupProperties;
                if (inputs.tags) body.tags = inputs.tags;
                const data = await awsFetch('POST', `/thing-groups/${encodeURIComponent(thingGroupName)}`, body);
                if (data.__error) return { error: data.__error };
                return { output: data };
            }

            case 'listPolicies': {
                const params = new URLSearchParams();
                if (inputs.marker) params.set('marker', inputs.marker);
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                if (inputs.ascendingOrder !== undefined) params.set('isAscendingOrder', String(inputs.ascendingOrder));
                const path = `/policies${params.toString() ? '?' + params.toString() : ''}`;
                const data = await awsFetch('GET', path);
                if (data.__error) return { error: data.__error };
                return { output: data };
            }

            case 'getPolicy': {
                const policyName = inputs.policyName || inputs.name;
                const data = await awsFetch('GET', `/policies/${encodeURIComponent(policyName)}`);
                if (data.__error) return { error: data.__error };
                return { output: data };
            }

            case 'createPolicy': {
                const policyName = inputs.policyName || inputs.name;
                const body: any = {
                    policyDocument: inputs.policyDocument || JSON.stringify({ Version: '2012-10-17', Statement: [] }),
                };
                if (inputs.tags) body.tags = inputs.tags;
                const data = await awsFetch('POST', `/policies/${encodeURIComponent(policyName)}`, body);
                if (data.__error) return { error: data.__error };
                return { output: data };
            }

            case 'listCertificates': {
                const params = new URLSearchParams();
                if (inputs.marker) params.set('marker', inputs.marker);
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                if (inputs.ascendingOrder !== undefined) params.set('isAscendingOrder', String(inputs.ascendingOrder));
                const path = `/certificates${params.toString() ? '?' + params.toString() : ''}`;
                const data = await awsFetch('GET', path);
                if (data.__error) return { error: data.__error };
                return { output: data };
            }

            case 'describeCertificate': {
                const certificateId = inputs.certificateId || inputs.id;
                const data = await awsFetch('GET', `/certificates/${encodeURIComponent(certificateId)}`);
                if (data.__error) return { error: data.__error };
                return { output: data };
            }

            case 'listTopicRules': {
                const params = new URLSearchParams();
                if (inputs.maxResults) params.set('maxResults', String(inputs.maxResults));
                if (inputs.nextToken) params.set('nextToken', inputs.nextToken);
                if (inputs.topic) params.set('topic', inputs.topic);
                if (inputs.ruleDisabled !== undefined) params.set('ruleDisabled', String(inputs.ruleDisabled));
                const path = `/rules${params.toString() ? '?' + params.toString() : ''}`;
                const data = await awsFetch('GET', path);
                if (data.__error) return { error: data.__error };
                return { output: data };
            }

            case 'createTopicRule': {
                const ruleName = inputs.ruleName || inputs.name;
                const body: any = {
                    sql: inputs.sql || '',
                    actions: inputs.actions || [],
                };
                if (inputs.description) body.description = inputs.description;
                if (inputs.awsIotSqlVersion) body.awsIotSqlVersion = inputs.awsIotSqlVersion;
                if (inputs.ruleDisabled !== undefined) body.ruleDisabled = inputs.ruleDisabled;
                if (inputs.errorAction) body.errorAction = inputs.errorAction;
                const data = await awsFetch('POST', `/rules/${encodeURIComponent(ruleName)}`, { topicRulePayload: body });
                if (data.__error) return { error: data.__error };
                return { output: { created: true, ruleName } };
            }

            default:
                return { error: `Unknown AWS IoT action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`executeAWSIoTAction error: ${err.message}`);
        return { error: err.message || 'Unknown error in executeAWSIoTAction' };
    }
}
