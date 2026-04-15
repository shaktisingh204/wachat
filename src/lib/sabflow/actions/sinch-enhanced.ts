'use server';

export async function executeSinchEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        const projectId = String(inputs.projectId ?? '').trim();
        if (!accessToken || !projectId) throw new Error('accessToken and projectId are required.');

        const baseUrl = 'https://us.sms.api.sinch.com';
        const authHeader = `Bearer ${accessToken}`;

        const request = async (method: string, path: string, body?: any) => {
            const url = path.startsWith('http') ? path : `${baseUrl}${path}`;
            logger.log(`[SinchEnhanced] ${method} ${url}`);
            const options: RequestInit = {
                method,
                headers: {
                    Authorization: authHeader,
                    'Content-Type': 'application/json',
                },
            };
            if (body && method !== 'GET') options.body = JSON.stringify(body);
            const res = await fetch(url, options);
            if (res.status === 204) return { success: true };
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || data?.title || `Sinch error: ${res.status}`);
            return data;
        };

        const smsBase = `/xms/v1/${projectId}`;

        switch (actionName) {
            case 'sendSms': {
                const to = inputs.to;
                const from = String(inputs.from ?? '').trim();
                const body = String(inputs.body ?? '').trim();
                if (!to || !body) throw new Error('to and body are required.');
                const toList = Array.isArray(to) ? to : [to];
                const data = await request('POST', `${smsBase}/batches`, {
                    to: toList,
                    from: from || undefined,
                    body,
                    type: 'mt_text',
                });
                return { output: { id: data.id, status: data.status, to: data.to, from: data.from } };
            }

            case 'sendBatch': {
                const batchPayload = inputs.batch;
                if (!batchPayload) throw new Error('batch payload is required.');
                const data = await request('POST', `${smsBase}/batches`, batchPayload);
                return { output: { id: data.id, status: data.status, toCount: data.to?.length ?? 0 } };
            }

            case 'getBatch': {
                const batchId = String(inputs.batchId ?? '').trim();
                if (!batchId) throw new Error('batchId is required.');
                const data = await request('GET', `${smsBase}/batches/${batchId}`);
                return { output: { id: data.id, status: data.status, from: data.from, type: data.type, sentCount: data.sent_count } };
            }

            case 'listBatches': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.pageSize) params.set('page_size', String(inputs.pageSize));
                if (inputs.from) params.set('from', String(inputs.from));
                if (inputs.startDate) params.set('start_date', String(inputs.startDate));
                if (inputs.endDate) params.set('end_date', String(inputs.endDate));
                const data = await request('GET', `${smsBase}/batches?${params.toString()}`);
                return { output: { batches: data.batches ?? [], count: data.count ?? 0, page: data.page } };
            }

            case 'cancelBatch': {
                const batchId = String(inputs.batchId ?? '').trim();
                if (!batchId) throw new Error('batchId is required.');
                const data = await request('DELETE', `${smsBase}/batches/${batchId}`);
                return { output: { batchId, cancelled: true, ...data } };
            }

            case 'sendDeliveryReport': {
                const batchId = String(inputs.batchId ?? '').trim();
                const recipientMsisdn = String(inputs.recipientMsisdn ?? '').trim();
                if (!batchId || !recipientMsisdn) throw new Error('batchId and recipientMsisdn are required.');
                const data = await request('GET', `${smsBase}/batches/${batchId}/delivery_report?recipient_msisdn=${encodeURIComponent(recipientMsisdn)}`);
                return { output: { batchId, statuses: data.statuses ?? [] } };
            }

            case 'listDeliveryReports': {
                const batchId = String(inputs.batchId ?? '').trim();
                if (!batchId) throw new Error('batchId is required.');
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.pageSize) params.set('page_size', String(inputs.pageSize));
                if (inputs.type) params.set('type', String(inputs.type));
                const data = await request('GET', `${smsBase}/batches/${batchId}/delivery_report?${params.toString()}`);
                return { output: { statuses: data.statuses ?? [], totalMessageCount: data.total_message_count } };
            }

            case 'listInboundMessages': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.pageSize) params.set('page_size', String(inputs.pageSize));
                if (inputs.to) params.set('to', String(inputs.to));
                if (inputs.startDate) params.set('start_date', String(inputs.startDate));
                if (inputs.endDate) params.set('end_date', String(inputs.endDate));
                const data = await request('GET', `${smsBase}/inbounds?${params.toString()}`);
                return { output: { inbounds: data.inbounds ?? [], count: data.count ?? 0, page: data.page } };
            }

            case 'getInboundMessage': {
                const inboundId = String(inputs.inboundId ?? '').trim();
                if (!inboundId) throw new Error('inboundId is required.');
                const data = await request('GET', `${smsBase}/inbounds/${inboundId}`);
                return { output: { id: data.id, from: data.from, to: data.to, body: data.body, receivedAt: data.received_at } };
            }

            case 'listGroups': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.pageSize) params.set('page_size', String(inputs.pageSize));
                const data = await request('GET', `${smsBase}/groups?${params.toString()}`);
                return { output: { groups: data.groups ?? [], count: data.count ?? 0 } };
            }

            case 'createGroup': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const data = await request('POST', `${smsBase}/groups`, {
                    name,
                    members: inputs.members ?? [],
                    auto_update: inputs.autoUpdate ?? {},
                });
                return { output: { id: data.id, name: data.name, size: data.size } };
            }

            case 'getGroup': {
                const groupId = String(inputs.groupId ?? '').trim();
                if (!groupId) throw new Error('groupId is required.');
                const data = await request('GET', `${smsBase}/groups/${groupId}`);
                return { output: { id: data.id, name: data.name, size: data.size, createdAt: data.created_at } };
            }

            case 'updateGroup': {
                const groupId = String(inputs.groupId ?? '').trim();
                if (!groupId) throw new Error('groupId is required.');
                const payload: any = {};
                if (inputs.name) payload.name = String(inputs.name);
                if (inputs.addMembers) payload.add = inputs.addMembers;
                if (inputs.removeMembers) payload.remove = inputs.removeMembers;
                const data = await request('POST', `${smsBase}/groups/${groupId}`, payload);
                return { output: { id: data.id, name: data.name, size: data.size } };
            }

            case 'deleteGroup': {
                const groupId = String(inputs.groupId ?? '').trim();
                if (!groupId) throw new Error('groupId is required.');
                await request('DELETE', `${smsBase}/groups/${groupId}`);
                return { output: { groupId, deleted: true } };
            }

            case 'lookupNumber': {
                const endpoint = String(inputs.endpoint ?? '').trim();
                const phoneNumber = String(inputs.phoneNumber ?? '').trim();
                if (!phoneNumber) throw new Error('phoneNumber is required.');
                const lookupUrl = `https://numberverification.api.sinch.com/v1/projects/${projectId}/verifiedNumber/${encodeURIComponent(phoneNumber)}`;
                const data = await request('GET', lookupUrl);
                return { output: { phoneNumber: data.phoneNumber, countryId: data.countryId, numberType: data.numberType, endpoint } };
            }

            default:
                return { error: `SinchEnhanced action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'SinchEnhanced action failed.' };
    }
}
