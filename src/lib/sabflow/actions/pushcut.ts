
'use server';

const PUSHCUT_BASE = 'https://api.pushcut.io/v1';

async function pushcutFetch(
    apiKey: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    const url = `${PUSHCUT_BASE}${path}`;
    logger?.log(`[Pushcut] ${method} ${path}`);

    const headers: Record<string, string> = {
        'API-Key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
    };

    const options: RequestInit = { method, headers };
    if (body !== undefined) options.body = JSON.stringify(body);

    const res = await fetch(url, options);

    if (res.status === 204) return { success: true };

    const text = await res.text();
    let data: any;
    try {
        data = JSON.parse(text);
    } catch {
        data = text;
    }

    if (!res.ok) {
        throw new Error(data?.error || data?.message || `Pushcut API error: ${res.status}`);
    }

    return data;
}

export async function executePushcutAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const pc = (method: string, path: string, body?: any) =>
            pushcutFetch(apiKey, method, path, body, logger);

        switch (actionName) {
            case 'listNotifications': {
                const data = await pc('GET', '/notifications');
                return { output: { notifications: data } };
            }

            case 'getNotification': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const data = await pc('GET', `/notifications/${encodeURIComponent(name)}`);
                return { output: { notification: data } };
            }

            case 'sendNotification': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const payload: any = {};
                if (inputs.title) payload.title = String(inputs.title);
                if (inputs.text) payload.text = String(inputs.text);
                if (inputs.input !== undefined) payload.input = inputs.input;
                if (inputs.actions) payload.actions = inputs.actions;
                if (inputs.devices) payload.devices = inputs.devices;
                if (inputs.sound) payload.sound = String(inputs.sound);
                const data = await pc('POST', `/notifications/${encodeURIComponent(name)}`, payload);
                logger.log(`[Pushcut] Notification sent: ${name}`);
                return { output: { result: data } };
            }

            case 'listDevices': {
                const data = await pc('GET', '/devices');
                return { output: { devices: data } };
            }

            case 'listSounds': {
                const data = await pc('GET', '/sounds');
                return { output: { sounds: data } };
            }

            case 'triggerShortcut': {
                const shortcut = String(inputs.shortcut ?? '').trim();
                if (!shortcut) throw new Error('shortcut is required.');
                const params = new URLSearchParams({ shortcut });
                if (inputs.input !== undefined) params.set('input', String(inputs.input));
                const data = await pc('POST', `/execute?${params.toString()}`);
                logger.log(`[Pushcut] Shortcut triggered: ${shortcut}`);
                return { output: { result: data } };
            }

            case 'sendToDevice': {
                const name = String(inputs.name ?? '').trim();
                const device = String(inputs.device ?? '').trim();
                if (!name) throw new Error('name is required.');
                if (!device) throw new Error('device is required.');
                const payload: any = { devices: [device] };
                if (inputs.title) payload.title = String(inputs.title);
                if (inputs.text) payload.text = String(inputs.text);
                if (inputs.input !== undefined) payload.input = inputs.input;
                if (inputs.actions) payload.actions = inputs.actions;
                const data = await pc('POST', `/notifications/${encodeURIComponent(name)}`, payload);
                logger.log(`[Pushcut] Notification sent to device ${device}: ${name}`);
                return { output: { result: data } };
            }

            case 'scheduleNotification': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const payload: any = {};
                if (inputs.title) payload.title = String(inputs.title);
                if (inputs.text) payload.text = String(inputs.text);
                if (inputs.delay !== undefined) payload.delay = Number(inputs.delay);
                if (inputs.scheduledAt) payload.scheduledAt = String(inputs.scheduledAt);
                if (inputs.devices) payload.devices = inputs.devices;
                const data = await pc('POST', `/notifications/${encodeURIComponent(name)}`, payload);
                logger.log(`[Pushcut] Notification scheduled: ${name}`);
                return { output: { result: data } };
            }

            case 'cancelScheduled': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id (scheduled notification id) is required.');
                const data = await pc('DELETE', `/scheduled/${encodeURIComponent(id)}`);
                logger.log(`[Pushcut] Scheduled notification cancelled: ${id}`);
                return { output: { cancelled: true, result: data } };
            }

            case 'getWebhookLog': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const qs = params.toString();
                const data = await pc('GET', `/webhooklog${qs ? `?${qs}` : ''}`);
                return { output: { log: data } };
            }

            default:
                return { error: `Pushcut action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Pushcut action failed.' };
    }
}
