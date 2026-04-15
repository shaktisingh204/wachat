'use server';

export async function executeZapierWebhooksAction(actionName: string, inputs: any, user: any, logger: any) {
    const HOOKS_BASE = 'https://hooks.zapier.com';
    const API_BASE = 'https://api.zapier.com/v1';

    try {
        switch (actionName) {
            case 'triggerWebhook': {
                const url = inputs.webhookUrl ||
                    `${HOOKS_BASE}/hooks/catch/${inputs.userId}/${inputs.webhookId}/`;
                const res = await fetch(url, { method: 'POST' });
                if (!res.ok) return { error: `Failed to trigger webhook: HTTP ${res.status}` };
                const data = await res.json();
                return { output: data };
            }

            case 'triggerWebhookWithPayload': {
                const url = inputs.webhookUrl ||
                    `${HOOKS_BASE}/hooks/catch/${inputs.userId}/${inputs.webhookId}/`;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(inputs.payload || {}),
                });
                if (!res.ok) return { error: `Failed to trigger webhook with payload: HTTP ${res.status}` };
                const data = await res.json();
                return { output: data };
            }

            case 'listZaps': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const res = await fetch(`${API_BASE}/zaps?${params}`, {
                    headers: { Authorization: `Bearer ${inputs.apiKey}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || data.message || 'Failed to list zaps' };
                return { output: data };
            }

            case 'getZap': {
                const res = await fetch(`${API_BASE}/zaps/${inputs.zapId}`, {
                    headers: { Authorization: `Bearer ${inputs.apiKey}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || data.message || 'Failed to get zap' };
                return { output: data };
            }

            case 'enableZap': {
                const res = await fetch(`${API_BASE}/zaps/${inputs.zapId}/enable`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${inputs.apiKey}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || data.message || 'Failed to enable zap' };
                return { output: data };
            }

            case 'disableZap': {
                const res = await fetch(`${API_BASE}/zaps/${inputs.zapId}/disable`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${inputs.apiKey}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || data.message || 'Failed to disable zap' };
                return { output: data };
            }

            case 'runZap': {
                const res = await fetch(`${API_BASE}/zaps/${inputs.zapId}/run`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${inputs.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(inputs.body || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || data.message || 'Failed to run zap' };
                return { output: data };
            }

            case 'listTriggers': {
                const res = await fetch(`${API_BASE}/triggers`, {
                    headers: { Authorization: `Bearer ${inputs.apiKey}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || data.message || 'Failed to list triggers' };
                return { output: data };
            }

            case 'getTrigger': {
                const res = await fetch(`${API_BASE}/triggers/${inputs.triggerId}`, {
                    headers: { Authorization: `Bearer ${inputs.apiKey}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || data.message || 'Failed to get trigger' };
                return { output: data };
            }

            case 'listActions': {
                const res = await fetch(`${API_BASE}/actions`, {
                    headers: { Authorization: `Bearer ${inputs.apiKey}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || data.message || 'Failed to list actions' };
                return { output: data };
            }

            case 'getAction': {
                const res = await fetch(`${API_BASE}/actions/${inputs.actionId}`, {
                    headers: { Authorization: `Bearer ${inputs.apiKey}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || data.message || 'Failed to get action' };
                return { output: data };
            }

            case 'checkZapHistory': {
                const params = new URLSearchParams();
                if (inputs.zapId) params.set('zap_id', inputs.zapId);
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const res = await fetch(`${API_BASE}/zap-runs?${params}`, {
                    headers: { Authorization: `Bearer ${inputs.apiKey}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || data.message || 'Failed to check zap history' };
                return { output: data };
            }

            case 'getAccount': {
                const res = await fetch(`${API_BASE}/profiles/me`, {
                    headers: { Authorization: `Bearer ${inputs.apiKey}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || data.message || 'Failed to get account' };
                return { output: data };
            }

            case 'listTeamMembers': {
                const res = await fetch(`${API_BASE}/team/members`, {
                    headers: { Authorization: `Bearer ${inputs.apiKey}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || data.message || 'Failed to list team members' };
                return { output: data };
            }

            case 'listFolders': {
                const res = await fetch(`${API_BASE}/folders`, {
                    headers: { Authorization: `Bearer ${inputs.apiKey}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || data.message || 'Failed to list folders' };
                return { output: data };
            }

            default:
                return { error: `Unknown Zapier Webhooks action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Zapier Webhooks action error: ${err.message}`);
        return { error: err.message || 'Zapier Webhooks action failed' };
    }
}
