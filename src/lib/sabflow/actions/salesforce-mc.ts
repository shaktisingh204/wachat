'use server';

async function getMcAccessToken(inputs: any): Promise<{ token: string; restBase: string } | { error: string }> {
    const authUrl = inputs.authUrl || 'https://auth.exacttargetapis.com/v1/requestToken';
    const res = await fetch(authUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: inputs.clientId, clientSecret: inputs.clientSecret }),
    });
    const data = await res.json();
    if (!res.ok || !data.accessToken) return { error: data.message || 'Failed to obtain MC access token' };
    const restBase = data.rest?.dataextension?.endpoint
        ? data.rest.dataextension.endpoint.replace('/dataextension/', '')
        : 'https://www.exacttargetapis.com';
    return { token: data.accessToken, restBase };
}

export async function executeSalesforceMcAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        switch (actionName) {
            case 'getToken': {
                const result = await getMcAccessToken(inputs);
                if ('error' in result) return { error: result.error };
                return { output: { accessToken: result.token, restBase: result.restBase } };
            }

            case 'sendEmail': {
                const auth = await getMcAccessToken(inputs);
                if ('error' in auth) return { error: auth.error };
                const { token, restBase } = auth;
                const res = await fetch(`${restBase}/messaging/v1/messageDefinitionSends/${inputs.definitionKey}/send`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        From: { Address: inputs.fromAddress, Name: inputs.fromName },
                        To: { Address: inputs.toAddress, SubscriberKey: inputs.subscriberKey || inputs.toAddress },
                        Options: { RequestType: 'ASYNC' },
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to send email' };
                return { output: data };
            }

            case 'createDataExtension': {
                const auth = await getMcAccessToken(inputs);
                if ('error' in auth) return { error: auth.error };
                const { token, restBase } = auth;
                const res = await fetch(`${restBase}/data/v1/async/dataextensions`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: inputs.name,
                        customerKey: inputs.customerKey || inputs.name,
                        fields: inputs.fields,
                        isSendable: inputs.isSendable || false,
                        sendableDataExtensionField: inputs.sendableField,
                        sendableSubscriberField: inputs.subscriberField,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create data extension' };
                return { output: data };
            }

            case 'upsertDataExtensionRow': {
                const auth = await getMcAccessToken(inputs);
                if ('error' in auth) return { error: auth.error };
                const { token, restBase } = auth;
                const key = inputs.customerKey || inputs.extensionKey;
                const res = await fetch(`${restBase}/hub/v1/dataevents/key:${key}/rowset`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(Array.isArray(inputs.rows) ? inputs.rows : [{ keys: inputs.keys, values: inputs.values }]),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to upsert data extension row' };
                return { output: data };
            }

            case 'queryDataExtension': {
                const auth = await getMcAccessToken(inputs);
                if ('error' in auth) return { error: auth.error };
                const { token, restBase } = auth;
                const key = inputs.customerKey || inputs.extensionKey;
                const params = new URLSearchParams();
                if (inputs.page) params.set('$page', String(inputs.page));
                if (inputs.pageSize) params.set('$pagesize', String(inputs.pageSize));
                const res = await fetch(`${restBase}/data/v1/customobjectdata/key/${key}/rowset?${params}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to query data extension' };
                return { output: data };
            }

            case 'createJourney': {
                const auth = await getMcAccessToken(inputs);
                if ('error' in auth) return { error: auth.error };
                const { token, restBase } = auth;
                const res = await fetch(`${restBase}/interaction/v1/interactions`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: inputs.name,
                        description: inputs.description,
                        key: inputs.key || inputs.name,
                        workflowApiVersion: inputs.workflowApiVersion || 1,
                        triggers: inputs.triggers || [],
                        goals: inputs.goals || [],
                        activities: inputs.activities || [],
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create journey' };
                return { output: data };
            }

            case 'getJourney': {
                const auth = await getMcAccessToken(inputs);
                if ('error' in auth) return { error: auth.error };
                const { token, restBase } = auth;
                const res = await fetch(`${restBase}/interaction/v1/interactions/${inputs.journeyId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get journey' };
                return { output: data };
            }

            case 'listJourneys': {
                const auth = await getMcAccessToken(inputs);
                if ('error' in auth) return { error: auth.error };
                const { token, restBase } = auth;
                const params = new URLSearchParams();
                if (inputs.page) params.set('$page', String(inputs.page));
                if (inputs.pageSize) params.set('$pagesize', String(inputs.pageSize));
                const res = await fetch(`${restBase}/interaction/v1/interactions?${params}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list journeys' };
                return { output: data };
            }

            case 'createSegment': {
                const auth = await getMcAccessToken(inputs);
                if ('error' in auth) return { error: auth.error };
                const { token, restBase } = auth;
                const res = await fetch(`${restBase}/contacts/v1/segments`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: inputs.name, description: inputs.description }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create segment' };
                return { output: data };
            }

            case 'listSegments': {
                const auth = await getMcAccessToken(inputs);
                if ('error' in auth) return { error: auth.error };
                const { token, restBase } = auth;
                const res = await fetch(`${restBase}/contacts/v1/segments`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list segments' };
                return { output: data };
            }

            case 'sendSMS': {
                const auth = await getMcAccessToken(inputs);
                if ('error' in auth) return { error: auth.error };
                const { token, restBase } = auth;
                const res = await fetch(`${restBase}/sms/v1/messageContact/${inputs.messageApi}/send`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        mobileNumbers: Array.isArray(inputs.mobileNumbers) ? inputs.mobileNumbers : [inputs.mobileNumber],
                        Subscribe: inputs.subscribe !== undefined ? inputs.subscribe : true,
                        Resubscribe: inputs.resubscribe !== undefined ? inputs.resubscribe : true,
                        keyword: inputs.keyword,
                        Override: inputs.override || false,
                        messageText: inputs.messageText,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to send SMS' };
                return { output: data };
            }

            case 'getEmailPerformance': {
                const auth = await getMcAccessToken(inputs);
                if ('error' in auth) return { error: auth.error };
                const { token, restBase } = auth;
                const params = new URLSearchParams();
                if (inputs.startDate) params.set('startDate', inputs.startDate);
                if (inputs.endDate) params.set('endDate', inputs.endDate);
                const res = await fetch(`${restBase}/data/v1/stats/email?${params}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get email performance' };
                return { output: data };
            }

            case 'getSMSPerformance': {
                const auth = await getMcAccessToken(inputs);
                if ('error' in auth) return { error: auth.error };
                const { token, restBase } = auth;
                const params = new URLSearchParams();
                if (inputs.startDate) params.set('startDate', inputs.startDate);
                if (inputs.endDate) params.set('endDate', inputs.endDate);
                const res = await fetch(`${restBase}/data/v1/stats/sms?${params}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get SMS performance' };
                return { output: data };
            }

            case 'createTriggeredSend': {
                const auth = await getMcAccessToken(inputs);
                if ('error' in auth) return { error: auth.error };
                const { token, restBase } = auth;
                const res = await fetch(`${restBase}/messaging/v1/messageDefinitionSends`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        definitionKey: inputs.definitionKey,
                        name: inputs.name,
                        description: inputs.description,
                        classification: inputs.classification,
                        sendDefinition: inputs.sendDefinition,
                        content: inputs.content,
                        subscriptions: inputs.subscriptions,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create triggered send' };
                return { output: data };
            }

            case 'listTriggeredSends': {
                const auth = await getMcAccessToken(inputs);
                if ('error' in auth) return { error: auth.error };
                const { token, restBase } = auth;
                const params = new URLSearchParams();
                if (inputs.page) params.set('$page', String(inputs.page));
                if (inputs.pageSize) params.set('$pagesize', String(inputs.pageSize));
                const res = await fetch(`${restBase}/messaging/v1/messageDefinitionSends?${params}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list triggered sends' };
                return { output: data };
            }

            default:
                return { error: `Unknown Salesforce Marketing Cloud action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Salesforce MC action error: ${err.message}`);
        return { error: err.message || 'Unexpected error in Salesforce MC action' };
    }
}
