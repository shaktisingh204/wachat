'use server';

const WABLAS_BASE = 'https://my.wablas.com/api';

export async function executeWablasAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const token = String(inputs.token ?? '').trim();
        if (!token) throw new Error('token is required.');

        const headers: Record<string, string> = {
            'Authorization': token,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'sendMessage': {
                const phone = String(inputs.phone ?? '').trim();
                const message = String(inputs.message ?? '').trim();
                if (!phone) throw new Error('phone is required.');
                if (!message) throw new Error('message is required.');
                const res = await fetch(`${WABLAS_BASE}/send-message`, {
                    method: 'POST', headers,
                    body: JSON.stringify({ phone, message }),
                });
                const data = await res.json();
                if (!data.status) throw new Error(data.message || 'Wablas sendMessage failed.');
                return { output: { id: String(data.data?.id ?? ''), status: String(data.status) } };
            }

            case 'sendImage': {
                const phone = String(inputs.phone ?? '').trim();
                const image = String(inputs.image ?? '').trim();
                if (!phone) throw new Error('phone is required.');
                if (!image) throw new Error('image URL is required.');
                const body: Record<string, any> = { phone, image };
                if (inputs.caption) body.caption = inputs.caption;
                const res = await fetch(`${WABLAS_BASE}/send-image`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!data.status) throw new Error(data.message || 'Wablas sendImage failed.');
                return { output: { id: String(data.data?.id ?? ''), status: String(data.status) } };
            }

            case 'sendDocument': {
                const phone = String(inputs.phone ?? '').trim();
                const document = String(inputs.document ?? '').trim();
                if (!phone) throw new Error('phone is required.');
                if (!document) throw new Error('document URL is required.');
                const body: Record<string, any> = { phone, document };
                if (inputs.caption) body.caption = inputs.caption;
                const res = await fetch(`${WABLAS_BASE}/send-document`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!data.status) throw new Error(data.message || 'Wablas sendDocument failed.');
                return { output: { id: String(data.data?.id ?? ''), status: String(data.status) } };
            }

            case 'sendVideo': {
                const phone = String(inputs.phone ?? '').trim();
                const video = String(inputs.video ?? '').trim();
                if (!phone) throw new Error('phone is required.');
                if (!video) throw new Error('video URL is required.');
                const body: Record<string, any> = { phone, video };
                if (inputs.caption) body.caption = inputs.caption;
                const res = await fetch(`${WABLAS_BASE}/send-video`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!data.status) throw new Error(data.message || 'Wablas sendVideo failed.');
                return { output: { id: String(data.data?.id ?? ''), status: String(data.status) } };
            }

            case 'sendAudio': {
                const phone = String(inputs.phone ?? '').trim();
                const audio = String(inputs.audio ?? '').trim();
                if (!phone) throw new Error('phone is required.');
                if (!audio) throw new Error('audio URL is required.');
                const res = await fetch(`${WABLAS_BASE}/send-audio`, {
                    method: 'POST', headers,
                    body: JSON.stringify({ phone, audio }),
                });
                const data = await res.json();
                if (!data.status) throw new Error(data.message || 'Wablas sendAudio failed.');
                return { output: { id: String(data.data?.id ?? ''), status: String(data.status) } };
            }

            case 'sendVoice': {
                const phone = String(inputs.phone ?? '').trim();
                const voice = String(inputs.voice ?? '').trim();
                if (!phone) throw new Error('phone is required.');
                if (!voice) throw new Error('voice URL is required.');
                const res = await fetch(`${WABLAS_BASE}/send-voice`, {
                    method: 'POST', headers,
                    body: JSON.stringify({ phone, voice }),
                });
                const data = await res.json();
                if (!data.status) throw new Error(data.message || 'Wablas sendVoice failed.');
                return { output: { id: String(data.data?.id ?? ''), status: String(data.status) } };
            }

            case 'sendFile': {
                const phone = String(inputs.phone ?? '').trim();
                const file = String(inputs.file ?? '').trim();
                if (!phone) throw new Error('phone is required.');
                if (!file) throw new Error('file URL is required.');
                const body: Record<string, any> = { phone, file };
                if (inputs.caption) body.caption = inputs.caption;
                const res = await fetch(`${WABLAS_BASE}/send-file`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!data.status) throw new Error(data.message || 'Wablas sendFile failed.');
                return { output: { id: String(data.data?.id ?? ''), status: String(data.status) } };
            }

            case 'sendLocation': {
                const phone = String(inputs.phone ?? '').trim();
                const latitude = String(inputs.latitude ?? '').trim();
                const longitude = String(inputs.longitude ?? '').trim();
                if (!phone) throw new Error('phone is required.');
                if (!latitude || !longitude) throw new Error('latitude and longitude are required.');
                const body: Record<string, any> = { phone, latitude, longitude };
                if (inputs.address) body.address = inputs.address;
                const res = await fetch(`${WABLAS_BASE}/send-location`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!data.status) throw new Error(data.message || 'Wablas sendLocation failed.');
                return { output: { id: String(data.data?.id ?? ''), status: String(data.status) } };
            }

            case 'sendContact': {
                const phone = String(inputs.phone ?? '').trim();
                const contactPhone = String(inputs.contactPhone ?? '').trim();
                const contactName = String(inputs.contactName ?? '').trim();
                if (!phone) throw new Error('phone is required.');
                if (!contactPhone || !contactName) throw new Error('contactPhone and contactName are required.');
                const res = await fetch(`${WABLAS_BASE}/send-contact`, {
                    method: 'POST', headers,
                    body: JSON.stringify({ phone, contact_phone: contactPhone, contact_name: contactName }),
                });
                const data = await res.json();
                if (!data.status) throw new Error(data.message || 'Wablas sendContact failed.');
                return { output: { id: String(data.data?.id ?? ''), status: String(data.status) } };
            }

            case 'sendButtons': {
                const phone = String(inputs.phone ?? '').trim();
                const message = String(inputs.message ?? '').trim();
                const buttons = inputs.buttons;
                if (!phone) throw new Error('phone is required.');
                if (!message) throw new Error('message is required.');
                if (!buttons) throw new Error('buttons are required.');
                const parsedButtons = Array.isArray(buttons) ? buttons : JSON.parse(buttons);
                const res = await fetch(`${WABLAS_BASE}/send-button`, {
                    method: 'POST', headers,
                    body: JSON.stringify({ phone, message, buttons: parsedButtons }),
                });
                const data = await res.json();
                if (!data.status) throw new Error(data.message || 'Wablas sendButtons failed.');
                return { output: { id: String(data.data?.id ?? ''), status: String(data.status) } };
            }

            case 'sendList': {
                const phone = String(inputs.phone ?? '').trim();
                const message = String(inputs.message ?? '').trim();
                const sections = inputs.sections;
                if (!phone) throw new Error('phone is required.');
                if (!message) throw new Error('message is required.');
                if (!sections) throw new Error('sections are required.');
                const parsedSections = Array.isArray(sections) ? sections : JSON.parse(sections);
                const body: Record<string, any> = { phone, message, sections: parsedSections };
                if (inputs.buttonText) body.button_text = inputs.buttonText;
                const res = await fetch(`${WABLAS_BASE}/send-list`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!data.status) throw new Error(data.message || 'Wablas sendList failed.');
                return { output: { id: String(data.data?.id ?? ''), status: String(data.status) } };
            }

            case 'sendTemplate': {
                const phone = String(inputs.phone ?? '').trim();
                const templateName = String(inputs.templateName ?? '').trim();
                if (!phone) throw new Error('phone is required.');
                if (!templateName) throw new Error('templateName is required.');
                const body: Record<string, any> = { phone, template_name: templateName };
                if (inputs.variables) {
                    body.variables = Array.isArray(inputs.variables) ? inputs.variables : JSON.parse(inputs.variables);
                }
                const res = await fetch(`${WABLAS_BASE}/send-template`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!data.status) throw new Error(data.message || 'Wablas sendTemplate failed.');
                return { output: { id: String(data.data?.id ?? ''), status: String(data.status) } };
            }

            case 'getDevices': {
                const res = await fetch(`${WABLAS_BASE}/device`, { method: 'GET', headers });
                const data = await res.json();
                if (!data.status) throw new Error(data.message || 'Wablas getDevices failed.');
                return { output: { devices: data.data ?? [], total: String(Array.isArray(data.data) ? data.data.length : 0) } };
            }

            case 'checkDevice': {
                const deviceId = String(inputs.deviceId ?? '').trim();
                if (!deviceId) throw new Error('deviceId is required.');
                const res = await fetch(`${WABLAS_BASE}/device/${deviceId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!data.status) throw new Error(data.message || 'Wablas checkDevice failed.');
                return { output: { device: data.data ?? {}, status: String(data.status) } };
            }

            case 'getContacts': {
                const deviceId = String(inputs.deviceId ?? '').trim();
                if (!deviceId) throw new Error('deviceId is required.');
                const url = new URL(`${WABLAS_BASE}/contact`);
                url.searchParams.set('device', deviceId);
                if (inputs.page) url.searchParams.set('page', String(inputs.page));
                const res = await fetch(url.toString(), { method: 'GET', headers });
                const data = await res.json();
                if (!data.status) throw new Error(data.message || 'Wablas getContacts failed.');
                return { output: { contacts: data.data ?? [], total: String(data.total ?? 0) } };
            }

            default:
                return { error: `Wablas action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Wablas action failed.' };
    }
}
