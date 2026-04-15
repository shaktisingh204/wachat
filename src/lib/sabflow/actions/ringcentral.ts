'use server';

export async function executeRingcentralAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
) {
    try {
        const base = 'https://platform.ringcentral.com/restapi/v1.0';

        switch (actionName) {
            case 'getToken': {
                const credentials = Buffer.from(
                    `${inputs.clientId}:${inputs.clientSecret}`
                ).toString('base64');
                const res = await fetch('https://platform.ringcentral.com/restapi/oauth/token', {
                    method: 'POST',
                    headers: {
                        Authorization: `Basic ${credentials}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        grant_type: inputs.grantType || 'password',
                        username: inputs.username || '',
                        password: inputs.password || '',
                        extension: inputs.extension || '',
                    }).toString(),
                });
                const data = await res.json();
                return { output: data };
            }

            case 'sendSMS': {
                const accountId = inputs.accountId || '~';
                const extensionId = inputs.extensionId || '~';
                const res = await fetch(
                    `${base}/account/${accountId}/extension/${extensionId}/sms`,
                    {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${inputs.accessToken}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            from: { phoneNumber: inputs.from },
                            to: [{ phoneNumber: inputs.to }],
                            text: inputs.text,
                        }),
                    }
                );
                const data = await res.json();
                return { output: data };
            }

            case 'sendFax': {
                const accountId = inputs.accountId || '~';
                const extensionId = inputs.extensionId || '~';
                const res = await fetch(
                    `${base}/account/${accountId}/extension/${extensionId}/fax`,
                    {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${inputs.accessToken}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            to: [{ phoneNumber: inputs.to }],
                            faxResolution: inputs.faxResolution || 'High',
                            attachments: inputs.attachments || [],
                        }),
                    }
                );
                const data = await res.json();
                return { output: data };
            }

            case 'makeCall': {
                const accountId = inputs.accountId || '~';
                const extensionId = inputs.extensionId || '~';
                const res = await fetch(
                    `${base}/account/${accountId}/extension/${extensionId}/ring-out`,
                    {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${inputs.accessToken}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            from: { phoneNumber: inputs.from },
                            to: { phoneNumber: inputs.to },
                            playPrompt: inputs.playPrompt !== undefined ? inputs.playPrompt : true,
                        }),
                    }
                );
                const data = await res.json();
                return { output: data };
            }

            case 'getCallLog': {
                const accountId = inputs.accountId || '~';
                const extensionId = inputs.extensionId || '~';
                const params = new URLSearchParams();
                if (inputs.dateFrom) params.set('dateFrom', inputs.dateFrom);
                if (inputs.dateTo) params.set('dateTo', inputs.dateTo);
                if (inputs.type) params.set('type', inputs.type);
                const res = await fetch(
                    `${base}/account/${accountId}/extension/${extensionId}/call-log?${params.toString()}`,
                    { headers: { Authorization: `Bearer ${inputs.accessToken}` } }
                );
                const data = await res.json();
                return { output: data };
            }

            case 'listMessages': {
                const accountId = inputs.accountId || '~';
                const extensionId = inputs.extensionId || '~';
                const params = new URLSearchParams();
                if (inputs.messageType) params.set('messageType', inputs.messageType);
                if (inputs.readStatus) params.set('readStatus', inputs.readStatus);
                const res = await fetch(
                    `${base}/account/${accountId}/extension/${extensionId}/message-store?${params.toString()}`,
                    { headers: { Authorization: `Bearer ${inputs.accessToken}` } }
                );
                const data = await res.json();
                return { output: data };
            }

            case 'getMessage': {
                const accountId = inputs.accountId || '~';
                const extensionId = inputs.extensionId || '~';
                const res = await fetch(
                    `${base}/account/${accountId}/extension/${extensionId}/message-store/${inputs.messageId}`,
                    { headers: { Authorization: `Bearer ${inputs.accessToken}` } }
                );
                const data = await res.json();
                return { output: data };
            }

            case 'deleteMessage': {
                const accountId = inputs.accountId || '~';
                const extensionId = inputs.extensionId || '~';
                const res = await fetch(
                    `${base}/account/${accountId}/extension/${extensionId}/message-store/${inputs.messageId}`,
                    {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${inputs.accessToken}` },
                    }
                );
                if (res.status === 204) return { output: { deleted: true } };
                const data = await res.json();
                return { output: data };
            }

            case 'listExtensions': {
                const accountId = inputs.accountId || '~';
                const params = new URLSearchParams();
                if (inputs.type) params.set('type', inputs.type);
                if (inputs.status) params.set('status', inputs.status);
                const res = await fetch(
                    `${base}/account/${accountId}/extension?${params.toString()}`,
                    { headers: { Authorization: `Bearer ${inputs.accessToken}` } }
                );
                const data = await res.json();
                return { output: data };
            }

            case 'getExtension': {
                const accountId = inputs.accountId || '~';
                const res = await fetch(
                    `${base}/account/${accountId}/extension/${inputs.extensionId}`,
                    { headers: { Authorization: `Bearer ${inputs.accessToken}` } }
                );
                const data = await res.json();
                return { output: data };
            }

            case 'listPhoneNumbers': {
                const accountId = inputs.accountId || '~';
                const params = new URLSearchParams();
                if (inputs.usageType) params.set('usageType', inputs.usageType);
                const res = await fetch(
                    `${base}/account/${accountId}/phone-number?${params.toString()}`,
                    { headers: { Authorization: `Bearer ${inputs.accessToken}` } }
                );
                const data = await res.json();
                return { output: data };
            }

            case 'getPhoneNumber': {
                const accountId = inputs.accountId || '~';
                const res = await fetch(
                    `${base}/account/${accountId}/phone-number/${inputs.phoneNumberId}`,
                    { headers: { Authorization: `Bearer ${inputs.accessToken}` } }
                );
                const data = await res.json();
                return { output: data };
            }

            case 'listMeetings': {
                const extensionId = inputs.extensionId || '~';
                const res = await fetch(
                    `${base}/account/~/extension/${extensionId}/meeting`,
                    { headers: { Authorization: `Bearer ${inputs.accessToken}` } }
                );
                const data = await res.json();
                return { output: data };
            }

            case 'createMeeting': {
                const extensionId = inputs.extensionId || '~';
                const res = await fetch(
                    `${base}/account/~/extension/${extensionId}/meeting`,
                    {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${inputs.accessToken}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            topic: inputs.topic,
                            meetingType: inputs.meetingType || 'Scheduled',
                            schedule: inputs.schedule || {},
                            password: inputs.password || '',
                        }),
                    }
                );
                const data = await res.json();
                return { output: data };
            }

            case 'deleteMeeting': {
                const extensionId = inputs.extensionId || '~';
                const res = await fetch(
                    `${base}/account/~/extension/${extensionId}/meeting/${inputs.meetingId}`,
                    {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${inputs.accessToken}` },
                    }
                );
                if (res.status === 204) return { output: { deleted: true } };
                const data = await res.json();
                return { output: data };
            }

            default:
                return { error: `Unknown RingCentral action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`RingCentral action error: ${err.message}`);
        return { error: err.message || 'RingCentral action failed' };
    }
}
