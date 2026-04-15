'use server';

export async function executeAwsLambdaAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const { functionUrl, invokeUrl, apiKey, presignedUrl } = inputs;

        const targetUrl = functionUrl || invokeUrl || presignedUrl;
        if (!targetUrl) return { error: 'AwsLambda: functionUrl, invokeUrl, or presignedUrl is required.' };

        const baseHeaders: Record<string, string> = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };
        if (apiKey) baseHeaders['x-api-key'] = apiKey;

        async function invokeFunction(url: string, body: any, extraHeaders: Record<string, string> = {}): Promise<any> {
            const res = await fetch(url, {
                method: 'POST',
                headers: { ...baseHeaders, ...extraHeaders },
                body: JSON.stringify(body),
            });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.message || data?.errorMessage || JSON.stringify(data) || `Lambda error: ${res.status}`);
            return data;
        }

        async function getFunction(url: string): Promise<any> {
            const res = await fetch(url, { method: 'GET', headers: baseHeaders });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.message || JSON.stringify(data) || `Lambda error: ${res.status}`);
            return data;
        }

        logger.log(`Executing AwsLambda action: ${actionName}`, { inputs });

        switch (actionName) {
            case 'invoke': {
                const { payload } = inputs;
                const body = typeof payload === 'object' ? payload : (payload ? JSON.parse(payload) : {});
                const data = await invokeFunction(targetUrl, body);
                return { output: { result: data, statusCode: 200 } };
            }

            case 'invokeAsync': {
                const { payload } = inputs;
                const body = typeof payload === 'object' ? payload : (payload ? JSON.parse(payload) : {});
                const data = await invokeFunction(targetUrl, body, { 'X-Amz-Invocation-Type': 'Event' });
                return { output: { result: data, invocationType: 'Event', statusCode: 202 } };
            }

            case 'getFunctionConfig': {
                const configUrl = functionUrl || invokeUrl || presignedUrl;
                const data = await getFunction(configUrl);
                return {
                    output: {
                        config: data,
                        functionName: data.FunctionName ?? data.function_name,
                        runtime: data.Runtime ?? data.runtime,
                        handler: data.Handler ?? data.handler,
                        memorySize: data.MemorySize ?? data.memory_size,
                        timeout: data.Timeout ?? data.timeout,
                    },
                };
            }

            case 'invokeWithQueryParams': {
                const { payload, queryParams } = inputs;
                const body = typeof payload === 'object' ? payload : (payload ? JSON.parse(payload) : {});
                let url = targetUrl;
                if (queryParams && typeof queryParams === 'object') {
                    const qs = new URLSearchParams(queryParams).toString();
                    url = `${url}${url.includes('?') ? '&' : '?'}${qs}`;
                } else if (typeof queryParams === 'string' && queryParams) {
                    url = `${url}${url.includes('?') ? '&' : '?'}${queryParams}`;
                }
                const res = await fetch(url, {
                    method: 'POST',
                    headers: baseHeaders,
                    body: JSON.stringify(body),
                });
                const text = await res.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = { raw: text }; }
                if (!res.ok) throw new Error(data?.message || data?.errorMessage || JSON.stringify(data) || `Lambda error: ${res.status}`);
                return { output: { result: data, url, statusCode: res.status } };
            }

            case 'healthCheck': {
                const data = await invokeFunction(targetUrl, { type: 'health' });
                return {
                    output: {
                        healthy: true,
                        result: data,
                        timestamp: new Date().toISOString(),
                    },
                };
            }

            default:
                return { error: `AwsLambda: Unknown action "${actionName}".` };
        }
    } catch (err: any) {
        logger.log(`AwsLambda action error [${actionName}]:`, err?.message ?? err);
        return { error: err?.message ?? 'AwsLambda: An unexpected error occurred.' };
    }
}
