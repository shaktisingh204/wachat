'use server';

export async function executeEightx8Action(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
) {
    try {
        const base = 'https://api.8x8.com/work/v3';
        const jaasBase = 'https://api.jaas.8x8.vc/v1';
        const apiKey = inputs.apiKey;
        const subAccountId = inputs.subAccountId || '';

        switch (actionName) {
            case 'listUsers': {
                const res = await fetch(`${base}/subaccounts/${subAccountId}/users`, {
                    headers: { Authorization: `Bearer ${apiKey}` },
                });
                const data = await res.json();
                return { output: data };
            }

            case 'getUser': {
                const res = await fetch(
                    `${base}/subaccounts/${subAccountId}/users/${inputs.userId}`,
                    { headers: { Authorization: `Bearer ${apiKey}` } }
                );
                const data = await res.json();
                return { output: data };
            }

            case 'listCallQueues': {
                const res = await fetch(`${base}/subaccounts/${subAccountId}/call-queues`, {
                    headers: { Authorization: `Bearer ${apiKey}` },
                });
                const data = await res.json();
                return { output: data };
            }

            case 'getCallQueue': {
                const res = await fetch(
                    `${base}/subaccounts/${subAccountId}/call-queues/${inputs.queueId}`,
                    { headers: { Authorization: `Bearer ${apiKey}` } }
                );
                const data = await res.json();
                return { output: data };
            }

            case 'listChannels': {
                const res = await fetch(`${base}/subaccounts/${subAccountId}/channels`, {
                    headers: { Authorization: `Bearer ${apiKey}` },
                });
                const data = await res.json();
                return { output: data };
            }

            case 'getChannel': {
                const res = await fetch(
                    `${base}/subaccounts/${subAccountId}/channels/${inputs.channelId}`,
                    { headers: { Authorization: `Bearer ${apiKey}` } }
                );
                const data = await res.json();
                return { output: data };
            }

            case 'sendMessage': {
                const res = await fetch(
                    `${base}/subaccounts/${subAccountId}/channels/${inputs.channelId}/messages`,
                    {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${apiKey}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            text: inputs.text,
                            author: inputs.author,
                            attachments: inputs.attachments || [],
                        }),
                    }
                );
                const data = await res.json();
                return { output: data };
            }

            case 'listMessages': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', inputs.limit);
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                const res = await fetch(
                    `${base}/subaccounts/${subAccountId}/channels/${inputs.channelId}/messages?${params.toString()}`,
                    { headers: { Authorization: `Bearer ${apiKey}` } }
                );
                const data = await res.json();
                return { output: data };
            }

            case 'makeCall': {
                const res = await fetch(`${base}/subaccounts/${subAccountId}/calls`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        to: inputs.to,
                        from: inputs.from,
                        userId: inputs.userId,
                    }),
                });
                const data = await res.json();
                return { output: data };
            }

            case 'listCallRecordings': {
                const params = new URLSearchParams();
                if (inputs.from) params.set('from', inputs.from);
                if (inputs.to) params.set('to', inputs.to);
                const res = await fetch(
                    `${base}/subaccounts/${subAccountId}/recordings?${params.toString()}`,
                    { headers: { Authorization: `Bearer ${apiKey}` } }
                );
                const data = await res.json();
                return { output: data };
            }

            case 'getCallRecording': {
                const res = await fetch(
                    `${base}/subaccounts/${subAccountId}/recordings/${inputs.recordingId}`,
                    { headers: { Authorization: `Bearer ${apiKey}` } }
                );
                const data = await res.json();
                return { output: data };
            }

            case 'deleteCallRecording': {
                const res = await fetch(
                    `${base}/subaccounts/${subAccountId}/recordings/${inputs.recordingId}`,
                    {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${apiKey}` },
                    }
                );
                if (res.status === 204) return { output: { deleted: true } };
                const data = await res.json();
                return { output: data };
            }

            case 'listPhoneNumbers': {
                const res = await fetch(
                    `${base}/subaccounts/${subAccountId}/phone-numbers`,
                    { headers: { Authorization: `Bearer ${apiKey}` } }
                );
                const data = await res.json();
                return { output: data };
            }

            case 'listPresence': {
                const res = await fetch(
                    `${jaasBase}/presence?subAccountId=${subAccountId}`,
                    { headers: { Authorization: `Bearer ${apiKey}` } }
                );
                const data = await res.json();
                return { output: data };
            }

            case 'updatePresence': {
                const res = await fetch(`${jaasBase}/presence`, {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        subAccountId,
                        userId: inputs.userId,
                        status: inputs.status,
                        statusMessage: inputs.statusMessage || '',
                    }),
                });
                const data = await res.json();
                return { output: data };
            }

            default:
                return { error: `Unknown 8x8 action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`8x8 action error: ${err.message}`);
        return { error: err.message || '8x8 action failed' };
    }
}
