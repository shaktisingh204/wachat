'use server';

const FONNTE_BASE = 'https://fonnte.com/api';

export async function executeFonnteAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const token = String(inputs.token ?? '').trim();
        if (!token) throw new Error('token is required.');

        const headers: Record<string, string> = {
            'Authorization': token,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'sendMessage': {
                const target = String(inputs.target ?? '').trim();
                const message = String(inputs.message ?? '').trim();
                if (!target) throw new Error('target is required.');
                if (!message) throw new Error('message is required.');
                const body: Record<string, any> = { target, message };
                if (inputs.delay) body.delay = inputs.delay;
                if (inputs.schedule) body.schedule = inputs.schedule;
                const res = await fetch(`${FONNTE_BASE}/send`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!data.status) throw new Error(data.reason || 'Fonnte sendMessage failed.');
                return { output: { status: String(data.status), process: data.process ?? '' } };
            }

            case 'sendImage': {
                const target = String(inputs.target ?? '').trim();
                const url = String(inputs.url ?? '').trim();
                if (!target) throw new Error('target is required.');
                if (!url) throw new Error('url is required.');
                const body: Record<string, any> = { target, url };
                if (inputs.caption) body.caption = inputs.caption;
                const res = await fetch(`${FONNTE_BASE}/send`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!data.status) throw new Error(data.reason || 'Fonnte sendImage failed.');
                return { output: { status: String(data.status), process: data.process ?? '' } };
            }

            case 'sendDocument': {
                const target = String(inputs.target ?? '').trim();
                const url = String(inputs.url ?? '').trim();
                if (!target) throw new Error('target is required.');
                if (!url) throw new Error('url is required.');
                const body: Record<string, any> = { target, url };
                if (inputs.filename) body.filename = inputs.filename;
                const res = await fetch(`${FONNTE_BASE}/send`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!data.status) throw new Error(data.reason || 'Fonnte sendDocument failed.');
                return { output: { status: String(data.status), process: data.process ?? '' } };
            }

            case 'sendVideo': {
                const target = String(inputs.target ?? '').trim();
                const url = String(inputs.url ?? '').trim();
                if (!target) throw new Error('target is required.');
                if (!url) throw new Error('url is required.');
                const body: Record<string, any> = { target, url };
                if (inputs.caption) body.caption = inputs.caption;
                const res = await fetch(`${FONNTE_BASE}/send`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!data.status) throw new Error(data.reason || 'Fonnte sendVideo failed.');
                return { output: { status: String(data.status), process: data.process ?? '' } };
            }

            case 'sendAudio': {
                const target = String(inputs.target ?? '').trim();
                const url = String(inputs.url ?? '').trim();
                if (!target) throw new Error('target is required.');
                if (!url) throw new Error('url is required.');
                const res = await fetch(`${FONNTE_BASE}/send`, { method: 'POST', headers, body: JSON.stringify({ target, url }) });
                const data = await res.json();
                if (!data.status) throw new Error(data.reason || 'Fonnte sendAudio failed.');
                return { output: { status: String(data.status), process: data.process ?? '' } };
            }

            case 'sendLocation': {
                const target = String(inputs.target ?? '').trim();
                const latitude = String(inputs.latitude ?? '').trim();
                const longitude = String(inputs.longitude ?? '').trim();
                if (!target) throw new Error('target is required.');
                if (!latitude || !longitude) throw new Error('latitude and longitude are required.');
                const body: Record<string, any> = { target, latitude, longitude };
                if (inputs.address) body.address = inputs.address;
                const res = await fetch(`${FONNTE_BASE}/send`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!data.status) throw new Error(data.reason || 'Fonnte sendLocation failed.');
                return { output: { status: String(data.status), process: data.process ?? '' } };
            }

            case 'sendContact': {
                const target = String(inputs.target ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                const phone = String(inputs.phone ?? '').trim();
                if (!target) throw new Error('target is required.');
                if (!name || !phone) throw new Error('name and phone are required.');
                const res = await fetch(`${FONNTE_BASE}/send`, {
                    method: 'POST', headers,
                    body: JSON.stringify({ target, name, phone }),
                });
                const data = await res.json();
                if (!data.status) throw new Error(data.reason || 'Fonnte sendContact failed.');
                return { output: { status: String(data.status), process: data.process ?? '' } };
            }

            case 'sendButtons': {
                const target = String(inputs.target ?? '').trim();
                const message = String(inputs.message ?? '').trim();
                const buttons = inputs.buttons;
                if (!target) throw new Error('target is required.');
                if (!message) throw new Error('message is required.');
                if (!buttons) throw new Error('buttons are required.');
                const parsedButtons = Array.isArray(buttons) ? buttons : JSON.parse(buttons);
                const res = await fetch(`${FONNTE_BASE}/send`, {
                    method: 'POST', headers,
                    body: JSON.stringify({ target, message, buttons: parsedButtons }),
                });
                const data = await res.json();
                if (!data.status) throw new Error(data.reason || 'Fonnte sendButtons failed.');
                return { output: { status: String(data.status), process: data.process ?? '' } };
            }

            case 'sendList': {
                const target = String(inputs.target ?? '').trim();
                const message = String(inputs.message ?? '').trim();
                const listItems = inputs.listItems;
                if (!target) throw new Error('target is required.');
                if (!message) throw new Error('message is required.');
                if (!listItems) throw new Error('listItems are required.');
                const parsedList = Array.isArray(listItems) ? listItems : JSON.parse(listItems);
                const body: Record<string, any> = { target, message, list: parsedList };
                if (inputs.listTitle) body.list_title = inputs.listTitle;
                const res = await fetch(`${FONNTE_BASE}/send`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!data.status) throw new Error(data.reason || 'Fonnte sendList failed.');
                return { output: { status: String(data.status), process: data.process ?? '' } };
            }

            case 'sendTemplate': {
                const target = String(inputs.target ?? '').trim();
                const templateName = String(inputs.templateName ?? '').trim();
                if (!target) throw new Error('target is required.');
                if (!templateName) throw new Error('templateName is required.');
                const body: Record<string, any> = { target, template_name: templateName };
                if (inputs.variables) {
                    body.variables = Array.isArray(inputs.variables) ? inputs.variables : JSON.parse(inputs.variables);
                }
                const res = await fetch(`${FONNTE_BASE}/send`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!data.status) throw new Error(data.reason || 'Fonnte sendTemplate failed.');
                return { output: { status: String(data.status), process: data.process ?? '' } };
            }

            case 'sendBulk': {
                const targets = inputs.targets;
                const message = String(inputs.message ?? '').trim();
                if (!targets) throw new Error('targets are required.');
                if (!message) throw new Error('message is required.');
                const parsedTargets = Array.isArray(targets) ? targets : JSON.parse(targets);
                const res = await fetch(`${FONNTE_BASE}/send`, {
                    method: 'POST', headers,
                    body: JSON.stringify({ target: parsedTargets.join(','), message }),
                });
                const data = await res.json();
                if (!data.status) throw new Error(data.reason || 'Fonnte sendBulk failed.');
                return { output: { status: String(data.status), process: data.process ?? '' } };
            }

            case 'getDevices': {
                const res = await fetch(`${FONNTE_BASE}/get-device`, { method: 'POST', headers, body: JSON.stringify({}) });
                const data = await res.json();
                if (!data.status) throw new Error(data.reason || 'Fonnte getDevices failed.');
                return { output: { devices: data.data ?? [], total: String(Array.isArray(data.data) ? data.data.length : 0) } };
            }

            case 'getDevice': {
                const deviceId = String(inputs.deviceId ?? '').trim();
                if (!deviceId) throw new Error('deviceId is required.');
                const res = await fetch(`${FONNTE_BASE}/get-device`, { method: 'POST', headers, body: JSON.stringify({ device: deviceId }) });
                const data = await res.json();
                if (!data.status) throw new Error(data.reason || 'Fonnte getDevice failed.');
                return { output: { device: data.data ?? {} } };
            }

            case 'getBalance': {
                const res = await fetch(`${FONNTE_BASE}/get-balance`, { method: 'POST', headers, body: JSON.stringify({}) });
                const data = await res.json();
                if (!data.status) throw new Error(data.reason || 'Fonnte getBalance failed.');
                return { output: { balance: String(data.balance ?? 0), currency: data.currency ?? '' } };
            }

            case 'getContacts': {
                const deviceId = String(inputs.deviceId ?? '').trim();
                if (!deviceId) throw new Error('deviceId is required.');
                const body: Record<string, any> = { device: deviceId };
                if (inputs.page) body.page = inputs.page;
                const res = await fetch(`${FONNTE_BASE}/get-contact`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!data.status) throw new Error(data.reason || 'Fonnte getContacts failed.');
                return { output: { contacts: data.data ?? [], total: String(data.total ?? 0) } };
            }

            default:
                return { error: `Fonnte action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Fonnte action failed.' };
    }
}
