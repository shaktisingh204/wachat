
'use server';

const UPTIMEROBOT_BASE = 'https://api.uptimerobot.com/v2';

async function urPost(
    apiKey: string,
    endpoint: string,
    extraParams: Record<string, string>,
    logger?: any
): Promise<any> {
    const url = `${UPTIMEROBOT_BASE}${endpoint}`;
    logger?.log(`[UptimeRobot] POST ${endpoint}`);

    const params = new URLSearchParams({ api_key: apiKey, format: 'json', ...extraParams });

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
    });

    const text = await res.text();
    let data: any;
    try {
        data = JSON.parse(text);
    } catch {
        data = text;
    }

    if (!res.ok) {
        throw new Error(data?.error?.message || data?.message || `UptimeRobot API error: ${res.status}`);
    }
    if (data?.stat === 'fail') {
        throw new Error(data?.error?.message || data?.error?.type || 'UptimeRobot request failed');
    }
    return data;
}

export async function executeUptimerobotAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const ur = (endpoint: string, extra: Record<string, string>) =>
            urPost(apiKey, endpoint, extra, logger);

        switch (actionName) {
            case 'getMonitors': {
                const extra: Record<string, string> = {
                    response_times: '1',
                    all_time_uptime_ratio: '1',
                };
                if (inputs.monitorIds) {
                    const ids: string[] = Array.isArray(inputs.monitorIds)
                        ? inputs.monitorIds
                        : String(inputs.monitorIds).split(',').map((s: string) => s.trim());
                    extra.monitors = ids.join('-');
                }
                const data = await ur('/getMonitors', extra);
                const monitors = (data.monitors ?? []).map((m: any) => ({
                    id: m.id,
                    friendlyName: m.friendly_name,
                    url: m.url,
                    type: m.type,
                    status: m.status,
                    allTimeUptimeRatio: m.all_time_uptime_ratio,
                }));
                return { output: { stat: data.stat, monitors } };
            }

            case 'getMonitor': {
                const monitorId = String(inputs.monitorId ?? '').trim();
                if (!monitorId) throw new Error('monitorId is required.');

                const data = await ur('/getMonitors', { monitors: monitorId });
                const monitor = (data.monitors ?? [])[0] ?? {};
                return {
                    output: {
                        monitors: [{
                            id: monitor.id,
                            status: monitor.status,
                            allTimeUptimeRatio: monitor.all_time_uptime_ratio,
                        }],
                    },
                };
            }

            case 'createMonitor': {
                const friendlyName = String(inputs.friendlyName ?? '').trim();
                const url = String(inputs.url ?? '').trim();
                if (!friendlyName) throw new Error('friendlyName is required.');
                if (!url) throw new Error('url is required.');

                const extra: Record<string, string> = {
                    friendly_name: friendlyName,
                    url,
                    type: String(inputs.type ?? 1),
                    alert_contacts: String(inputs.alertContacts ?? ''),
                    interval: String(inputs.interval ?? 300),
                };

                const data = await ur('/newMonitor', extra);
                logger.log(`[UptimeRobot] Monitor created: ${data?.monitor?.id}`);
                return { output: { stat: data.stat, monitor: { id: data.monitor?.id, status: data.monitor?.status } } };
            }

            case 'updateMonitor': {
                const monitorId = String(inputs.monitorId ?? '').trim();
                if (!monitorId) throw new Error('monitorId is required.');

                const extra: Record<string, string> = { id: monitorId };
                if (inputs.friendlyName !== undefined) extra.friendly_name = String(inputs.friendlyName);
                if (inputs.url !== undefined) extra.url = String(inputs.url);
                if (inputs.status !== undefined) extra.status = String(inputs.status);
                if (inputs.interval !== undefined) extra.interval = String(inputs.interval);

                const data = await ur('/editMonitor', extra);
                logger.log(`[UptimeRobot] Monitor updated: ${monitorId}`);
                return { output: { stat: data.stat, monitor: { id: data.monitor?.id ?? monitorId } } };
            }

            case 'deleteMonitor': {
                const monitorId = String(inputs.monitorId ?? '').trim();
                if (!monitorId) throw new Error('monitorId is required.');

                const data = await ur('/deleteMonitor', { id: monitorId });
                logger.log(`[UptimeRobot] Monitor deleted: ${monitorId}`);
                return { output: { stat: data.stat, monitor: { id: data.monitor?.id ?? monitorId } } };
            }

            case 'pauseMonitor': {
                const monitorId = String(inputs.monitorId ?? '').trim();
                if (!monitorId) throw new Error('monitorId is required.');

                const data = await ur('/editMonitor', { id: monitorId, status: '0' });
                logger.log(`[UptimeRobot] Monitor paused: ${monitorId}`);
                return { output: { stat: data.stat, monitor: { id: data.monitor?.id ?? monitorId } } };
            }

            case 'resumeMonitor': {
                const monitorId = String(inputs.monitorId ?? '').trim();
                if (!monitorId) throw new Error('monitorId is required.');

                const data = await ur('/editMonitor', { id: monitorId, status: '1' });
                logger.log(`[UptimeRobot] Monitor resumed: ${monitorId}`);
                return { output: { stat: data.stat } };
            }

            case 'getAlertContacts': {
                const data = await ur('/getAlertContacts', {});
                const alertContacts = (data.alert_contacts ?? []).map((c: any) => ({
                    id: c.id,
                    type: c.type,
                    value: c.value,
                    status: c.status,
                }));
                return { output: { stat: data.stat, alertContacts } };
            }

            case 'createAlertContact': {
                const type = String(inputs.type ?? '').trim();
                const value = String(inputs.value ?? '').trim();
                if (!type) throw new Error('type is required.');
                if (!value) throw new Error('value is required.');

                const extra: Record<string, string> = { type, value };
                if (inputs.friendlyName) extra.friendly_name = String(inputs.friendlyName);

                const data = await ur('/newAlertContact', extra);
                logger.log(`[UptimeRobot] Alert contact created: ${data?.alertcontact?.id}`);
                return { output: { stat: data.stat, alertcontact: { id: data.alertcontact?.id } } };
            }

            case 'getPublicStatusPages': {
                const data = await ur('/getPSPs', {});
                const psps = (data.psps ?? []).map((p: any) => ({
                    id: p.id,
                    friendlyName: p.friendly_name,
                    standardUrl: p.standard_url,
                    customUrl: p.custom_url,
                }));
                return { output: { stat: data.stat, psps } };
            }

            case 'getAccountDetails': {
                const data = await ur('/getAccountDetails', {});
                const acc = data.account ?? {};
                return {
                    output: {
                        stat: data.stat,
                        account: {
                            email: acc.email,
                            monitorLimit: acc.monitor_limit,
                            monitorInterval: acc.monitor_interval,
                            upMonitors: acc.up_monitors,
                            downMonitors: acc.down_monitors,
                            pausedMonitors: acc.paused_monitors,
                        },
                    },
                };
            }

            default:
                return { error: `UptimeRobot action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'UptimeRobot action failed.' };
    }
}
