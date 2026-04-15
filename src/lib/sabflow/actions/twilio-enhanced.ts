'use server';

export async function executeTwilioEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accountSid = String(inputs.accountSid ?? '').trim();
        const authToken = String(inputs.authToken ?? '').trim();
        if (!accountSid || !authToken) throw new Error('accountSid and authToken are required.');

        const baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}`;
        const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');

        const post = async (path: string, params: Record<string, string>) => {
            logger.log(`[TwilioEnhanced] POST ${path}`);
            const res = await fetch(`${baseUrl}${path}`, {
                method: 'POST',
                headers: { Authorization: authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(params).toString(),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || `Twilio error: ${res.status}`);
            return data;
        };

        const get = async (path: string, query?: Record<string, string>) => {
            const url = new URL(`${baseUrl}${path}`);
            if (query) Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
            logger.log(`[TwilioEnhanced] GET ${url.toString()}`);
            const res = await fetch(url.toString(), { headers: { Authorization: authHeader } });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || `Twilio error: ${res.status}`);
            return data;
        };

        const del = async (path: string) => {
            logger.log(`[TwilioEnhanced] DELETE ${path}`);
            const res = await fetch(`${baseUrl}${path}`, { method: 'DELETE', headers: { Authorization: authHeader } });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.message || `Twilio error: ${res.status}`);
            }
            return { deleted: true };
        };

        switch (actionName) {
            case 'sendSms': {
                const to = String(inputs.to ?? '').trim();
                const from = String(inputs.from ?? '').trim();
                const body = String(inputs.body ?? '').trim();
                if (!to || !from || !body) throw new Error('to, from, and body are required.');
                const data = await post('/Messages.json', { To: to, From: from, Body: body });
                return { output: { sid: data.sid, status: data.status, to: data.to, from: data.from } };
            }

            case 'sendMms': {
                const to = String(inputs.to ?? '').trim();
                const from = String(inputs.from ?? '').trim();
                const body = String(inputs.body ?? '').trim();
                const mediaUrl = String(inputs.mediaUrl ?? '').trim();
                if (!to || !from) throw new Error('to and from are required.');
                const params: Record<string, string> = { To: to, From: from };
                if (body) params.Body = body;
                if (mediaUrl) params.MediaUrl = mediaUrl;
                const data = await post('/Messages.json', params);
                return { output: { sid: data.sid, status: data.status, numMedia: data.num_media } };
            }

            case 'sendWhatsApp': {
                const to = String(inputs.to ?? '').trim();
                const from = String(inputs.from ?? '').trim();
                const body = String(inputs.body ?? '').trim();
                if (!to || !from || !body) throw new Error('to, from, and body are required.');
                const whatsappTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
                const whatsappFrom = from.startsWith('whatsapp:') ? from : `whatsapp:${from}`;
                const data = await post('/Messages.json', { To: whatsappTo, From: whatsappFrom, Body: body });
                return { output: { sid: data.sid, status: data.status } };
            }

            case 'makeCall': {
                const to = String(inputs.to ?? '').trim();
                const from = String(inputs.from ?? '').trim();
                const url = String(inputs.url ?? '').trim();
                if (!to || !from || !url) throw new Error('to, from, and url are required.');
                const params: Record<string, string> = { To: to, From: from, Url: url };
                if (inputs.record) params.Record = String(inputs.record);
                const data = await post('/Calls.json', params);
                return { output: { sid: data.sid, status: data.status, to: data.to, from: data.from } };
            }

            case 'listMessages': {
                const pageSize = String(inputs.pageSize ?? inputs.limit ?? 20);
                const query: Record<string, string> = { PageSize: pageSize };
                if (inputs.to) query.To = String(inputs.to);
                if (inputs.from) query.From = String(inputs.from);
                const data = await get('/Messages.json', query);
                return { output: { messages: data.messages ?? [], count: data.messages?.length ?? 0 } };
            }

            case 'getMessage': {
                const messageSid = String(inputs.messageSid ?? '').trim();
                if (!messageSid) throw new Error('messageSid is required.');
                const data = await get(`/Messages/${messageSid}.json`);
                return { output: { sid: data.sid, body: data.body, status: data.status, to: data.to, from: data.from, dateSent: data.date_sent } };
            }

            case 'deleteMessage': {
                const messageSid = String(inputs.messageSid ?? '').trim();
                if (!messageSid) throw new Error('messageSid is required.');
                const result = await del(`/Messages/${messageSid}.json`);
                return { output: result };
            }

            case 'listCalls': {
                const pageSize = String(inputs.pageSize ?? inputs.limit ?? 20);
                const query: Record<string, string> = { PageSize: pageSize };
                if (inputs.to) query.To = String(inputs.to);
                if (inputs.from) query.From = String(inputs.from);
                if (inputs.status) query.Status = String(inputs.status);
                const data = await get('/Calls.json', query);
                return { output: { calls: data.calls ?? [], count: data.calls?.length ?? 0 } };
            }

            case 'getCall': {
                const callSid = String(inputs.callSid ?? '').trim();
                if (!callSid) throw new Error('callSid is required.');
                const data = await get(`/Calls/${callSid}.json`);
                return { output: { sid: data.sid, status: data.status, to: data.to, from: data.from, duration: data.duration } };
            }

            case 'updateCall': {
                const callSid = String(inputs.callSid ?? '').trim();
                if (!callSid) throw new Error('callSid is required.');
                const params: Record<string, string> = {};
                if (inputs.url) params.Url = String(inputs.url);
                if (inputs.status) params.Status = String(inputs.status);
                const data = await post(`/Calls/${callSid}.json`, params);
                return { output: { sid: data.sid, status: data.status } };
            }

            case 'hangupCall': {
                const callSid = String(inputs.callSid ?? '').trim();
                if (!callSid) throw new Error('callSid is required.');
                const data = await post(`/Calls/${callSid}.json`, { Status: 'completed' });
                return { output: { sid: data.sid, status: data.status } };
            }

            case 'createConference': {
                const to = String(inputs.to ?? '').trim();
                const from = String(inputs.from ?? '').trim();
                const conferenceName = String(inputs.conferenceName ?? 'MyConference').trim();
                if (!to || !from) throw new Error('to and from are required.');
                const twiml = `<Response><Dial><Conference>${conferenceName}</Conference></Dial></Response>`;
                const data = await post('/Calls.json', {
                    To: to,
                    From: from,
                    Twiml: twiml,
                });
                return { output: { sid: data.sid, status: data.status, conferenceName } };
            }

            case 'listConferences': {
                const pageSize = String(inputs.pageSize ?? 20);
                const query: Record<string, string> = { PageSize: pageSize };
                if (inputs.friendlyName) query.FriendlyName = String(inputs.friendlyName);
                if (inputs.status) query.Status = String(inputs.status);
                const data = await get('/Conferences.json', query);
                return { output: { conferences: data.conferences ?? [], count: data.conferences?.length ?? 0 } };
            }

            case 'createRecording': {
                const callSid = String(inputs.callSid ?? '').trim();
                if (!callSid) throw new Error('callSid is required.');
                const params: Record<string, string> = {};
                if (inputs.recordingChannels) params.RecordingChannels = String(inputs.recordingChannels);
                const data = await post(`/Calls/${callSid}/Recordings.json`, params);
                return { output: { sid: data.sid, status: data.status, callSid: data.call_sid } };
            }

            case 'listRecordings': {
                const pageSize = String(inputs.pageSize ?? 20);
                const query: Record<string, string> = { PageSize: pageSize };
                if (inputs.callSid) {
                    const data = await get(`/Calls/${inputs.callSid}/Recordings.json`, query);
                    return { output: { recordings: data.recordings ?? [], count: data.recordings?.length ?? 0 } };
                }
                const data = await get('/Recordings.json', query);
                return { output: { recordings: data.recordings ?? [], count: data.recordings?.length ?? 0 } };
            }

            default:
                return { error: `TwilioEnhanced action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'TwilioEnhanced action failed.' };
    }
}
