
'use server';

const TWILIO_BASE = 'https://api.twilio.com/2010-04-01';

async function twilioPost(accountSid: string, authToken: string, path: string, params: Record<string, string>, logger: any) {
    logger.log(`[Twilio] POST ${path}`);
    const res = await fetch(`${TWILIO_BASE}${path}`, {
        method: 'POST',
        headers: {
            Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(params).toString(),
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || `Twilio API error: ${res.status}`);
    }
    return data;
}

async function twilioGet(accountSid: string, authToken: string, path: string, logger: any) {
    logger.log(`[Twilio] GET ${path}`);
    const res = await fetch(`${TWILIO_BASE}${path}.json`, {
        headers: {
            Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        },
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || `Twilio API error: ${res.status}`);
    }
    return data;
}

export async function executeTwilioAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accountSid = String(inputs.accountSid ?? '').trim();
        const authToken = String(inputs.authToken ?? '').trim();
        if (!accountSid || !authToken) throw new Error('accountSid and authToken are required.');

        switch (actionName) {
            case 'sendSms': {
                const to = String(inputs.to ?? '').trim();
                const from = String(inputs.from ?? '').trim();
                const body = String(inputs.body ?? '').trim();
                if (!to || !from || !body) throw new Error('to, from, and body are required.');
                const data = await twilioPost(accountSid, authToken, `/Accounts/${accountSid}/Messages.json`, { To: to, From: from, Body: body }, logger);
                logger.log(`[Twilio] SMS sent. SID: ${data.sid}`);
                return { output: { sid: data.sid, status: data.status, to: data.to, from: data.from } };
            }

            case 'sendWhatsapp': {
                const to = String(inputs.to ?? '').trim();
                const from = String(inputs.from ?? '').trim();
                const body = String(inputs.body ?? '').trim();
                if (!to || !from || !body) throw new Error('to, from, and body are required.');
                const whatsappTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
                const whatsappFrom = from.startsWith('whatsapp:') ? from : `whatsapp:${from}`;
                const data = await twilioPost(accountSid, authToken, `/Accounts/${accountSid}/Messages.json`, { To: whatsappTo, From: whatsappFrom, Body: body }, logger);
                return { output: { sid: data.sid, status: data.status } };
            }

            case 'makeCall': {
                const to = String(inputs.to ?? '').trim();
                const from = String(inputs.from ?? '').trim();
                const url = String(inputs.url ?? '').trim();
                if (!to || !from || !url) throw new Error('to, from, and url are required.');
                const data = await twilioPost(accountSid, authToken, `/Accounts/${accountSid}/Calls.json`, { To: to, From: from, Url: url }, logger);
                return { output: { sid: data.sid, status: data.status } };
            }

            case 'getMessage': {
                const messageSid = String(inputs.messageSid ?? '').trim();
                if (!messageSid) throw new Error('messageSid is required.');
                const data = await twilioGet(accountSid, authToken, `/Accounts/${accountSid}/Messages/${messageSid}`, logger);
                return { output: { sid: data.sid, body: data.body, status: data.status, to: data.to, from: data.from } };
            }

            case 'listMessages': {
                const limit = Number(inputs.limit ?? 20);
                const res = await fetch(`${TWILIO_BASE}/Accounts/${accountSid}/Messages.json?PageSize=${limit}`, {
                    headers: { Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64') },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || 'Failed to list messages');
                return { output: { messages: data.messages ?? [], count: data.messages?.length ?? 0 } };
            }

            case 'lookupNumber': {
                const phoneNumber = String(inputs.phoneNumber ?? '').trim();
                if (!phoneNumber) throw new Error('phoneNumber is required.');
                const encoded = encodeURIComponent(phoneNumber);
                const res = await fetch(`https://lookups.twilio.com/v1/PhoneNumbers/${encoded}`, {
                    headers: { Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64') },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || 'Lookup failed');
                return { output: { phoneNumber: data.phone_number, countryCode: data.country_code, nationalFormat: data.national_format } };
            }

            default:
                return { error: `Twilio action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Twilio action failed.' };
    }
}
