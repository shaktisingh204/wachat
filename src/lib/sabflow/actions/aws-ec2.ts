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

const EC2_VERSION = '2016-11-15';

export async function executeAWSEC2Action(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessKeyId = String(inputs.accessKeyId ?? '').trim();
        const secretAccessKey = String(inputs.secretAccessKey ?? '').trim();
        const region = String(inputs.region ?? 'us-east-1').trim();
        const baseUrl = `https://ec2.${region}.amazonaws.com/`;
        const contentType = 'application/x-www-form-urlencoded';

        const postEc2 = async (params: Record<string, string>) => {
            const allParams = { ...params, Version: EC2_VERSION };
            const body = new URLSearchParams(allParams).toString();
            const { amzDate, authorization } = signAwsRequest('POST', baseUrl, 'ec2', region, accessKeyId, secretAccessKey, body, contentType);
            const res = await fetch(baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': contentType,
                    'X-Amz-Date': amzDate,
                    'Authorization': authorization,
                },
                body,
            });
            const text = await res.text();
            if (!res.ok) throw new Error(text || `API error: ${res.status}`);
            return { raw: text };
        };

        const flattenFilters = (filters: Array<{ name: string; values: string[] }>, prefix = '') => {
            const result: Record<string, string> = {};
            filters.forEach((f, i) => {
                result[`${prefix}Filter.${i + 1}.Name`] = f.name;
                f.values.forEach((v, j) => {
                    result[`${prefix}Filter.${i + 1}.Value.${j + 1}`] = v;
                });
            });
            return result;
        };

        const flattenIds = (ids: string[], paramName: string) => {
            const result: Record<string, string> = {};
            (ids || []).forEach((id, i) => { result[`${paramName}.${i + 1}`] = id; });
            return result;
        };

        switch (actionName) {
            case 'describeInstances': {
                const params: Record<string, string> = { Action: 'DescribeInstances' };
                if (inputs.instanceIds) Object.assign(params, flattenIds(inputs.instanceIds, 'InstanceId'));
                if (inputs.filters) Object.assign(params, flattenFilters(inputs.filters));
                if (inputs.maxResults) params['MaxResults'] = String(inputs.maxResults);
                if (inputs.nextToken) params['NextToken'] = String(inputs.nextToken);
                const data = await postEc2(params);
                return { output: { result: data } };
            }
            case 'startInstances': {
                const params: Record<string, string> = { Action: 'StartInstances' };
                Object.assign(params, flattenIds(inputs.instanceIds, 'InstanceId'));
                const data = await postEc2(params);
                return { output: { result: data } };
            }
            case 'stopInstances': {
                const params: Record<string, string> = { Action: 'StopInstances' };
                Object.assign(params, flattenIds(inputs.instanceIds, 'InstanceId'));
                if (inputs.force !== undefined) params['Force'] = String(Boolean(inputs.force));
                if (inputs.hibernate !== undefined) params['Hibernate'] = String(Boolean(inputs.hibernate));
                const data = await postEc2(params);
                return { output: { result: data } };
            }
            case 'rebootInstances': {
                const params: Record<string, string> = { Action: 'RebootInstances' };
                Object.assign(params, flattenIds(inputs.instanceIds, 'InstanceId'));
                const data = await postEc2(params);
                return { output: { result: data } };
            }
            case 'terminateInstances': {
                const params: Record<string, string> = { Action: 'TerminateInstances' };
                Object.assign(params, flattenIds(inputs.instanceIds, 'InstanceId'));
                const data = await postEc2(params);
                return { output: { result: data } };
            }
            case 'describeInstanceStatus': {
                const params: Record<string, string> = { Action: 'DescribeInstanceStatus' };
                if (inputs.instanceIds) Object.assign(params, flattenIds(inputs.instanceIds, 'InstanceId'));
                if (inputs.includeAllInstances !== undefined) params['IncludeAllInstances'] = String(Boolean(inputs.includeAllInstances));
                if (inputs.filters) Object.assign(params, flattenFilters(inputs.filters));
                if (inputs.maxResults) params['MaxResults'] = String(inputs.maxResults);
                if (inputs.nextToken) params['NextToken'] = String(inputs.nextToken);
                const data = await postEc2(params);
                return { output: { result: data } };
            }
            case 'describeImages': {
                const params: Record<string, string> = { Action: 'DescribeImages' };
                if (inputs.imageIds) Object.assign(params, flattenIds(inputs.imageIds, 'ImageId'));
                if (inputs.owners) Object.assign(params, flattenIds(inputs.owners, 'Owner'));
                if (inputs.filters) Object.assign(params, flattenFilters(inputs.filters));
                if (inputs.executableUsers) Object.assign(params, flattenIds(inputs.executableUsers, 'ExecutableBy'));
                if (inputs.maxResults) params['MaxResults'] = String(inputs.maxResults);
                if (inputs.nextToken) params['NextToken'] = String(inputs.nextToken);
                const data = await postEc2(params);
                return { output: { result: data } };
            }
            case 'describeKeyPairs': {
                const params: Record<string, string> = { Action: 'DescribeKeyPairs' };
                if (inputs.keyNames) Object.assign(params, flattenIds(inputs.keyNames, 'KeyName'));
                if (inputs.keyPairIds) Object.assign(params, flattenIds(inputs.keyPairIds, 'KeyPairId'));
                if (inputs.filters) Object.assign(params, flattenFilters(inputs.filters));
                const data = await postEc2(params);
                return { output: { result: data } };
            }
            case 'describeSecurityGroups': {
                const params: Record<string, string> = { Action: 'DescribeSecurityGroups' };
                if (inputs.groupIds) Object.assign(params, flattenIds(inputs.groupIds, 'GroupId'));
                if (inputs.groupNames) Object.assign(params, flattenIds(inputs.groupNames, 'GroupName'));
                if (inputs.filters) Object.assign(params, flattenFilters(inputs.filters));
                if (inputs.maxResults) params['MaxResults'] = String(inputs.maxResults);
                if (inputs.nextToken) params['NextToken'] = String(inputs.nextToken);
                const data = await postEc2(params);
                return { output: { result: data } };
            }
            case 'describeVpcs': {
                const params: Record<string, string> = { Action: 'DescribeVpcs' };
                if (inputs.vpcIds) Object.assign(params, flattenIds(inputs.vpcIds, 'VpcId'));
                if (inputs.filters) Object.assign(params, flattenFilters(inputs.filters));
                if (inputs.maxResults) params['MaxResults'] = String(inputs.maxResults);
                if (inputs.nextToken) params['NextToken'] = String(inputs.nextToken);
                const data = await postEc2(params);
                return { output: { result: data } };
            }
            case 'describeSubnets': {
                const params: Record<string, string> = { Action: 'DescribeSubnets' };
                if (inputs.subnetIds) Object.assign(params, flattenIds(inputs.subnetIds, 'SubnetId'));
                if (inputs.filters) Object.assign(params, flattenFilters(inputs.filters));
                if (inputs.maxResults) params['MaxResults'] = String(inputs.maxResults);
                if (inputs.nextToken) params['NextToken'] = String(inputs.nextToken);
                const data = await postEc2(params);
                return { output: { result: data } };
            }
            case 'createInstance': {
                // RunInstances
                const params: Record<string, string> = {
                    Action: 'RunInstances',
                    ImageId: String(inputs.imageId),
                    InstanceType: String(inputs.instanceType ?? 't3.micro'),
                    MinCount: String(inputs.minCount ?? 1),
                    MaxCount: String(inputs.maxCount ?? 1),
                };
                if (inputs.keyName) params['KeyName'] = String(inputs.keyName);
                if (inputs.subnetId) params['SubnetId'] = String(inputs.subnetId);
                if (inputs.securityGroupIds) Object.assign(params, flattenIds(inputs.securityGroupIds, 'SecurityGroupId'));
                if (inputs.userData) params['UserData'] = Buffer.from(String(inputs.userData)).toString('base64');
                if (inputs.iamInstanceProfile) params['IamInstanceProfile.Name'] = String(inputs.iamInstanceProfile);
                if (inputs.tagSpecifications) params['TagSpecifications'] = JSON.stringify(inputs.tagSpecifications);
                const data = await postEc2(params);
                return { output: { result: data } };
            }
            case 'createSecurityGroup': {
                const params: Record<string, string> = {
                    Action: 'CreateSecurityGroup',
                    GroupName: String(inputs.groupName),
                    Description: String(inputs.description ?? ''),
                };
                if (inputs.vpcId) params['VpcId'] = String(inputs.vpcId);
                const data = await postEc2(params);
                return { output: { result: data } };
            }
            case 'authorizeSecurityGroupIngress': {
                const params: Record<string, string> = {
                    Action: 'AuthorizeSecurityGroupIngress',
                    GroupId: String(inputs.groupId),
                };
                if (inputs.ipPermissions) {
                    (inputs.ipPermissions as Array<any>).forEach((perm: any, i: number) => {
                        const idx = i + 1;
                        if (perm.ipProtocol) params[`IpPermissions.${idx}.IpProtocol`] = String(perm.ipProtocol);
                        if (perm.fromPort !== undefined) params[`IpPermissions.${idx}.FromPort`] = String(perm.fromPort);
                        if (perm.toPort !== undefined) params[`IpPermissions.${idx}.ToPort`] = String(perm.toPort);
                        if (perm.cidrIp) params[`IpPermissions.${idx}.IpRanges.1.CidrIp`] = String(perm.cidrIp);
                        if (perm.cidrIpv6) params[`IpPermissions.${idx}.Ipv6Ranges.1.CidrIpv6`] = String(perm.cidrIpv6);
                    });
                } else {
                    if (inputs.ipProtocol) params['IpPermissions.1.IpProtocol'] = String(inputs.ipProtocol);
                    if (inputs.fromPort !== undefined) params['IpPermissions.1.FromPort'] = String(inputs.fromPort);
                    if (inputs.toPort !== undefined) params['IpPermissions.1.ToPort'] = String(inputs.toPort);
                    if (inputs.cidrIp) params['IpPermissions.1.IpRanges.1.CidrIp'] = String(inputs.cidrIp);
                }
                const data = await postEc2(params);
                return { output: { result: data } };
            }
            case 'describeElasticIps': {
                const params: Record<string, string> = { Action: 'DescribeAddresses' };
                if (inputs.allocationIds) Object.assign(params, flattenIds(inputs.allocationIds, 'AllocationId'));
                if (inputs.publicIps) Object.assign(params, flattenIds(inputs.publicIps, 'PublicIp'));
                if (inputs.filters) Object.assign(params, flattenFilters(inputs.filters));
                const data = await postEc2(params);
                return { output: { result: data } };
            }
            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
