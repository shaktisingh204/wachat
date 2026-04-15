'use server';

export async function executeExotelAction(actionName: string, inputs: any, user: any, logger: any) {
    const sid = inputs.sid || '';
    const apiKey = inputs.apiKey || '';
    const apiToken = inputs.apiToken || '';
    const baseUrl = `https://api.exotel.com/v1/Accounts/${sid}`;
    const basicAuth = Buffer.from(`${apiKey}:${apiToken}`).toString('base64');
    const headers: Record<string, string> = {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
    };

    const toFormBody = (obj: Record<string, any>) =>
        Object.entries(obj)
            .filter(([, v]) => v !== undefined && v !== null && v !== '')
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
            .join('&');

    try {
        switch (actionName) {
            case 'sendSMS': {
                const res = await fetch(`${baseUrl}/Sms/send.json`, {
                    method: 'POST',
                    headers,
                    body: toFormBody({ From: inputs.from, To: inputs.to, Body: inputs.body }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listSMS': {
                const params = new URLSearchParams();
                if (inputs.PageSize) params.set('PageSize', inputs.PageSize);
                if (inputs.Page) params.set('Page', inputs.Page);
                const res = await fetch(`${baseUrl}/Sms/Messages.json?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getSMS': {
                const res = await fetch(`${baseUrl}/Sms/Messages/${inputs.smsSid}.json`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'makeCall': {
                const res = await fetch(`${baseUrl}/Calls/connect.json`, {
                    method: 'POST',
                    headers,
                    body: toFormBody({ From: inputs.from, To: inputs.to, CallerId: inputs.callerId, Url: inputs.url }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listCalls': {
                const params = new URLSearchParams();
                if (inputs.PageSize) params.set('PageSize', inputs.PageSize);
                if (inputs.Page) params.set('Page', inputs.Page);
                const res = await fetch(`${baseUrl}/Calls.json?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getCall': {
                const res = await fetch(`${baseUrl}/Calls/${inputs.callSid}.json`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'hangUpCall': {
                const res = await fetch(`${baseUrl}/Calls/${inputs.callSid}.json`, {
                    method: 'POST',
                    headers,
                    body: toFormBody({ Status: 'completed' }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listNumbers': {
                const res = await fetch(`${baseUrl}/IncomingPhoneNumbers.json`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getNumber': {
                const res = await fetch(`${baseUrl}/IncomingPhoneNumbers/${inputs.phoneSid}.json`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'makeConferenceCall': {
                const res = await fetch(`${baseUrl}/Calls/connect.json`, {
                    method: 'POST',
                    headers,
                    body: toFormBody({ From: inputs.from, To: inputs.to, CallerId: inputs.callerId, Url: inputs.conferenceUrl }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listConferences': {
                const res = await fetch(`${baseUrl}/Conferences.json`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getConference': {
                const res = await fetch(`${baseUrl}/Conferences/${inputs.conferenceSid}.json`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'sendBulkSMS': {
                const recipients = Array.isArray(inputs.recipients) ? inputs.recipients : [inputs.recipients];
                const results = [];
                for (const to of recipients) {
                    const res = await fetch(`${baseUrl}/Sms/send.json`, {
                        method: 'POST',
                        headers,
                        body: toFormBody({ From: inputs.from, To: to, Body: inputs.body }),
                    });
                    results.push(await res.json());
                }
                return { output: { results } };
            }
            case 'createApplication': {
                const res = await fetch(`${baseUrl}/Applications.json`, {
                    method: 'POST',
                    headers,
                    body: toFormBody({ FriendlyName: inputs.friendlyName, VoiceUrl: inputs.voiceUrl, SmsUrl: inputs.smsUrl }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listApplications': {
                const res = await fetch(`${baseUrl}/Applications.json`, { headers });
                const data = await res.json();
                return { output: data };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Exotel action error: ${err.message}`);
        return { error: err.message };
    }
}
