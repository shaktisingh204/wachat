'use server';

export async function executeSignl4Action(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const teamSecret = String(inputs.teamSecret ?? '').trim();
        if (!teamSecret) throw new Error('teamSecret is required.');

        const webhookBase = `https://connect.signl4.com/webhook/${teamSecret}`;

        switch (actionName) {
            case 'sendAlert': {
                const title = String(inputs.title ?? '').trim();
                if (!title) throw new Error('title is required.');
                const message = String(inputs.message ?? '').trim();
                if (!message) throw new Error('message is required.');
                const severity = inputs.severity !== undefined ? inputs.severity : undefined;

                const payload: any = { title, message };
                if (severity !== undefined) payload['X-S4-Status'] = severity;
                if (inputs.filterId) payload['X-S4-FilterID'] = String(inputs.filterId);
                if (inputs.externalId) payload['X-S4-ExternalID'] = String(inputs.externalId);

                logger?.log(`[SIGNL4] Sending alert: ${title}`);
                const res = await fetch(webhookBase, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                const text = await res.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = text; }
                if (!res.ok) throw new Error(data?.message || `SIGNL4 API error: ${res.status}`);
                return { output: { sent: true, response: data } };
            }

            case 'closeAlert': {
                const externalId = String(inputs.externalId ?? '').trim();
                if (!externalId) throw new Error('externalId is required.');

                logger?.log(`[SIGNL4] Closing alert: ${externalId}`);
                const url = `${webhookBase}/~?externalId=${encodeURIComponent(externalId)}&X-S4-ExternalId=${encodeURIComponent(externalId)}`;
                const res = await fetch(url, { method: 'DELETE' });
                if (res.status === 204 || res.ok) return { output: { closed: true } };
                const text = await res.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = text; }
                throw new Error(data?.message || `SIGNL4 API error: ${res.status}`);
            }

            case 'getAlerts': {
                logger?.log('[SIGNL4] Fetching alerts');
                const res = await fetch(`https://connect.signl4.com/webhook/api/alerts?teamSecret=${encodeURIComponent(teamSecret)}`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                });
                const text = await res.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = text; }
                if (!res.ok) throw new Error(data?.message || `SIGNL4 API error: ${res.status}`);
                return { output: { alerts: data } };
            }

            default:
                return { error: `SIGNL4 action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'SIGNL4 action failed.' };
    }
}
