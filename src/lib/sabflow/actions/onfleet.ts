
'use server';

const ONFLEET_BASE = 'https://onfleet.com/api/v2';

async function onfleetRequest(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    apiKey: string,
    body?: any,
    queryParams?: Record<string, string | number | undefined>
): Promise<any> {
    let url = `${ONFLEET_BASE}${path}`;

    if (queryParams) {
        const filtered = Object.entries(queryParams).filter(
            ([, v]) => v !== undefined && v !== null && v !== ''
        );
        if (filtered.length > 0) {
            url += '?' + filtered.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
        }
    }

    const basicAuth = Buffer.from(`${apiKey}:`).toString('base64');

    const res = await fetch(url, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${basicAuth}`,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
        let errMsg = `Onfleet API error ${res.status}`;
        try {
            const errBody = await res.json();
            errMsg = errBody.message?.message || errBody.message || JSON.stringify(errBody) || errMsg;
        } catch {
            errMsg = (await res.text()) || errMsg;
        }
        throw new Error(errMsg);
    }

    if (res.status === 204) return {};
    return res.json();
}

export async function executeOnfleetAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        switch (actionName) {
            case 'createTask': {
                const destination = String(inputs.destination ?? '').trim();
                if (!destination) throw new Error('destination is required.');
                const rawRecipients = inputs.recipients;
                const recipientList = Array.isArray(rawRecipients) ? rawRecipients : [];
                const body: Record<string, any> = {
                    destination: { address: { unparsed: destination } },
                    recipients: recipientList.map((r: any) => ({ name: r.name, phone: r.phone })),
                    isPickupTask: inputs.pickupTask ?? false,
                    quantity: inputs.quantity ?? 0,
                };
                if (inputs.completeAfter !== undefined) body.completeAfter = inputs.completeAfter;
                if (inputs.completeBefore !== undefined) body.completeBefore = inputs.completeBefore;
                if (inputs.notes) body.notes = String(inputs.notes);
                const data = await onfleetRequest('POST', '/tasks', apiKey, body);
                logger.log(`[Onfleet] Created task ${data.id}`);
                return {
                    output: {
                        id: data.id,
                        shortId: data.shortId,
                        state: data.state,
                        destination: data.destination,
                        worker: data.worker,
                    },
                };
            }

            case 'getTask': {
                const taskId = String(inputs.taskId ?? '').trim();
                if (!taskId) throw new Error('taskId is required.');
                const data = await onfleetRequest('GET', `/tasks/${taskId}`, apiKey);
                return {
                    output: {
                        id: data.id,
                        shortId: data.shortId,
                        state: data.state,
                        destination: data.destination,
                        worker: data.worker,
                        trackingUrl: data.trackingURL,
                        recipients: data.recipients ?? [],
                    },
                };
            }

            case 'updateTask': {
                const taskId = String(inputs.taskId ?? '').trim();
                if (!taskId) throw new Error('taskId is required.');
                if (!inputs.data || typeof inputs.data !== 'object') throw new Error('data (object) is required.');
                const data = await onfleetRequest('PUT', `/tasks/${taskId}`, apiKey, inputs.data);
                return { output: { id: data.id, state: data.state } };
            }

            case 'deleteTask': {
                const taskId = String(inputs.taskId ?? '').trim();
                if (!taskId) throw new Error('taskId is required.');
                await onfleetRequest('DELETE', `/tasks/${taskId}`, apiKey);
                logger.log(`[Onfleet] Deleted task ${taskId}`);
                return { output: { deleted: true } };
            }

            case 'listTasks': {
                const params: Record<string, string | number | undefined> = {
                    from: inputs.from ?? Date.now() - 86400000,
                    to: inputs.to ?? Date.now(),
                    limit: inputs.limit ?? 64,
                };
                if (inputs.state !== undefined && inputs.state !== '') params.state = String(inputs.state);
                const data = await onfleetRequest('GET', '/tasks/all', apiKey, undefined, params);
                return { output: { tasks: data.tasks ?? data ?? [], lastId: data.lastId } };
            }

            case 'listWorkers': {
                const params: Record<string, string | number | undefined> = {};
                if (inputs.filter) params.filter = String(inputs.filter);
                if (inputs.teams) params.teams = String(inputs.teams);
                if (inputs.states) params.states = String(inputs.states);
                const data = await onfleetRequest('GET', '/workers', apiKey, undefined, params);
                const workers = (Array.isArray(data) ? data : []).map((w: any) => ({
                    id: w.id,
                    name: w.name,
                    phone: w.phone,
                    status: w.onDuty,
                    vehicle: w.vehicle,
                }));
                return { output: { workers } };
            }

            case 'getWorker': {
                const workerId = String(inputs.workerId ?? '').trim();
                if (!workerId) throw new Error('workerId is required.');
                const data = await onfleetRequest('GET', `/workers/${workerId}`, apiKey);
                return {
                    output: {
                        id: data.id,
                        name: data.name,
                        phone: data.phone,
                        status: data.onDuty,
                        location: data.location,
                        vehicle: data.vehicle,
                    },
                };
            }

            case 'createWorker': {
                const name = String(inputs.name ?? '').trim();
                const phone = String(inputs.phone ?? '').trim();
                const teams = inputs.teams;
                if (!name) throw new Error('name is required.');
                if (!phone) throw new Error('phone is required.');
                if (!teams) throw new Error('teams is required.');
                const body: Record<string, any> = {
                    name,
                    phone,
                    teams: Array.isArray(teams) ? teams : [teams],
                    vehicle: inputs.vehicle ?? { type: 'CAR' },
                    capacity: inputs.capacity ?? 0,
                };
                const data = await onfleetRequest('POST', '/workers', apiKey, body);
                logger.log(`[Onfleet] Created worker ${data.id}`);
                return { output: { id: data.id, name: data.name } };
            }

            case 'listTeams': {
                const data = await onfleetRequest('GET', '/teams', apiKey);
                const teams = (Array.isArray(data) ? data : []).map((t: any) => ({
                    id: t.id,
                    name: t.name,
                    workerIds: t.workers ?? [],
                }));
                return { output: { teams } };
            }

            case 'getTeam': {
                const teamId = String(inputs.teamId ?? '').trim();
                if (!teamId) throw new Error('teamId is required.');
                const data = await onfleetRequest('GET', `/teams/${teamId}`, apiKey);
                return {
                    output: {
                        id: data.id,
                        name: data.name,
                        workerIds: data.workers ?? [],
                        hubId: data.hub,
                    },
                };
            }

            case 'createRecipient': {
                const name = String(inputs.name ?? '').trim();
                const phone = String(inputs.phone ?? '').trim();
                if (!name) throw new Error('name is required.');
                if (!phone) throw new Error('phone is required.');
                const body: Record<string, any> = {
                    name,
                    phone,
                    skipPhoneNumberValidation: inputs.skipPhoneNumberValidation ?? false,
                };
                if (inputs.notes) body.notes = String(inputs.notes);
                const data = await onfleetRequest('POST', '/recipients', apiKey, body);
                logger.log(`[Onfleet] Created recipient ${data.id}`);
                return { output: { id: data.id, name: data.name, phone: data.phone } };
            }

            case 'createDestination': {
                const address = String(inputs.address ?? '').trim();
                if (!address) throw new Error('address is required.');
                const body: Record<string, any> = {
                    address: { unparsed: address },
                };
                if (inputs.notes) body.notes = String(inputs.notes);
                const data = await onfleetRequest('POST', '/destinations', apiKey, body);
                logger.log(`[Onfleet] Created destination ${data.id}`);
                return {
                    output: {
                        id: data.id,
                        address: data.address,
                        location: data.location,
                    },
                };
            }

            case 'autoAssignTasks': {
                const taskIds = inputs.taskIds;
                if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
                    throw new Error('taskIds (array) is required.');
                }
                const body = {
                    tasks: taskIds,
                    considerDependencies: inputs.considerDependencies ?? true,
                };
                const data = await onfleetRequest('POST', '/tasks/autoAssign', apiKey, body);
                return {
                    output: {
                        assignedTasksCount: data.assignedTasksCount,
                        tasks: data.tasks ?? {},
                    },
                };
            }

            case 'getTrackingUrl': {
                const shortId = String(inputs.shortId ?? '').trim();
                if (!shortId) throw new Error('shortId is required.');
                const data = await onfleetRequest('GET', `/tasks/shortId/${shortId}`, apiKey);
                return {
                    output: {
                        trackingUrl: data.trackingURL,
                        state: data.state,
                        eta: data.eta,
                    },
                };
            }

            default:
                return { error: `Onfleet action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        logger.log(`[Onfleet] Error in action "${actionName}": ${e.message}`);
        return { error: e.message || 'Onfleet action failed.' };
    }
}
