'use server';

export async function executeVonageContactCenterAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
) {
    try {
        const base = 'https://api.newvoicemedia.com/v2';

        switch (actionName) {
            case 'getToken': {
                const credentials = Buffer.from(
                    `${inputs.clientId}:${inputs.clientSecret}`
                ).toString('base64');
                const res = await fetch('https://api.newvoicemedia.com/v2/oauth/token', {
                    method: 'POST',
                    headers: {
                        Authorization: `Basic ${credentials}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        grant_type: 'client_credentials',
                    }).toString(),
                });
                const data = await res.json();
                return { output: data };
            }

            case 'listAgents': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', inputs.page);
                if (inputs.pageSize) params.set('pageSize', inputs.pageSize);
                const res = await fetch(`${base}/agents?${params.toString()}`, {
                    headers: {
                        Authorization: `Bearer ${inputs.accessToken}`,
                        Accept: 'application/json',
                    },
                });
                const data = await res.json();
                return { output: data };
            }

            case 'getAgent': {
                const res = await fetch(`${base}/agents/${inputs.agentId}`, {
                    headers: {
                        Authorization: `Bearer ${inputs.accessToken}`,
                        Accept: 'application/json',
                    },
                });
                const data = await res.json();
                return { output: data };
            }

            case 'listQueues': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', inputs.page);
                if (inputs.pageSize) params.set('pageSize', inputs.pageSize);
                const res = await fetch(`${base}/queues?${params.toString()}`, {
                    headers: {
                        Authorization: `Bearer ${inputs.accessToken}`,
                        Accept: 'application/json',
                    },
                });
                const data = await res.json();
                return { output: data };
            }

            case 'getQueue': {
                const res = await fetch(`${base}/queues/${inputs.queueId}`, {
                    headers: {
                        Authorization: `Bearer ${inputs.accessToken}`,
                        Accept: 'application/json',
                    },
                });
                const data = await res.json();
                return { output: data };
            }

            case 'listInteractions': {
                const params = new URLSearchParams();
                if (inputs.from) params.set('from', inputs.from);
                if (inputs.to) params.set('to', inputs.to);
                if (inputs.page) params.set('page', inputs.page);
                if (inputs.pageSize) params.set('pageSize', inputs.pageSize);
                const res = await fetch(`${base}/interactions?${params.toString()}`, {
                    headers: {
                        Authorization: `Bearer ${inputs.accessToken}`,
                        Accept: 'application/json',
                    },
                });
                const data = await res.json();
                return { output: data };
            }

            case 'getInteraction': {
                const res = await fetch(`${base}/interactions/${inputs.interactionId}`, {
                    headers: {
                        Authorization: `Bearer ${inputs.accessToken}`,
                        Accept: 'application/json',
                    },
                });
                const data = await res.json();
                return { output: data };
            }

            case 'listRecordings': {
                const params = new URLSearchParams();
                if (inputs.from) params.set('from', inputs.from);
                if (inputs.to) params.set('to', inputs.to);
                if (inputs.page) params.set('page', inputs.page);
                if (inputs.pageSize) params.set('pageSize', inputs.pageSize);
                const res = await fetch(`${base}/recordings?${params.toString()}`, {
                    headers: {
                        Authorization: `Bearer ${inputs.accessToken}`,
                        Accept: 'application/json',
                    },
                });
                const data = await res.json();
                return { output: data };
            }

            case 'getRecording': {
                const res = await fetch(`${base}/recordings/${inputs.recordingId}`, {
                    headers: {
                        Authorization: `Bearer ${inputs.accessToken}`,
                        Accept: 'application/json',
                    },
                });
                const data = await res.json();
                return { output: data };
            }

            case 'deleteRecording': {
                const res = await fetch(`${base}/recordings/${inputs.recordingId}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${inputs.accessToken}` },
                });
                if (res.status === 204) return { output: { deleted: true } };
                const data = await res.json();
                return { output: data };
            }

            case 'listReports': {
                const params = new URLSearchParams();
                if (inputs.from) params.set('from', inputs.from);
                if (inputs.to) params.set('to', inputs.to);
                if (inputs.reportType) params.set('reportType', inputs.reportType);
                const res = await fetch(`${base}/reports?${params.toString()}`, {
                    headers: {
                        Authorization: `Bearer ${inputs.accessToken}`,
                        Accept: 'application/json',
                    },
                });
                const data = await res.json();
                return { output: data };
            }

            case 'getReport': {
                const res = await fetch(`${base}/reports/${inputs.reportId}`, {
                    headers: {
                        Authorization: `Bearer ${inputs.accessToken}`,
                        Accept: 'application/json',
                    },
                });
                const data = await res.json();
                return { output: data };
            }

            case 'listThresholdAlerts': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', inputs.page);
                if (inputs.pageSize) params.set('pageSize', inputs.pageSize);
                const res = await fetch(`${base}/threshold-alerts?${params.toString()}`, {
                    headers: {
                        Authorization: `Bearer ${inputs.accessToken}`,
                        Accept: 'application/json',
                    },
                });
                const data = await res.json();
                return { output: data };
            }

            case 'listDispositions': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', inputs.page);
                if (inputs.pageSize) params.set('pageSize', inputs.pageSize);
                const res = await fetch(`${base}/dispositions?${params.toString()}`, {
                    headers: {
                        Authorization: `Bearer ${inputs.accessToken}`,
                        Accept: 'application/json',
                    },
                });
                const data = await res.json();
                return { output: data };
            }

            case 'getDisposition': {
                const res = await fetch(`${base}/dispositions/${inputs.dispositionId}`, {
                    headers: {
                        Authorization: `Bearer ${inputs.accessToken}`,
                        Accept: 'application/json',
                    },
                });
                const data = await res.json();
                return { output: data };
            }

            default:
                return { error: `Unknown Vonage Contact Center action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Vonage Contact Center action error: ${err.message}`);
        return { error: err.message || 'Vonage Contact Center action failed' };
    }
}
