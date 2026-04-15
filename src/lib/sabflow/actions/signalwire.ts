'use server';

export async function executeSignalWireAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const { spaceUrl, projectId, apiToken } = inputs;
        if (!spaceUrl) return { error: 'SignalWire: spaceUrl is required.' };
        if (!projectId) return { error: 'SignalWire: projectId is required.' };
        if (!apiToken) return { error: 'SignalWire: apiToken is required.' };

        const basicAuth = `Basic ${Buffer.from(`${projectId}:${apiToken}`).toString('base64')}`;
        const baseUrl = `https://${spaceUrl}.signalwire.com/api/laml/2010-04-01/Accounts/${projectId}`;

        const authHeaders: Record<string, string> = {
            'Authorization': basicAuth,
            'Accept': 'application/json',
        };

        async function apiGet(path: string): Promise<any> {
            const res = await fetch(`${baseUrl}${path}`, { method: 'GET', headers: authHeaders });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.message || data?.title || JSON.stringify(data) || `SignalWire error: ${res.status}`);
            return data;
        }

        async function apiPost(path: string, body: URLSearchParams): Promise<any> {
            const res = await fetch(`${baseUrl}${path}`, {
                method: 'POST',
                headers: { ...authHeaders, 'Content-Type': 'application/x-www-form-urlencoded' },
                body: body.toString(),
            });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.message || data?.title || JSON.stringify(data) || `SignalWire error: ${res.status}`);
            return data;
        }

        async function apiDelete(path: string): Promise<any> {
            const res = await fetch(`${baseUrl}${path}`, { method: 'DELETE', headers: authHeaders });
            if (res.status === 204) return { success: true };
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.message || data?.title || JSON.stringify(data) || `SignalWire error: ${res.status}`);
            return data;
        }

        logger.log(`Executing SignalWire action: ${actionName}`, { inputs });

        switch (actionName) {
            case 'sendSms': {
                const { to, from, body: msgBody } = inputs;
                if (!to) return { error: 'SignalWire sendSms: to is required.' };
                if (!from) return { error: 'SignalWire sendSms: from is required.' };
                if (!msgBody) return { error: 'SignalWire sendSms: body is required.' };
                const params = new URLSearchParams({ To: to, From: from, Body: msgBody });
                const data = await apiPost('/Messages.json', params);
                return { output: { sid: data.sid, status: data.status, to: data.to, from: data.from } };
            }

            case 'sendMms': {
                const { to, from, body: msgBody, mediaUrl } = inputs;
                if (!to) return { error: 'SignalWire sendMms: to is required.' };
                if (!from) return { error: 'SignalWire sendMms: from is required.' };
                if (!mediaUrl) return { error: 'SignalWire sendMms: mediaUrl is required.' };
                const params = new URLSearchParams({ To: to, From: from });
                if (msgBody) params.set('Body', msgBody);
                params.set('MediaUrl', mediaUrl);
                const data = await apiPost('/Messages.json', params);
                return { output: { sid: data.sid, status: data.status, to: data.to } };
            }

            case 'makeCall': {
                const { to, from, url, statusCallback } = inputs;
                if (!to) return { error: 'SignalWire makeCall: to is required.' };
                if (!from) return { error: 'SignalWire makeCall: from is required.' };
                if (!url) return { error: 'SignalWire makeCall: url (TwiML webhook) is required.' };
                const params = new URLSearchParams({ To: to, From: from, Url: url });
                if (statusCallback) params.set('StatusCallback', statusCallback);
                const data = await apiPost('/Calls.json', params);
                return { output: { sid: data.sid, status: data.status, to: data.to, from: data.from } };
            }

            case 'getCall': {
                const { callSid } = inputs;
                if (!callSid) return { error: 'SignalWire getCall: callSid is required.' };
                const data = await apiGet(`/Calls/${callSid}.json`);
                return { output: { sid: data.sid, status: data.status, duration: data.duration, direction: data.direction } };
            }

            case 'listCalls': {
                const { to, from, status, pageSize = 20 } = inputs;
                const params = new URLSearchParams({ PageSize: String(pageSize) });
                if (to) params.set('To', to);
                if (from) params.set('From', from);
                if (status) params.set('Status', status);
                const data = await apiGet(`/Calls.json?${params.toString()}`);
                return { output: { calls: data.calls ?? [], total: data.total } };
            }

            case 'listMessages': {
                const { to, from, pageSize = 20 } = inputs;
                const params = new URLSearchParams({ PageSize: String(pageSize) });
                if (to) params.set('To', to);
                if (from) params.set('From', from);
                const data = await apiGet(`/Messages.json?${params.toString()}`);
                return { output: { messages: data.messages ?? [], total: data.total } };
            }

            case 'getMessage': {
                const { messageSid } = inputs;
                if (!messageSid) return { error: 'SignalWire getMessage: messageSid is required.' };
                const data = await apiGet(`/Messages/${messageSid}.json`);
                return { output: { sid: data.sid, status: data.status, body: data.body, from: data.from, to: data.to } };
            }

            case 'listPhoneNumbers': {
                const { pageSize = 20 } = inputs;
                const data = await apiGet(`/IncomingPhoneNumbers.json?PageSize=${pageSize}`);
                return { output: { phoneNumbers: data.incoming_phone_numbers ?? [], total: data.total } };
            }

            case 'getPhoneNumber': {
                const { phoneNumberSid } = inputs;
                if (!phoneNumberSid) return { error: 'SignalWire getPhoneNumber: phoneNumberSid is required.' };
                const data = await apiGet(`/IncomingPhoneNumbers/${phoneNumberSid}.json`);
                return { output: { phoneNumber: data } };
            }

            case 'buyPhoneNumber': {
                const { phoneNumber } = inputs;
                if (!phoneNumber) return { error: 'SignalWire buyPhoneNumber: phoneNumber is required.' };
                const params = new URLSearchParams({ PhoneNumber: phoneNumber });
                const data = await apiPost('/IncomingPhoneNumbers.json', params);
                return { output: { sid: data.sid, phoneNumber: data.phone_number, status: data.status } };
            }

            case 'releasePhoneNumber': {
                const { phoneNumberSid } = inputs;
                if (!phoneNumberSid) return { error: 'SignalWire releasePhoneNumber: phoneNumberSid is required.' };
                const data = await apiDelete(`/IncomingPhoneNumbers/${phoneNumberSid}.json`);
                return { output: data };
            }

            case 'listConferences': {
                const { status, pageSize = 20 } = inputs;
                const params = new URLSearchParams({ PageSize: String(pageSize) });
                if (status) params.set('Status', status);
                const data = await apiGet(`/Conferences.json?${params.toString()}`);
                return { output: { conferences: data.conferences ?? [], total: data.total } };
            }

            case 'getConference': {
                const { conferenceSid } = inputs;
                if (!conferenceSid) return { error: 'SignalWire getConference: conferenceSid is required.' };
                const data = await apiGet(`/Conferences/${conferenceSid}.json`);
                return { output: { conference: data } };
            }

            case 'listRecordings': {
                const { callSid, pageSize = 20 } = inputs;
                let path = `/Recordings.json?PageSize=${pageSize}`;
                if (callSid) path += `&CallSid=${callSid}`;
                const data = await apiGet(path);
                return { output: { recordings: data.recordings ?? [], total: data.total } };
            }

            default:
                return { error: `SignalWire: Unknown action "${actionName}".` };
        }
    } catch (err: any) {
        logger.log(`SignalWire action error [${actionName}]:`, err?.message ?? err);
        return { error: err?.message ?? 'SignalWire: An unexpected error occurred.' };
    }
}
