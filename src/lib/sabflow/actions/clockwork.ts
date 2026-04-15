'use server';

export async function executeClockworkAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = inputs.apiKey;

        switch (actionName) {
            case 'sendSms': {
                const body: Record<string, any> = {
                    key: apiKey,
                    to: inputs.to,
                    content: inputs.content,
                };
                if (inputs.from) body.from = inputs.from;
                if (inputs.long !== undefined) body.long = inputs.long;

                const res = await fetch('https://api.clockworksms.com/http/send.aspx', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const text = await res.text();
                if (!res.ok) return { error: text || `HTTP ${res.status}` };
                let data: any;
                try { data = JSON.parse(text); } catch { data = { response: text }; }
                return { output: data };
            }

            case 'sendBulkSms': {
                const toNumbers: string[] = Array.isArray(inputs.to) ? inputs.to : [inputs.to];
                const body: Record<string, any> = {
                    key: apiKey,
                    to: toNumbers,
                    content: inputs.content,
                };
                if (inputs.from) body.from = inputs.from;
                if (inputs.long !== undefined) body.long = inputs.long;

                const res = await fetch('https://api.clockworksms.com/http/send.aspx', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const text = await res.text();
                if (!res.ok) return { error: text || `HTTP ${res.status}` };
                let data: any;
                try { data = JSON.parse(text); } catch { data = { response: text }; }
                return { output: data };
            }

            case 'checkBalance': {
                const res = await fetch(
                    `https://api.clockworksms.com/http/balance.aspx?key=${encodeURIComponent(apiKey)}`,
                    { method: 'GET' }
                );
                const text = await res.text();
                if (!res.ok) return { error: text || `HTTP ${res.status}` };
                let data: any;
                try { data = JSON.parse(text); } catch { data = { response: text }; }
                return { output: data };
            }

            case 'checkCredit': {
                const res = await fetch(
                    `https://api.clockworksms.com/http/credit.aspx?key=${encodeURIComponent(apiKey)}`,
                    { method: 'GET' }
                );
                const text = await res.text();
                if (!res.ok) return { error: text || `HTTP ${res.status}` };
                let data: any;
                try { data = JSON.parse(text); } catch { data = { response: text }; }
                return { output: data };
            }

            case 'getMessageStatus': {
                const res = await fetch(
                    `https://api.clockworksms.com/http/status.aspx?key=${encodeURIComponent(apiKey)}&message_id=${encodeURIComponent(inputs.messageId)}`,
                    { method: 'GET' }
                );
                const text = await res.text();
                if (!res.ok) return { error: text || `HTTP ${res.status}` };
                let data: any;
                try { data = JSON.parse(text); } catch { data = { response: text }; }
                return { output: data };
            }

            default:
                return { error: `Clockwork action "${actionName}" is not supported.` };
        }
    } catch (err: any) {
        logger.log(`Clockwork action error: ${err.message}`);
        return { error: err.message || 'Unknown error in executeClockworkAction' };
    }
}
