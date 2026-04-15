'use server';

const APPDYNAMICS_BASE = (account: string) =>
    `https://${account}.saas.appdynamics.com/controller`;

function adAuth(username: string, account: string, password: string): string {
    return Buffer.from(`${username}@${account}:${password}`).toString('base64');
}

async function adFetch(
    username: string,
    account: string,
    password: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    const url = `${APPDYNAMICS_BASE(account)}${path}`;
    logger?.log(`[AppDynamics] ${method} ${url}`);
    const res = await fetch(url, {
        method,
        headers: {
            Authorization: `Basic ${adAuth(username, account, password)}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`AppDynamics API error ${res.status}: ${text}`);
    }
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return res.json();
    return res.text();
}

export async function executeAppDynamicsAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const { username, account, password } = inputs;
        if (!username || !account || !password) {
            return { error: 'Missing required credentials: username, account, password' };
        }

        switch (actionName) {
            case 'listApplications': {
                const data = await adFetch(username, account, password, 'GET', '/rest/applications?output=JSON', undefined, logger);
                return { output: { applications: data } };
            }

            case 'getApplication': {
                const { applicationId } = inputs;
                if (!applicationId) return { error: 'applicationId is required' };
                const data = await adFetch(username, account, password, 'GET', `/rest/applications/${applicationId}?output=JSON`, undefined, logger);
                return { output: { application: data } };
            }

            case 'listBusinessTransactions': {
                const { applicationId } = inputs;
                if (!applicationId) return { error: 'applicationId is required' };
                const data = await adFetch(username, account, password, 'GET', `/rest/applications/${applicationId}/business-transactions?output=JSON`, undefined, logger);
                return { output: { businessTransactions: data } };
            }

            case 'getBusinessTransaction': {
                const { applicationId, btId } = inputs;
                if (!applicationId || !btId) return { error: 'applicationId and btId are required' };
                const data = await adFetch(username, account, password, 'GET', `/rest/applications/${applicationId}/business-transactions/${btId}?output=JSON`, undefined, logger);
                return { output: { businessTransaction: data } };
            }

            case 'listTiers': {
                const { applicationId } = inputs;
                if (!applicationId) return { error: 'applicationId is required' };
                const data = await adFetch(username, account, password, 'GET', `/rest/applications/${applicationId}/tiers?output=JSON`, undefined, logger);
                return { output: { tiers: data } };
            }

            case 'getTier': {
                const { applicationId, tierId } = inputs;
                if (!applicationId || !tierId) return { error: 'applicationId and tierId are required' };
                const data = await adFetch(username, account, password, 'GET', `/rest/applications/${applicationId}/tiers/${tierId}?output=JSON`, undefined, logger);
                return { output: { tier: data } };
            }

            case 'getMetricData': {
                const { applicationId, metricPath, timeRangeType = 'BEFORE_NOW', durationInMins = 60 } = inputs;
                if (!applicationId || !metricPath) return { error: 'applicationId and metricPath are required' };
                const encodedPath = encodeURIComponent(metricPath);
                const data = await adFetch(
                    username, account, password, 'GET',
                    `/rest/applications/${applicationId}/metric-data?metric-path=${encodedPath}&time-range-type=${timeRangeType}&duration-in-mins=${durationInMins}&output=JSON`,
                    undefined, logger
                );
                return { output: { metricData: data } };
            }

            case 'getMetricHierarchy': {
                const { applicationId, metricPath = '' } = inputs;
                if (!applicationId) return { error: 'applicationId is required' };
                const encodedPath = encodeURIComponent(metricPath);
                const data = await adFetch(username, account, password, 'GET', `/rest/applications/${applicationId}/metrics?metric-path=${encodedPath}&output=JSON`, undefined, logger);
                return { output: { metricHierarchy: data } };
            }

            case 'listHealthRules': {
                const { applicationId } = inputs;
                if (!applicationId) return { error: 'applicationId is required' };
                const data = await adFetch(username, account, password, 'GET', `/alerting/rest/v1/applications/${applicationId}/health-rules`, undefined, logger);
                return { output: { healthRules: data } };
            }

            case 'getHealthRule': {
                const { applicationId, healthRuleId } = inputs;
                if (!applicationId || !healthRuleId) return { error: 'applicationId and healthRuleId are required' };
                const data = await adFetch(username, account, password, 'GET', `/alerting/rest/v1/applications/${applicationId}/health-rules/${healthRuleId}`, undefined, logger);
                return { output: { healthRule: data } };
            }

            case 'createHealthRule': {
                const { applicationId, healthRule } = inputs;
                if (!applicationId || !healthRule) return { error: 'applicationId and healthRule are required' };
                const data = await adFetch(username, account, password, 'POST', `/alerting/rest/v1/applications/${applicationId}/health-rules`, healthRule, logger);
                return { output: { healthRule: data } };
            }

            case 'listPolicies': {
                const { applicationId } = inputs;
                if (!applicationId) return { error: 'applicationId is required' };
                const data = await adFetch(username, account, password, 'GET', `/alerting/rest/v1/applications/${applicationId}/policies`, undefined, logger);
                return { output: { policies: data } };
            }

            case 'getPolicy': {
                const { applicationId, policyId } = inputs;
                if (!applicationId || !policyId) return { error: 'applicationId and policyId are required' };
                const data = await adFetch(username, account, password, 'GET', `/alerting/rest/v1/applications/${applicationId}/policies/${policyId}`, undefined, logger);
                return { output: { policy: data } };
            }

            case 'listActions': {
                const { applicationId } = inputs;
                if (!applicationId) return { error: 'applicationId is required' };
                const data = await adFetch(username, account, password, 'GET', `/alerting/rest/v1/applications/${applicationId}/actions`, undefined, logger);
                return { output: { actions: data } };
            }

            case 'getAction': {
                const { applicationId, actionId } = inputs;
                if (!applicationId || !actionId) return { error: 'applicationId and actionId are required' };
                const data = await adFetch(username, account, password, 'GET', `/alerting/rest/v1/applications/${applicationId}/actions/${actionId}`, undefined, logger);
                return { output: { action: data } };
            }

            default:
                return { error: `Unknown AppDynamics action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[AppDynamics] Error: ${err.message}`);
        return { error: err.message || 'AppDynamics action failed' };
    }
}
