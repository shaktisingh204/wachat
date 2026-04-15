
'use server';

function twilioEnhancedAuth(accountSid: string, authToken: string): string {
    return 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
}

async function twilioEnhancedPost(url: string, auth: string, params: Record<string, string>, logger: any): Promise<any> {
    logger?.log(`[TwilioEnhanced] POST ${url}`);
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: auth,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(params).toString(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || `Twilio API error: ${res.status}`);
    return data;
}

async function twilioEnhancedPostJson(url: string, auth: string, body: any, logger: any): Promise<any> {
    logger?.log(`[TwilioEnhanced] POST JSON ${url}`);
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: auth,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || `Twilio API error: ${res.status}`);
    return data;
}

async function twilioEnhancedGet(url: string, auth: string, logger: any): Promise<any> {
    logger?.log(`[TwilioEnhanced] GET ${url}`);
    const res = await fetch(url, {
        headers: { Authorization: auth },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || `Twilio API error: ${res.status}`);
    return data;
}

export async function executeTwilioEnhancedAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const accountSid = String(inputs.accountSid ?? '').trim();
        const authToken = String(inputs.authToken ?? '').trim();
        if (!accountSid || !authToken) throw new Error('accountSid and authToken are required.');

        const auth = twilioEnhancedAuth(accountSid, authToken);
        const baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}`;

        switch (actionName) {
            case 'sendWhatsApp': {
                const to = String(inputs.to ?? '').trim();
                const from = String(inputs.from ?? '').trim();
                const body = String(inputs.body ?? '').trim();
                if (!to || !from || !body) throw new Error('to, from, and body are required.');
                const whatsappTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
                const whatsappFrom = from.startsWith('whatsapp:') ? from : `whatsapp:${from}`;
                const data = await twilioEnhancedPost(`${baseUrl}/Messages.json`, auth, { To: whatsappTo, From: whatsappFrom, Body: body }, logger);
                return { output: { sid: data.sid, status: data.status, to: data.to } };
            }

            case 'createConversation': {
                const friendlyName = String(inputs.friendlyName ?? '').trim();
                const params: Record<string, string> = {};
                if (friendlyName) params.FriendlyName = friendlyName;
                const data = await twilioEnhancedPost('https://conversations.twilio.com/v1/Conversations', auth, params, logger);
                return { output: { sid: data.sid, friendlyName: data.friendly_name, state: data.state } };
            }

            case 'addParticipant': {
                const conversationSid = String(inputs.conversationSid ?? '').trim();
                const identity = String(inputs.identity ?? '').trim();
                if (!conversationSid) throw new Error('conversationSid is required.');
                const params: Record<string, string> = {};
                if (identity) params.Identity = identity;
                const messagingBinding = inputs.messagingBindingAddress ? String(inputs.messagingBindingAddress).trim() : '';
                if (messagingBinding) {
                    params['MessagingBinding.Address'] = messagingBinding;
                    const proxyAddress = String(inputs.messagingBindingProxyAddress ?? '').trim();
                    if (proxyAddress) params['MessagingBinding.ProxyAddress'] = proxyAddress;
                }
                const data = await twilioEnhancedPost(`https://conversations.twilio.com/v1/Conversations/${conversationSid}/Participants`, auth, params, logger);
                return { output: { sid: data.sid, identity: data.identity, conversationSid: data.conversation_sid } };
            }

            case 'sendConversationMessage': {
                const conversationSid = String(inputs.conversationSid ?? '').trim();
                const body = String(inputs.body ?? '').trim();
                if (!conversationSid || !body) throw new Error('conversationSid and body are required.');
                const params: Record<string, string> = { Body: body };
                const author = String(inputs.author ?? '').trim();
                if (author) params.Author = author;
                const data = await twilioEnhancedPost(`https://conversations.twilio.com/v1/Conversations/${conversationSid}/Messages`, auth, params, logger);
                return { output: { sid: data.sid, body: data.body, author: data.author } };
            }

            case 'listConversations': {
                const data = await twilioEnhancedGet('https://conversations.twilio.com/v1/Conversations', auth, logger);
                return { output: { conversations: data.conversations ?? [], count: data.conversations?.length ?? 0 } };
            }

            case 'getConversation': {
                const conversationSid = String(inputs.conversationSid ?? '').trim();
                if (!conversationSid) throw new Error('conversationSid is required.');
                const data = await twilioEnhancedGet(`https://conversations.twilio.com/v1/Conversations/${conversationSid}`, auth, logger);
                return { output: { conversation: data } };
            }

            case 'createFlow': {
                const friendlyName = String(inputs.friendlyName ?? '').trim();
                const status = String(inputs.status ?? 'draft').trim();
                const definition = inputs.definition ?? {};
                if (!friendlyName) throw new Error('friendlyName is required.');
                const data = await twilioEnhancedPostJson('https://studio.twilio.com/v2/Flows', auth, { friendly_name: friendlyName, status, definition }, logger);
                return { output: { sid: data.sid, friendlyName: data.friendly_name, status: data.status } };
            }

            case 'listFlows': {
                const data = await twilioEnhancedGet('https://studio.twilio.com/v2/Flows', auth, logger);
                return { output: { flows: data.flows ?? [], count: data.flows?.length ?? 0 } };
            }

            case 'createVerifyService': {
                const friendlyName = String(inputs.friendlyName ?? '').trim();
                if (!friendlyName) throw new Error('friendlyName is required.');
                const data = await twilioEnhancedPost('https://verify.twilio.com/v2/Services', auth, { FriendlyName: friendlyName }, logger);
                return { output: { sid: data.sid, friendlyName: data.friendly_name } };
            }

            case 'startVerification': {
                const serviceSid = String(inputs.serviceSid ?? '').trim();
                const to = String(inputs.to ?? '').trim();
                const channel = String(inputs.channel ?? 'sms').trim();
                if (!serviceSid || !to) throw new Error('serviceSid and to are required.');
                const data = await twilioEnhancedPost(`https://verify.twilio.com/v2/Services/${serviceSid}/Verifications`, auth, { To: to, Channel: channel }, logger);
                return { output: { sid: data.sid, to: data.to, status: data.status, channel: data.channel } };
            }

            case 'checkVerification': {
                const serviceSid = String(inputs.serviceSid ?? '').trim();
                const to = String(inputs.to ?? '').trim();
                const code = String(inputs.code ?? '').trim();
                if (!serviceSid || !to || !code) throw new Error('serviceSid, to, and code are required.');
                const data = await twilioEnhancedPost(`https://verify.twilio.com/v2/Services/${serviceSid}/VerificationCheck`, auth, { To: to, Code: code }, logger);
                return { output: { sid: data.sid, to: data.to, status: data.status, valid: data.valid } };
            }

            case 'listVerifyServices': {
                const data = await twilioEnhancedGet('https://verify.twilio.com/v2/Services', auth, logger);
                return { output: { services: data.services ?? [], count: data.services?.length ?? 0 } };
            }

            case 'buyPhoneNumber': {
                const phoneNumber = String(inputs.phoneNumber ?? '').trim();
                if (!phoneNumber) throw new Error('phoneNumber is required.');
                const data = await twilioEnhancedPost(`${baseUrl}/IncomingPhoneNumbers.json`, auth, { PhoneNumber: phoneNumber }, logger);
                return { output: { sid: data.sid, phoneNumber: data.phone_number, friendlyName: data.friendly_name } };
            }

            case 'lookupPhone': {
                const phone = String(inputs.phone ?? '').trim();
                if (!phone) throw new Error('phone is required.');
                const encoded = encodeURIComponent(phone);
                const fields = String(inputs.fields ?? '').trim();
                const url = `https://lookups.twilio.com/v2/PhoneNumbers/${encoded}${fields ? `?Fields=${fields}` : ''}`;
                const data = await twilioEnhancedGet(url, auth, logger);
                return { output: { phoneNumber: data.phone_number, countryCode: data.country_code, valid: data.valid, callerName: data.caller_name } };
            }

            case 'sendFax': {
                const to = String(inputs.to ?? '').trim();
                const from = String(inputs.from ?? '').trim();
                const mediaUrl = String(inputs.mediaUrl ?? '').trim();
                if (!to || !from || !mediaUrl) throw new Error('to, from, and mediaUrl are required.');
                const data = await twilioEnhancedPost('https://fax.twilio.com/v1/Faxes', auth, { To: to, From: from, MediaUrl: mediaUrl }, logger);
                return { output: { sid: data.sid, to: data.to, from: data.from, status: data.status } };
            }

            default:
                return { error: `TwilioEnhanced action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'TwilioEnhanced action failed.' };
    }
}
