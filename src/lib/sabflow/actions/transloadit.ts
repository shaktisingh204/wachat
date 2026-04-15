'use server';

import { createHmac } from 'crypto';

const BASE_URL = 'https://api2.transloadit.com';

function buildAuthParams(authKey: string, authSecret: string, extraParams?: Record<string, any>) {
    const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '+00:00');
    const authObj: Record<string, any> = { key: authKey, expires };
    const params = JSON.stringify({ auth: authObj, ...extraParams });
    const signature = createHmac('sha1', authSecret).update(Buffer.from(params)).digest('hex');
    return { params, signature: `sha1:${signature}` };
}

export async function executeTransloaditAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const authKey = inputs.authKey;
        const authSecret = inputs.authSecret;
        if (!authKey || !authSecret) return { error: 'Missing required credentials: authKey and authSecret' };

        const signedFetch = async (path: string, method = 'GET', extraParams?: Record<string, any>, formData?: Record<string, string>) => {
            const { params, signature } = buildAuthParams(authKey, authSecret, extraParams);
            let res: Response;
            if (method === 'GET' || method === 'DELETE') {
                const qs = new URLSearchParams({ params, signature });
                res = await fetch(`${BASE_URL}${path}?${qs}`, { method });
            } else {
                const body = new URLSearchParams({ params, signature, ...(formData || {}) });
                res = await fetch(`${BASE_URL}${path}`, {
                    method,
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: body.toString(),
                });
            }
            if (res.status === 204) return { success: true };
            const data = await res.json();
            if (!res.ok) return { _error: data.message || data.error || `Request failed: ${res.status}` };
            return data;
        };

        switch (actionName) {
            case 'createAssembly': {
                const steps = inputs.steps || {};
                const notify_url = inputs.notifyUrl || '';
                const data = await signedFetch('/assemblies', 'POST', { steps, notify_url });
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'getAssembly': {
                const assemblyId = inputs.assemblyId;
                const data = await signedFetch(`/assemblies/${assemblyId}`);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'cancelAssembly': {
                const assemblyId = inputs.assemblyId;
                const data = await signedFetch(`/assemblies/${assemblyId}`, 'DELETE');
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'listAssemblies': {
                const queryParams: Record<string, any> = {};
                if (inputs.page) queryParams.page = inputs.page;
                if (inputs.pagesize) queryParams.pagesize = inputs.pagesize;
                if (inputs.fromDate) queryParams.fromdate = inputs.fromDate;
                if (inputs.toDate) queryParams.todate = inputs.toDate;
                const { params, signature } = buildAuthParams(authKey, authSecret);
                const qs = new URLSearchParams({ params, signature, ...Object.fromEntries(Object.entries(queryParams).map(([k, v]) => [k, String(v)])) });
                const res = await fetch(`${BASE_URL}/assemblies?${qs}`);
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'List assemblies failed' };
                return { output: data };
            }

            case 'getAssemblyNotification': {
                const assemblyId = inputs.assemblyId;
                const data = await signedFetch(`/assembly_notifications/${assemblyId}`);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'createTemplate': {
                const name = inputs.name;
                const template = inputs.template || {};
                const data = await signedFetch('/templates', 'POST', {}, {
                    name,
                    template: JSON.stringify(template),
                });
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'getTemplate': {
                const templateId = inputs.templateId;
                const data = await signedFetch(`/templates/${templateId}`);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'updateTemplate': {
                const templateId = inputs.templateId;
                const template = inputs.template || {};
                const data = await signedFetch(`/templates/${templateId}`, 'PUT', {}, {
                    template: JSON.stringify(template),
                });
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'deleteTemplate': {
                const templateId = inputs.templateId;
                const data = await signedFetch(`/templates/${templateId}`, 'DELETE');
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'listTemplates': {
                const data = await signedFetch('/templates');
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'getBill': {
                const month = inputs.month; // format: YYYY-MM
                const data = await signedFetch(`/bill/${month}`);
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'listBills': {
                const data = await signedFetch('/bills');
                if (data._error) return { error: data._error };
                return { output: data };
            }

            case 'createSignedSmartCDNURL': {
                const workspace = inputs.workspace;
                const template = inputs.template;
                const inputField = inputs.inputField || '';
                const urlExpireSeconds = inputs.expireSeconds || 3600;
                const expires = Math.floor(Date.now() / 1000) + urlExpireSeconds;
                const base = `https://smartcdn.transloadit.com/${workspace}/${template}/${inputField}`;
                const sigInput = `${expires}${base}`;
                const sig = createHmac('sha256', authSecret).update(sigInput).digest('hex');
                const url = `${base}?expires=${expires}&signature=${sig}`;
                return { output: { url, expires } };
            }

            case 'getFormData': {
                const templateId = inputs.templateId;
                const { params, signature } = buildAuthParams(authKey, authSecret, { template_id: templateId });
                return { output: { params, signature, template_id: templateId } };
            }

            case 'listQueuedAssemblies': {
                const data = await signedFetch('/queued_assemblies');
                if (data._error) return { error: data._error };
                return { output: data };
            }

            default:
                return { error: `Unknown Transloadit action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Transloadit action error: ${err.message}`);
        return { error: err.message || 'Transloadit action failed' };
    }
}
