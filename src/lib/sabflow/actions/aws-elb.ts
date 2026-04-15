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

export async function executeAwsElbAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessKeyId = String(inputs.accessKeyId ?? '').trim();
        const secretAccessKey = String(inputs.secretAccessKey ?? '').trim();
        const region = String(inputs.region ?? 'us-east-1').trim();
        if (!accessKeyId || !secretAccessKey) throw new Error('accessKeyId and secretAccessKey are required.');

        const endpoint = `https://elasticloadbalancing.${region}.amazonaws.com/`;

        const call = async (action: string, extra: Record<string, string> = {}) => {
            const params: Record<string, string> = { Action: action, Version: '2015-12-01', ...extra };
            const res = await awsQueryFetch(endpoint, region, 'elasticloadbalancing', accessKeyId, secretAccessKey, params);
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
            case 'describeLoadBalancers': {
                logger.log('[ELB] Describing load balancers');
                const extra: Record<string, string> = {};
                if (inputs.names) {
                    const names = Array.isArray(inputs.names) ? inputs.names : [inputs.names];
                    names.forEach((n: string, i: number) => { extra[`Names.member.${i + 1}`] = n; });
                }
                const xml = await call('DescribeLoadBalancers', extra);
                const arns = extractAll(xml, 'LoadBalancerArn');
                const names = extractAll(xml, 'LoadBalancerName');
                const dnsNames = extractAll(xml, 'DNSName');
                const lbs = arns.map((arn, i) => ({ loadBalancerArn: arn, name: names[i] ?? '', dnsName: dnsNames[i] ?? '' }));
                return { output: { loadBalancers: lbs, count: String(lbs.length) } };
            }
            case 'createLoadBalancer': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const subnets = Array.isArray(inputs.subnets) ? inputs.subnets : (inputs.subnets ? [inputs.subnets] : []);
                if (subnets.length === 0) throw new Error('At least one subnet is required.');
                const extra: Record<string, string> = { Name: name };
                subnets.forEach((s: string, i: number) => { extra[`Subnets.member.${i + 1}`] = s; });
                if (inputs.scheme) extra['Scheme'] = String(inputs.scheme);
                if (inputs.type) extra['Type'] = String(inputs.type);
                logger.log(`[ELB] Creating load balancer ${name}`);
                const xml = await call('CreateLoadBalancer', extra);
                return { output: { loadBalancerArn: extractTag(xml, 'LoadBalancerArn'), name, dnsName: extractTag(xml, 'DNSName') } };
            }
            case 'deleteLoadBalancer': {
                const loadBalancerArn = String(inputs.loadBalancerArn ?? '').trim();
                if (!loadBalancerArn) throw new Error('loadBalancerArn is required.');
                logger.log(`[ELB] Deleting load balancer ${loadBalancerArn}`);
                await call('DeleteLoadBalancer', { LoadBalancerArn: loadBalancerArn });
                return { output: { deleted: 'true', loadBalancerArn } };
            }
            case 'describeTargetGroups': {
                logger.log('[ELB] Describing target groups');
                const extra: Record<string, string> = {};
                if (inputs.loadBalancerArn) extra['LoadBalancerArn'] = String(inputs.loadBalancerArn);
                const xml = await call('DescribeTargetGroups', extra);
                const arns = extractAll(xml, 'TargetGroupArn');
                const names = extractAll(xml, 'TargetGroupName');
                const groups = arns.map((arn, i) => ({ targetGroupArn: arn, name: names[i] ?? '' }));
                return { output: { targetGroups: groups, count: String(groups.length) } };
            }
            case 'createTargetGroup': {
                const name = String(inputs.name ?? '').trim();
                const protocol = String(inputs.protocol ?? 'HTTP').trim();
                const port = String(inputs.port ?? '80');
                const vpcId = String(inputs.vpcId ?? '').trim();
                if (!name || !vpcId) throw new Error('name and vpcId are required.');
                logger.log(`[ELB] Creating target group ${name}`);
                const xml = await call('CreateTargetGroup', { Name: name, Protocol: protocol, Port: port, VpcId: vpcId });
                return { output: { targetGroupArn: extractTag(xml, 'TargetGroupArn'), name, protocol, port } };
            }
            case 'deleteTargetGroup': {
                const targetGroupArn = String(inputs.targetGroupArn ?? '').trim();
                if (!targetGroupArn) throw new Error('targetGroupArn is required.');
                logger.log(`[ELB] Deleting target group ${targetGroupArn}`);
                await call('DeleteTargetGroup', { TargetGroupArn: targetGroupArn });
                return { output: { deleted: 'true', targetGroupArn } };
            }
            case 'registerTargets': {
                const targetGroupArn = String(inputs.targetGroupArn ?? '').trim();
                if (!targetGroupArn) throw new Error('targetGroupArn is required.');
                const targets = Array.isArray(inputs.targets) ? inputs.targets : (inputs.targets ? [inputs.targets] : []);
                if (targets.length === 0) throw new Error('At least one target is required.');
                const extra: Record<string, string> = { TargetGroupArn: targetGroupArn };
                targets.forEach((t: any, i: number) => {
                    extra[`Targets.member.${i + 1}.Id`] = String(t.id ?? t);
                    if (t.port) extra[`Targets.member.${i + 1}.Port`] = String(t.port);
                });
                logger.log(`[ELB] Registering ${targets.length} target(s) to ${targetGroupArn}`);
                await call('RegisterTargets', extra);
                return { output: { registered: 'true', targetGroupArn, count: String(targets.length) } };
            }
            case 'deregisterTargets': {
                const targetGroupArn = String(inputs.targetGroupArn ?? '').trim();
                if (!targetGroupArn) throw new Error('targetGroupArn is required.');
                const targets = Array.isArray(inputs.targets) ? inputs.targets : (inputs.targets ? [inputs.targets] : []);
                if (targets.length === 0) throw new Error('At least one target is required.');
                const extra: Record<string, string> = { TargetGroupArn: targetGroupArn };
                targets.forEach((t: any, i: number) => {
                    extra[`Targets.member.${i + 1}.Id`] = String(t.id ?? t);
                });
                logger.log(`[ELB] Deregistering ${targets.length} target(s) from ${targetGroupArn}`);
                await call('DeregisterTargets', extra);
                return { output: { deregistered: 'true', targetGroupArn, count: String(targets.length) } };
            }
            case 'describeListeners': {
                const loadBalancerArn = String(inputs.loadBalancerArn ?? '').trim();
                if (!loadBalancerArn) throw new Error('loadBalancerArn is required.');
                logger.log(`[ELB] Describing listeners for ${loadBalancerArn}`);
                const xml = await call('DescribeListeners', { LoadBalancerArn: loadBalancerArn });
                const arns = extractAll(xml, 'ListenerArn');
                const ports = extractAll(xml, 'Port');
                const protocols = extractAll(xml, 'Protocol');
                const listeners = arns.map((arn, i) => ({ listenerArn: arn, port: ports[i] ?? '', protocol: protocols[i] ?? '' }));
                return { output: { listeners, count: String(listeners.length) } };
            }
            case 'createListener': {
                const loadBalancerArn = String(inputs.loadBalancerArn ?? '').trim();
                const protocol = String(inputs.protocol ?? 'HTTP').trim();
                const port = String(inputs.port ?? '80');
                const targetGroupArn = String(inputs.targetGroupArn ?? '').trim();
                if (!loadBalancerArn || !targetGroupArn) throw new Error('loadBalancerArn and targetGroupArn are required.');
                logger.log(`[ELB] Creating listener on port ${port}`);
                const xml = await call('CreateListener', {
                    LoadBalancerArn: loadBalancerArn,
                    Protocol: protocol,
                    Port: port,
                    'DefaultActions.member.1.Type': 'forward',
                    'DefaultActions.member.1.TargetGroupArn': targetGroupArn,
                });
                return { output: { listenerArn: extractTag(xml, 'ListenerArn'), protocol, port } };
            }
            case 'deleteListener': {
                const listenerArn = String(inputs.listenerArn ?? '').trim();
                if (!listenerArn) throw new Error('listenerArn is required.');
                logger.log(`[ELB] Deleting listener ${listenerArn}`);
                await call('DeleteListener', { ListenerArn: listenerArn });
                return { output: { deleted: 'true', listenerArn } };
            }
            case 'describeRules': {
                const listenerArn = String(inputs.listenerArn ?? '').trim();
                if (!listenerArn) throw new Error('listenerArn is required.');
                logger.log(`[ELB] Describing rules for listener ${listenerArn}`);
                const xml = await call('DescribeRules', { ListenerArn: listenerArn });
                const arns = extractAll(xml, 'RuleArn');
                const priorities = extractAll(xml, 'Priority');
                const rules = arns.map((arn, i) => ({ ruleArn: arn, priority: priorities[i] ?? '' }));
                return { output: { rules, count: String(rules.length) } };
            }
            case 'createRule': {
                const listenerArn = String(inputs.listenerArn ?? '').trim();
                const priority = String(inputs.priority ?? '100');
                const targetGroupArn = String(inputs.targetGroupArn ?? '').trim();
                const conditionField = String(inputs.conditionField ?? 'path-pattern');
                const conditionValue = String(inputs.conditionValue ?? '/*');
                if (!listenerArn || !targetGroupArn) throw new Error('listenerArn and targetGroupArn are required.');
                logger.log(`[ELB] Creating rule on listener ${listenerArn}`);
                const xml = await call('CreateRule', {
                    ListenerArn: listenerArn,
                    Priority: priority,
                    'Conditions.member.1.Field': conditionField,
                    'Conditions.member.1.Values.member.1': conditionValue,
                    'Actions.member.1.Type': 'forward',
                    'Actions.member.1.TargetGroupArn': targetGroupArn,
                });
                return { output: { ruleArn: extractTag(xml, 'RuleArn'), priority, listenerArn } };
            }
            case 'deleteRule': {
                const ruleArn = String(inputs.ruleArn ?? '').trim();
                if (!ruleArn) throw new Error('ruleArn is required.');
                logger.log(`[ELB] Deleting rule ${ruleArn}`);
                await call('DeleteRule', { RuleArn: ruleArn });
                return { output: { deleted: 'true', ruleArn } };
            }
            case 'describeTargetHealth': {
                const targetGroupArn = String(inputs.targetGroupArn ?? '').trim();
                if (!targetGroupArn) throw new Error('targetGroupArn is required.');
                logger.log(`[ELB] Describing target health for ${targetGroupArn}`);
                const xml = await call('DescribeTargetHealth', { TargetGroupArn: targetGroupArn });
                const ids = extractAll(xml, 'Id');
                const states = extractAll(xml, 'State');
                const targets = ids.map((id, i) => ({ id, healthState: states[i] ?? '' }));
                return { output: { targets, count: String(targets.length), targetGroupArn } };
            }
            default:
                return { error: `Unknown ELB action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`[ELB] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
