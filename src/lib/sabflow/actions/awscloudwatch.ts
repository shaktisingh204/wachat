
'use server';

import { createHmac, createHash } from 'crypto';

function sign(key: Buffer, msg: string): Buffer {
    return createHmac('sha256', key).update(msg).digest();
}

function getSignatureKey(secret: string, date: string, region: string, service: string): Buffer {
    return sign(sign(sign(sign(Buffer.from('AWS4' + secret), date), region), service), 'aws4_request');
}

function awsSigV4(
    method: string,
    url: string,
    body: string,
    service: string,
    region: string,
    accessKeyId: string,
    secretAccessKey: string,
    sessionToken?: string,
    extraHeaders?: Record<string, string>
): Record<string, string> {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
    const dateStamp = amzDate.slice(0, 8);
    const parsedUrl = new URL(url);
    const host = parsedUrl.host;
    const canonicalUri = parsedUrl.pathname || '/';
    const canonicalQuerystring = parsedUrl.searchParams.toString();
    const payloadHash = createHash('sha256').update(body).digest('hex');
    const headersObj: Record<string, string> = {
        host,
        'x-amz-date': amzDate,
        'x-amz-content-sha256': payloadHash,
        ...(sessionToken ? { 'x-amz-security-token': sessionToken } : {}),
        ...(extraHeaders ?? {}),
    };
    const signedHeaders = Object.keys(headersObj).sort().join(';');
    const canonicalHeaders = Object.keys(headersObj).sort().map(k => `${k}:${headersObj[k]}\n`).join('');
    const canonicalRequest = [method, canonicalUri, canonicalQuerystring, canonicalHeaders, signedHeaders, payloadHash].join('\n');
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, createHash('sha256').update(canonicalRequest).digest('hex')].join('\n');
    const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, service);
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
    return {
        ...headersObj,
        'Authorization': `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    };
}

function encodeForm(params: Record<string, string>): string {
    return Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}

export async function executeAwsCloudWatchAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const region = String(inputs.region ?? 'us-east-1').trim();
        const accessKeyId = String(inputs.accessKeyId ?? '').trim();
        const secretAccessKey = String(inputs.secretAccessKey ?? '').trim();
        const sessionToken = inputs.sessionToken ? String(inputs.sessionToken).trim() : undefined;

        if (!accessKeyId || !secretAccessKey) throw new Error('accessKeyId and secretAccessKey are required.');

        const metricsEndpoint = `https://monitoring.${region}.amazonaws.com`;
        const logsEndpoint = `https://logs.${region}.amazonaws.com`;

        // Helper for CloudWatch Metrics (form-urlencoded Query API)
        async function metricsReq(params: Record<string, string>): Promise<string> {
            const body = encodeForm({ ...params, Version: '2010-08-01' });
            const headers = awsSigV4('POST', metricsEndpoint + '/', body, 'monitoring', region, accessKeyId, secretAccessKey, sessionToken);
            headers['Content-Type'] = 'application/x-www-form-urlencoded';
            const res = await fetch(metricsEndpoint + '/', { method: 'POST', headers, body });
            const text = await res.text();
            if (!res.ok) throw new Error(text);
            return text;
        }

        // Helper for CloudWatch Logs (JSON API)
        async function logsReq(target: string, body: any): Promise<any> {
            const bodyStr = JSON.stringify(body);
            const extraHeaders: Record<string, string> = {
                'content-type': 'application/x-amz-json-1.1',
                'x-amz-target': target,
            };
            const headers = awsSigV4('POST', logsEndpoint + '/', bodyStr, 'logs', region, accessKeyId, secretAccessKey, sessionToken, extraHeaders);
            headers['Content-Type'] = 'application/x-amz-json-1.1';
            headers['X-Amz-Target'] = target;
            const res = await fetch(logsEndpoint + '/', { method: 'POST', headers, body: bodyStr });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = text; }
            if (!res.ok) throw new Error(typeof data === 'object' ? (data?.message ?? data?.__type ?? JSON.stringify(data)) : text);
            return data;
        }

        function extractXmlValue(text: string, tag: string): string {
            const match = text.match(new RegExp(`<${tag}>(.*?)</${tag}>`, 's'));
            return match ? match[1] : '';
        }

        switch (actionName) {
            case 'getMetricData': {
                const params: Record<string, string> = { Action: 'GetMetricData' };
                if (inputs.startTime) params.StartTime = inputs.startTime;
                if (inputs.endTime) params.EndTime = inputs.endTime;
                if (inputs.maxDatapoints) params.MaxDatapoints = String(inputs.maxDatapoints);
                if (Array.isArray(inputs.metricDataQueries)) {
                    inputs.metricDataQueries.forEach((q: any, i: number) => {
                        const idx = i + 1;
                        params[`MetricDataQueries.member.${idx}.Id`] = String(q.id ?? `m${idx}`);
                        if (q.expression) params[`MetricDataQueries.member.${idx}.Expression`] = q.expression;
                        if (q.metricStat) {
                            params[`MetricDataQueries.member.${idx}.MetricStat.Metric.Namespace`] = q.metricStat.namespace ?? '';
                            params[`MetricDataQueries.member.${idx}.MetricStat.Metric.MetricName`] = q.metricStat.metricName ?? '';
                            params[`MetricDataQueries.member.${idx}.MetricStat.Period`] = String(q.metricStat.period ?? 60);
                            params[`MetricDataQueries.member.${idx}.MetricStat.Stat`] = q.metricStat.stat ?? 'Average';
                        }
                    });
                }
                const text = await metricsReq(params);
                logger.log('[CloudWatch] GetMetricData executed');
                return { output: { rawXml: text, status: 'success' } };
            }

            case 'getMetricStatistics': {
                const namespace = String(inputs.namespace ?? '').trim();
                const metricName = String(inputs.metricName ?? '').trim();
                if (!namespace || !metricName) throw new Error('namespace and metricName are required.');
                const params: Record<string, string> = {
                    Action: 'GetMetricStatistics',
                    Namespace: namespace,
                    MetricName: metricName,
                    Period: String(inputs.period ?? 60),
                    StartTime: inputs.startTime ?? new Date(Date.now() - 3600000).toISOString(),
                    EndTime: inputs.endTime ?? new Date().toISOString(),
                };
                const stats = Array.isArray(inputs.statistics) ? inputs.statistics : ['Average'];
                stats.forEach((s: string, i: number) => { params[`Statistics.member.${i + 1}`] = s; });
                if (inputs.unit) params.Unit = inputs.unit;
                const text = await metricsReq(params);
                logger.log('[CloudWatch] GetMetricStatistics executed');
                return { output: { rawXml: text, status: 'success' } };
            }

            case 'listMetrics': {
                const params: Record<string, string> = { Action: 'ListMetrics' };
                if (inputs.namespace) params.Namespace = inputs.namespace;
                if (inputs.metricName) params.MetricName = inputs.metricName;
                if (inputs.nextToken) params.NextToken = inputs.nextToken;
                const text = await metricsReq(params);
                const metricMatches = [...text.matchAll(/<MetricName>(.*?)<\/MetricName>[\s\S]*?<Namespace>(.*?)<\/Namespace>/g)];
                const metrics = metricMatches.map(m => ({ metricName: m[1], namespace: m[2] }));
                logger.log(`[CloudWatch] Listed ${metrics.length} metrics`);
                return { output: { metrics, count: String(metrics.length) } };
            }

            case 'putMetricData': {
                const namespace = String(inputs.namespace ?? '').trim();
                if (!namespace) throw new Error('namespace is required.');
                const params: Record<string, string> = {
                    Action: 'PutMetricData',
                    Namespace: namespace,
                };
                const metricData = Array.isArray(inputs.metricData) ? inputs.metricData : [];
                metricData.forEach((m: any, i: number) => {
                    const idx = i + 1;
                    params[`MetricData.member.${idx}.MetricName`] = m.metricName ?? m.MetricName ?? '';
                    if (m.value !== undefined) params[`MetricData.member.${idx}.Value`] = String(m.value);
                    if (m.unit) params[`MetricData.member.${idx}.Unit`] = m.unit;
                    if (m.timestamp) params[`MetricData.member.${idx}.Timestamp`] = m.timestamp;
                });
                await metricsReq(params);
                logger.log('[CloudWatch] PutMetricData executed');
                return { output: { status: 'submitted', count: String(metricData.length) } };
            }

            case 'putMetricAlarm': {
                const alarmName = String(inputs.alarmName ?? '').trim();
                if (!alarmName) throw new Error('alarmName is required.');
                const params: Record<string, string> = {
                    Action: 'PutMetricAlarm',
                    AlarmName: alarmName,
                };
                if (inputs.alarmDescription) params.AlarmDescription = inputs.alarmDescription;
                if (inputs.metricName) params.MetricName = inputs.metricName;
                if (inputs.namespace) params.Namespace = inputs.namespace;
                if (inputs.statistic) params.Statistic = inputs.statistic;
                if (inputs.period) params.Period = String(inputs.period);
                if (inputs.evaluationPeriods) params.EvaluationPeriods = String(inputs.evaluationPeriods);
                if (inputs.threshold !== undefined) params.Threshold = String(inputs.threshold);
                if (inputs.comparisonOperator) params.ComparisonOperator = inputs.comparisonOperator;
                if (inputs.treatMissingData) params.TreatMissingData = inputs.treatMissingData;
                if (inputs.actionsEnabled !== undefined) params.ActionsEnabled = String(inputs.actionsEnabled);
                const alarmActions = Array.isArray(inputs.alarmActions) ? inputs.alarmActions : [];
                alarmActions.forEach((a: string, i: number) => { params[`AlarmActions.member.${i + 1}`] = a; });
                await metricsReq(params);
                logger.log(`[CloudWatch] PutMetricAlarm: ${alarmName}`);
                return { output: { alarmName, status: 'created' } };
            }

            case 'describeAlarms': {
                const params: Record<string, string> = { Action: 'DescribeAlarms' };
                if (inputs.maxRecords) params.MaxRecords = String(inputs.maxRecords);
                if (inputs.stateValue) params.StateValue = inputs.stateValue;
                if (inputs.nextToken) params.NextToken = inputs.nextToken;
                const alarmNames = Array.isArray(inputs.alarmNames) ? inputs.alarmNames : [];
                alarmNames.forEach((n: string, i: number) => { params[`AlarmNames.member.${i + 1}`] = n; });
                const text = await metricsReq(params);
                const nameMatches = [...text.matchAll(/<AlarmName>(.*?)<\/AlarmName>/g)].map(m => m[1]);
                logger.log(`[CloudWatch] Described ${nameMatches.length} alarms`);
                return { output: { alarmNames: nameMatches, count: String(nameMatches.length), rawXml: text } };
            }

            case 'setAlarmState': {
                const alarmName = String(inputs.alarmName ?? '').trim();
                if (!alarmName) throw new Error('alarmName is required.');
                const stateValue = String(inputs.stateValue ?? '').trim();
                if (!stateValue) throw new Error('stateValue is required (OK, ALARM, INSUFFICIENT_DATA).');
                const params: Record<string, string> = {
                    Action: 'SetAlarmState',
                    AlarmName: alarmName,
                    StateValue: stateValue,
                    StateReason: String(inputs.stateReason ?? 'Set by SabFlow'),
                };
                if (inputs.stateReasonData) params.StateReasonData = inputs.stateReasonData;
                await metricsReq(params);
                logger.log(`[CloudWatch] SetAlarmState: ${alarmName} -> ${stateValue}`);
                return { output: { alarmName, stateValue, status: 'updated' } };
            }

            case 'deleteAlarms': {
                const alarmNames = Array.isArray(inputs.alarmNames) ? inputs.alarmNames : (inputs.alarmName ? [inputs.alarmName] : []);
                if (!alarmNames.length) throw new Error('alarmNames is required.');
                const params: Record<string, string> = { Action: 'DeleteAlarms' };
                alarmNames.forEach((n: string, i: number) => { params[`AlarmNames.member.${i + 1}`] = n; });
                await metricsReq(params);
                logger.log(`[CloudWatch] Deleted ${alarmNames.length} alarms`);
                return { output: { deletedAlarms: alarmNames, count: String(alarmNames.length), status: 'deleted' } };
            }

            case 'describeLogGroups': {
                const body: any = {};
                if (inputs.logGroupNamePrefix) body.logGroupNamePrefix = inputs.logGroupNamePrefix;
                if (inputs.limit) body.limit = inputs.limit;
                if (inputs.nextToken) body.nextToken = inputs.nextToken;
                const data = await logsReq('Logs_20140328.DescribeLogGroups', body);
                const groups = data.logGroups ?? [];
                logger.log(`[CloudWatch] Described ${groups.length} log groups`);
                return { output: { logGroups: groups, count: String(groups.length) } };
            }

            case 'describeLogStreams': {
                const logGroupName = String(inputs.logGroupName ?? '').trim();
                if (!logGroupName) throw new Error('logGroupName is required.');
                const body: any = { logGroupName };
                if (inputs.logStreamNamePrefix) body.logStreamNamePrefix = inputs.logStreamNamePrefix;
                if (inputs.orderBy) body.orderBy = inputs.orderBy;
                if (inputs.descending !== undefined) body.descending = inputs.descending;
                if (inputs.limit) body.limit = inputs.limit;
                if (inputs.nextToken) body.nextToken = inputs.nextToken;
                const data = await logsReq('Logs_20140328.DescribeLogStreams', body);
                const streams = data.logStreams ?? [];
                logger.log(`[CloudWatch] Described ${streams.length} log streams`);
                return { output: { logStreams: streams, count: String(streams.length) } };
            }

            case 'filterLogEvents': {
                const logGroupName = String(inputs.logGroupName ?? '').trim();
                if (!logGroupName) throw new Error('logGroupName is required.');
                const body: any = { logGroupName };
                if (inputs.filterPattern) body.filterPattern = inputs.filterPattern;
                if (inputs.startTime !== undefined) body.startTime = inputs.startTime;
                if (inputs.endTime !== undefined) body.endTime = inputs.endTime;
                if (inputs.logStreamNames) body.logStreamNames = inputs.logStreamNames;
                if (inputs.limit) body.limit = inputs.limit;
                if (inputs.nextToken) body.nextToken = inputs.nextToken;
                const data = await logsReq('Logs_20140328.FilterLogEvents', body);
                const events = data.events ?? [];
                logger.log(`[CloudWatch] Filtered ${events.length} log events`);
                return { output: { events, count: String(events.length) } };
            }

            case 'putLogEvents': {
                const logGroupName = String(inputs.logGroupName ?? '').trim();
                const logStreamName = String(inputs.logStreamName ?? '').trim();
                if (!logGroupName) throw new Error('logGroupName is required.');
                if (!logStreamName) throw new Error('logStreamName is required.');
                const logEvents = Array.isArray(inputs.logEvents) ? inputs.logEvents : [];
                if (!logEvents.length) throw new Error('logEvents is required.');
                const body: any = { logGroupName, logStreamName, logEvents };
                if (inputs.sequenceToken) body.sequenceToken = inputs.sequenceToken;
                const data = await logsReq('Logs_20140328.PutLogEvents', body);
                logger.log(`[CloudWatch] Put ${logEvents.length} log events`);
                return { output: { nextSequenceToken: data.nextSequenceToken, count: String(logEvents.length), status: 'submitted' } };
            }

            case 'createLogGroup': {
                const logGroupName = String(inputs.logGroupName ?? '').trim();
                if (!logGroupName) throw new Error('logGroupName is required.');
                const body: any = { logGroupName };
                if (inputs.kmsKeyId) body.kmsKeyId = inputs.kmsKeyId;
                if (inputs.retentionInDays) body.retentionInDays = inputs.retentionInDays;
                await logsReq('Logs_20140328.CreateLogGroup', body);
                logger.log(`[CloudWatch] Created log group: ${logGroupName}`);
                return { output: { logGroupName, status: 'created' } };
            }

            case 'getLogEvents': {
                const logGroupName = String(inputs.logGroupName ?? '').trim();
                const logStreamName = String(inputs.logStreamName ?? '').trim();
                if (!logGroupName) throw new Error('logGroupName is required.');
                if (!logStreamName) throw new Error('logStreamName is required.');
                const body: any = { logGroupName, logStreamName };
                if (inputs.startTime !== undefined) body.startTime = inputs.startTime;
                if (inputs.endTime !== undefined) body.endTime = inputs.endTime;
                if (inputs.nextToken) body.nextToken = inputs.nextToken;
                if (inputs.limit) body.limit = inputs.limit;
                if (inputs.startFromHead !== undefined) body.startFromHead = inputs.startFromHead;
                const data = await logsReq('Logs_20140328.GetLogEvents', body);
                const events = data.events ?? [];
                logger.log(`[CloudWatch] Got ${events.length} log events`);
                return { output: { events, count: String(events.length), nextForwardToken: data.nextForwardToken, nextBackwardToken: data.nextBackwardToken } };
            }

            default:
                throw new Error(`Unknown AWS CloudWatch action: ${actionName}`);
        }
    } catch (err: any) {
        return { error: err.message ?? String(err) };
    }
}
