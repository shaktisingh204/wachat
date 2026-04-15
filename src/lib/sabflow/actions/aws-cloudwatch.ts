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

export async function executeAwsCloudWatchAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessKeyId = String(inputs.accessKeyId ?? '').trim();
        const secretAccessKey = String(inputs.secretAccessKey ?? '').trim();
        const region = String(inputs.region ?? 'us-east-1').trim();
        if (!accessKeyId || !secretAccessKey) throw new Error('accessKeyId and secretAccessKey are required.');

        const endpoint = `https://monitoring.${region}.amazonaws.com/`;

        const call = async (action: string, extra: Record<string, string> = {}) => {
            const params: Record<string, string> = { Action: action, Version: '2010-08-01', ...extra };
            const res = await awsQueryFetch(endpoint, region, 'monitoring', accessKeyId, secretAccessKey, params);
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
            case 'listMetrics': {
                logger.log('[CloudWatch] Listing metrics');
                const extra: Record<string, string> = {};
                if (inputs.namespace) extra['Namespace'] = String(inputs.namespace);
                if (inputs.metricName) extra['MetricName'] = String(inputs.metricName);
                const xml = await call('ListMetrics', extra);
                const names = extractAll(xml, 'MetricName');
                const namespaces = extractAll(xml, 'Namespace');
                const metrics = names.map((name, i) => ({ metricName: name, namespace: namespaces[i] ?? '' }));
                return { output: { metrics, count: String(metrics.length) } };
            }
            case 'getMetricData': {
                const startTime = String(inputs.startTime ?? new Date(Date.now() - 3600000).toISOString());
                const endTime = String(inputs.endTime ?? new Date().toISOString());
                const metricName = String(inputs.metricName ?? '').trim();
                const namespace = String(inputs.namespace ?? '').trim();
                const stat = String(inputs.stat ?? 'Average');
                const period = String(inputs.period ?? '300');
                if (!metricName || !namespace) throw new Error('metricName and namespace are required.');
                logger.log(`[CloudWatch] Getting metric data for ${metricName}`);
                const xml = await call('GetMetricData', {
                    StartTime: startTime,
                    EndTime: endTime,
                    'MetricDataQueries.member.1.Id': 'm1',
                    'MetricDataQueries.member.1.MetricStat.Metric.Namespace': namespace,
                    'MetricDataQueries.member.1.MetricStat.Metric.MetricName': metricName,
                    'MetricDataQueries.member.1.MetricStat.Period': period,
                    'MetricDataQueries.member.1.MetricStat.Stat': stat,
                });
                const timestamps = extractAll(xml, 'Timestamp');
                const values = extractAll(xml, 'Value');
                const datapoints = timestamps.map((ts, i) => ({ timestamp: ts, value: values[i] ?? '' }));
                return { output: { datapoints, count: String(datapoints.length), metricName, namespace } };
            }
            case 'putMetricData': {
                const namespace = String(inputs.namespace ?? '').trim();
                const metricName = String(inputs.metricName ?? '').trim();
                const value = String(inputs.value ?? '0');
                const unit = String(inputs.unit ?? 'None');
                if (!namespace || !metricName) throw new Error('namespace and metricName are required.');
                logger.log(`[CloudWatch] Putting metric data for ${metricName}`);
                await call('PutMetricData', {
                    Namespace: namespace,
                    'MetricData.member.1.MetricName': metricName,
                    'MetricData.member.1.Value': value,
                    'MetricData.member.1.Unit': unit,
                    'MetricData.member.1.Timestamp': new Date().toISOString(),
                });
                return { output: { published: 'true', namespace, metricName, value } };
            }
            case 'describeAlarms': {
                logger.log('[CloudWatch] Describing alarms');
                const extra: Record<string, string> = {};
                if (inputs.alarmNames) {
                    const names = Array.isArray(inputs.alarmNames) ? inputs.alarmNames : [inputs.alarmNames];
                    names.forEach((n: string, i: number) => { extra[`AlarmNames.member.${i + 1}`] = n; });
                }
                if (inputs.stateValue) extra['StateValue'] = String(inputs.stateValue);
                const xml = await call('DescribeAlarms', extra);
                const alarmNames = extractAll(xml, 'AlarmName');
                const states = extractAll(xml, 'StateValue');
                const alarms = alarmNames.map((name, i) => ({ alarmName: name, stateValue: states[i] ?? '' }));
                return { output: { alarms, count: String(alarms.length) } };
            }
            case 'putMetricAlarm': {
                const alarmName = String(inputs.alarmName ?? '').trim();
                const metricName = String(inputs.metricName ?? '').trim();
                const namespace = String(inputs.namespace ?? '').trim();
                const threshold = String(inputs.threshold ?? '0');
                const comparisonOperator = String(inputs.comparisonOperator ?? 'GreaterThanThreshold');
                const evaluationPeriods = String(inputs.evaluationPeriods ?? '1');
                const period = String(inputs.period ?? '300');
                const statistic = String(inputs.statistic ?? 'Average');
                if (!alarmName || !metricName || !namespace) throw new Error('alarmName, metricName, and namespace are required.');
                logger.log(`[CloudWatch] Creating alarm ${alarmName}`);
                await call('PutMetricAlarm', {
                    AlarmName: alarmName,
                    MetricName: metricName,
                    Namespace: namespace,
                    Threshold: threshold,
                    ComparisonOperator: comparisonOperator,
                    EvaluationPeriods: evaluationPeriods,
                    Period: period,
                    Statistic: statistic,
                });
                return { output: { created: 'true', alarmName, metricName, namespace } };
            }
            case 'deleteAlarms': {
                const alarmNames = Array.isArray(inputs.alarmNames) ? inputs.alarmNames : (inputs.alarmNames ? [inputs.alarmNames] : []);
                if (alarmNames.length === 0) throw new Error('At least one alarmName is required.');
                const extra: Record<string, string> = {};
                alarmNames.forEach((n: string, i: number) => { extra[`AlarmNames.member.${i + 1}`] = n; });
                logger.log(`[CloudWatch] Deleting ${alarmNames.length} alarm(s)`);
                await call('DeleteAlarms', extra);
                return { output: { deleted: 'true', count: String(alarmNames.length) } };
            }
            case 'enableAlarmActions': {
                const alarmNames = Array.isArray(inputs.alarmNames) ? inputs.alarmNames : (inputs.alarmNames ? [inputs.alarmNames] : []);
                if (alarmNames.length === 0) throw new Error('At least one alarmName is required.');
                const extra: Record<string, string> = {};
                alarmNames.forEach((n: string, i: number) => { extra[`AlarmNames.member.${i + 1}`] = n; });
                logger.log(`[CloudWatch] Enabling alarm actions`);
                await call('EnableAlarmActions', extra);
                return { output: { enabled: 'true', count: String(alarmNames.length) } };
            }
            case 'disableAlarmActions': {
                const alarmNames = Array.isArray(inputs.alarmNames) ? inputs.alarmNames : (inputs.alarmNames ? [inputs.alarmNames] : []);
                if (alarmNames.length === 0) throw new Error('At least one alarmName is required.');
                const extra: Record<string, string> = {};
                alarmNames.forEach((n: string, i: number) => { extra[`AlarmNames.member.${i + 1}`] = n; });
                logger.log(`[CloudWatch] Disabling alarm actions`);
                await call('DisableAlarmActions', extra);
                return { output: { disabled: 'true', count: String(alarmNames.length) } };
            }
            case 'describeAlarmsForMetric': {
                const metricName = String(inputs.metricName ?? '').trim();
                const namespace = String(inputs.namespace ?? '').trim();
                if (!metricName || !namespace) throw new Error('metricName and namespace are required.');
                logger.log(`[CloudWatch] Describing alarms for metric ${metricName}`);
                const xml = await call('DescribeAlarmsForMetric', {
                    MetricName: metricName,
                    Namespace: namespace,
                    ...(inputs.statistic ? { Statistic: String(inputs.statistic) } : {}),
                    ...(inputs.period ? { Period: String(inputs.period) } : {}),
                });
                const alarmNames = extractAll(xml, 'AlarmName');
                const states = extractAll(xml, 'StateValue');
                const alarms = alarmNames.map((name, i) => ({ alarmName: name, stateValue: states[i] ?? '' }));
                return { output: { alarms, count: String(alarms.length) } };
            }
            case 'getMetricStatistics': {
                const namespace = String(inputs.namespace ?? '').trim();
                const metricName = String(inputs.metricName ?? '').trim();
                const startTime = String(inputs.startTime ?? new Date(Date.now() - 3600000).toISOString());
                const endTime = String(inputs.endTime ?? new Date().toISOString());
                const period = String(inputs.period ?? '300');
                const statistics = String(inputs.statistics ?? 'Average');
                if (!namespace || !metricName) throw new Error('namespace and metricName are required.');
                logger.log(`[CloudWatch] Getting metric statistics for ${metricName}`);
                const xml = await call('GetMetricStatistics', {
                    Namespace: namespace,
                    MetricName: metricName,
                    StartTime: startTime,
                    EndTime: endTime,
                    Period: period,
                    'Statistics.member.1': statistics,
                });
                const timestamps = extractAll(xml, 'Timestamp');
                const avgValues = extractAll(xml, statistics);
                const datapoints = timestamps.map((ts, i) => ({ timestamp: ts, [statistics.toLowerCase()]: avgValues[i] ?? '' }));
                return { output: { datapoints, count: String(datapoints.length), metricName, namespace } };
            }
            case 'listDashboards': {
                logger.log('[CloudWatch] Listing dashboards');
                const extra: Record<string, string> = {};
                if (inputs.dashboardNamePrefix) extra['DashboardNamePrefix'] = String(inputs.dashboardNamePrefix);
                const xml = await call('ListDashboards', extra);
                const names = extractAll(xml, 'DashboardName');
                const arns = extractAll(xml, 'DashboardArn');
                const dashboards = names.map((name, i) => ({ dashboardName: name, dashboardArn: arns[i] ?? '' }));
                return { output: { dashboards, count: String(dashboards.length) } };
            }
            case 'getDashboard': {
                const dashboardName = String(inputs.dashboardName ?? '').trim();
                if (!dashboardName) throw new Error('dashboardName is required.');
                logger.log(`[CloudWatch] Getting dashboard ${dashboardName}`);
                const xml = await call('GetDashboard', { DashboardName: dashboardName });
                return { output: { dashboardName, dashboardArn: extractTag(xml, 'DashboardArn'), dashboardBody: extractTag(xml, 'DashboardBody') } };
            }
            case 'putDashboard': {
                const dashboardName = String(inputs.dashboardName ?? '').trim();
                const dashboardBody = String(inputs.dashboardBody ?? '{}').trim();
                if (!dashboardName) throw new Error('dashboardName is required.');
                logger.log(`[CloudWatch] Putting dashboard ${dashboardName}`);
                const xml = await call('PutDashboard', { DashboardName: dashboardName, DashboardBody: dashboardBody });
                return { output: { dashboardName, dashboardArn: extractTag(xml, 'DashboardArn') } };
            }
            case 'deleteDashboards': {
                const dashboardNames = Array.isArray(inputs.dashboardNames) ? inputs.dashboardNames : (inputs.dashboardNames ? [inputs.dashboardNames] : []);
                if (dashboardNames.length === 0) throw new Error('At least one dashboardName is required.');
                const extra: Record<string, string> = {};
                dashboardNames.forEach((n: string, i: number) => { extra[`DashboardNames.member.${i + 1}`] = n; });
                logger.log(`[CloudWatch] Deleting ${dashboardNames.length} dashboard(s)`);
                await call('DeleteDashboards', extra);
                return { output: { deleted: 'true', count: String(dashboardNames.length) } };
            }
            case 'setAlarmState': {
                const alarmName = String(inputs.alarmName ?? '').trim();
                const stateValue = String(inputs.stateValue ?? 'OK').trim();
                const stateReason = String(inputs.stateReason ?? 'Manually set via SabFlow');
                if (!alarmName) throw new Error('alarmName is required.');
                logger.log(`[CloudWatch] Setting alarm ${alarmName} state to ${stateValue}`);
                await call('SetAlarmState', { AlarmName: alarmName, StateValue: stateValue, StateReason: stateReason });
                return { output: { alarmName, stateValue, updated: 'true' } };
            }
            default:
                return { error: `Unknown CloudWatch action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`[CloudWatch] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
