'use server';

export async function executeSinchAction(actionName: string, inputs: any, user: any, logger: any) {
    const { servicePlanId, apiToken } = inputs;
    const base64Auth = Buffer.from(`${servicePlanId}:${apiToken}`).toString('base64');
    const smsBase = `https://sms.api.sinch.com/xms/v1/${servicePlanId}`;
    const voiceBase = 'https://calling.api.sinch.com/calling/v1';
    const verifyBase = 'https://verification.api.sinch.com/verification/v1';
    const numbersBase = 'https://numbers.api.sinch.com/v1';
    const authHeader = `Basic ${base64Auth}`;

    try {
        switch (actionName) {
            case 'sendSMS': {
                const res = await fetch(`${smsBase}/batches`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: Array.isArray(inputs.to) ? inputs.to : [inputs.to],
                        from: inputs.from,
                        body: inputs.body,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.text || JSON.stringify(data) };
                return { output: data };
            }

            case 'sendBatchSMS': {
                const toList = Array.isArray(inputs.to) ? inputs.to : JSON.parse(inputs.to);
                const res = await fetch(`${smsBase}/batches`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: toList,
                        from: inputs.from,
                        body: inputs.body,
                        send_at: inputs.sendAt || undefined,
                        expire_at: inputs.expireAt || undefined,
                        parameters: inputs.parameters || undefined,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.text || JSON.stringify(data) };
                return { output: data };
            }

            case 'getBatch': {
                const res = await fetch(`${smsBase}/batches/${inputs.batchId}`, {
                    headers: { 'Authorization': authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.text || JSON.stringify(data) };
                return { output: data };
            }

            case 'listBatches': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', inputs.page);
                if (inputs.page_size) params.set('page_size', inputs.page_size);
                if (inputs.from) params.set('from', inputs.from);
                const res = await fetch(`${smsBase}/batches?${params}`, {
                    headers: { 'Authorization': authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.text || JSON.stringify(data) };
                return { output: data };
            }

            case 'cancelBatch': {
                const res = await fetch(`${smsBase}/batches/${inputs.batchId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': authHeader },
                });
                if (res.status === 200 || res.status === 204) return { output: { cancelled: true, batchId: inputs.batchId } };
                const data = await res.json();
                return { error: data.text || JSON.stringify(data) };
            }

            case 'listInboundMessages': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', inputs.page);
                if (inputs.page_size) params.set('page_size', inputs.page_size);
                const res = await fetch(`${smsBase}/inbounds?${params}`, {
                    headers: { 'Authorization': authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.text || JSON.stringify(data) };
                return { output: data };
            }

            case 'getDeliveryReport': {
                const res = await fetch(`${smsBase}/batches/${inputs.batchId}/delivery_report`, {
                    headers: { 'Authorization': authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.text || JSON.stringify(data) };
                return { output: data };
            }

            case 'sendVoiceCall': {
                const appKey = inputs.appKey;
                const appSecret = inputs.appSecret;
                const voiceAuth = `Basic ${Buffer.from(`${appKey}:${appSecret}`).toString('base64')}`;
                const res = await fetch(`${voiceBase}/callouts`, {
                    method: 'POST',
                    headers: { 'Authorization': voiceAuth, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        method: inputs.method || 'ttsCallout',
                        ttsCallout: {
                            cli: inputs.cli,
                            destination: { type: 'number', endpoint: inputs.destination },
                            text: inputs.text,
                            locale: inputs.locale || 'en-US',
                        },
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }

            case 'getCall': {
                const appKey = inputs.appKey;
                const appSecret = inputs.appSecret;
                const voiceAuth = `Basic ${Buffer.from(`${appKey}:${appSecret}`).toString('base64')}`;
                const res = await fetch(`${voiceBase}/calls/${inputs.callId}`, {
                    headers: { 'Authorization': voiceAuth },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }

            case 'manageCall': {
                const appKey = inputs.appKey;
                const appSecret = inputs.appSecret;
                const voiceAuth = `Basic ${Buffer.from(`${appKey}:${appSecret}`).toString('base64')}`;
                const res = await fetch(`${voiceBase}/calls/${inputs.callId}`, {
                    method: 'PATCH',
                    headers: { 'Authorization': voiceAuth, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: { name: inputs.action } }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }

            case 'sendVerification': {
                const appKey = inputs.appKey;
                const appSecret = inputs.appSecret;
                const verifyAuth = `Basic ${Buffer.from(`${appKey}:${appSecret}`).toString('base64')}`;
                const res = await fetch(`${verifyBase}/verifications`, {
                    method: 'POST',
                    headers: { 'Authorization': verifyAuth, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        identity: { type: 'number', endpoint: inputs.phoneNumber },
                        method: inputs.verifyMethod || 'sms',
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }

            case 'checkVerification': {
                const appKey = inputs.appKey;
                const appSecret = inputs.appSecret;
                const verifyAuth = `Basic ${Buffer.from(`${appKey}:${appSecret}`).toString('base64')}`;
                const res = await fetch(`${verifyBase}/verifications/number/${inputs.phoneNumber}`, {
                    method: 'PUT',
                    headers: { 'Authorization': verifyAuth, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ method: inputs.verifyMethod || 'sms', sms: { code: inputs.code } }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }

            case 'listPhoneNumbers': {
                const projectId = inputs.projectId;
                const numbersAuth = `Bearer ${apiToken}`;
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('pageSize', inputs.pageSize);
                if (inputs.pageToken) params.set('pageToken', inputs.pageToken);
                const res = await fetch(`${numbersBase}/projects/${projectId}/activeNumbers?${params}`, {
                    headers: { 'Authorization': numbersAuth },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }

            case 'rentPhoneNumber': {
                const projectId = inputs.projectId;
                const numbersAuth = `Bearer ${apiToken}`;
                const res = await fetch(`${numbersBase}/projects/${projectId}/availableNumbers/${inputs.phoneNumber}:rent`, {
                    method: 'POST',
                    headers: { 'Authorization': numbersAuth, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ smsConfiguration: inputs.smsConfiguration || undefined }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }

            case 'listAvailableNumbers': {
                const projectId = inputs.projectId;
                const numbersAuth = `Bearer ${apiToken}`;
                const params = new URLSearchParams();
                if (inputs.regionCode) params.set('regionCode', inputs.regionCode);
                if (inputs.type) params.set('type', inputs.type);
                if (inputs.pageSize) params.set('pageSize', inputs.pageSize);
                const res = await fetch(`${numbersBase}/projects/${projectId}/availableNumbers?${params}`, {
                    headers: { 'Authorization': numbersAuth },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }

            default:
                return { error: `Unknown Sinch action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Sinch action error: ${err.message}`);
        return { error: err.message };
    }
}
