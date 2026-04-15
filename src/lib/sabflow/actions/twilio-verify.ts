'use server';

export async function executeTwilioVerifyAction(actionName: string, inputs: any, user: any, logger: any) {
    const authHeader = 'Basic ' + Buffer.from(inputs.accountSid + ':' + inputs.authToken).toString('base64');
    const baseUrl = 'https://verify.twilio.com/v2';

    try {
        switch (actionName) {
            case 'createVerification': {
                const res = await fetch(`${baseUrl}/Services/${inputs.serviceSid}/Verifications`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ To: inputs.to, Channel: inputs.channel || 'sms' }).toString(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create verification' };
                return { output: data };
            }
            case 'checkVerification': {
                const res = await fetch(`${baseUrl}/Services/${inputs.serviceSid}/VerificationCheck`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ To: inputs.to, Code: inputs.code }).toString(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to check verification' };
                return { output: data };
            }
            case 'createService': {
                const res = await fetch(`${baseUrl}/Services`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ FriendlyName: inputs.friendlyName }).toString(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create service' };
                return { output: data };
            }
            case 'fetchService': {
                const res = await fetch(`${baseUrl}/Services/${inputs.serviceSid}`, {
                    headers: { 'Authorization': authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to fetch service' };
                return { output: data };
            }
            case 'updateService': {
                const params: Record<string, string> = {};
                if (inputs.friendlyName) params.FriendlyName = inputs.friendlyName;
                if (inputs.codeLength) params.CodeLength = inputs.codeLength;
                if (inputs.lookupEnabled !== undefined) params.LookupEnabled = String(inputs.lookupEnabled);
                const res = await fetch(`${baseUrl}/Services/${inputs.serviceSid}`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams(params).toString(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to update service' };
                return { output: data };
            }
            case 'deleteService': {
                const res = await fetch(`${baseUrl}/Services/${inputs.serviceSid}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': authHeader },
                });
                if (res.status === 204) return { output: { deleted: true, serviceSid: inputs.serviceSid } };
                const data = await res.json();
                return { error: data.message || 'Failed to delete service' };
            }
            case 'listVerifications': {
                const params = new URLSearchParams();
                if (inputs.status) params.set('Status', inputs.status);
                if (inputs.pageSize) params.set('PageSize', String(inputs.pageSize));
                const res = await fetch(`${baseUrl}/Services/${inputs.serviceSid}/Verifications?${params}`, {
                    headers: { 'Authorization': authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list verifications' };
                return { output: data };
            }
            case 'listVerificationChecks': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('PageSize', String(inputs.pageSize));
                const res = await fetch(`${baseUrl}/Services/${inputs.serviceSid}/VerificationCheck?${params}`, {
                    headers: { 'Authorization': authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list verification checks' };
                return { output: data };
            }
            case 'createRateLimit': {
                const res = await fetch(`${baseUrl}/Services/${inputs.serviceSid}/RateLimits`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ UniqueName: inputs.uniqueName, Description: inputs.description || '' }).toString(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create rate limit' };
                return { output: data };
            }
            case 'listRateLimits': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('PageSize', String(inputs.pageSize));
                const res = await fetch(`${baseUrl}/Services/${inputs.serviceSid}/RateLimits?${params}`, {
                    headers: { 'Authorization': authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list rate limits' };
                return { output: data };
            }
            case 'createBucket': {
                const res = await fetch(`${baseUrl}/Services/${inputs.serviceSid}/RateLimits/${inputs.rateLimitSid}/Buckets`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ Max: String(inputs.max), Interval: String(inputs.interval) }).toString(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create bucket' };
                return { output: data };
            }
            case 'listBuckets': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('PageSize', String(inputs.pageSize));
                const res = await fetch(`${baseUrl}/Services/${inputs.serviceSid}/RateLimits/${inputs.rateLimitSid}/Buckets?${params}`, {
                    headers: { 'Authorization': authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list buckets' };
                return { output: data };
            }
            case 'createEntity': {
                const res = await fetch(`${baseUrl}/Services/${inputs.serviceSid}/Entities`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ Identity: inputs.identity }).toString(),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create entity' };
                return { output: data };
            }
            case 'listEntities': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('PageSize', String(inputs.pageSize));
                const res = await fetch(`${baseUrl}/Services/${inputs.serviceSid}/Entities?${params}`, {
                    headers: { 'Authorization': authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list entities' };
                return { output: data };
            }
            case 'deleteEntity': {
                const res = await fetch(`${baseUrl}/Services/${inputs.serviceSid}/Entities/${inputs.identity}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': authHeader },
                });
                if (res.status === 204) return { output: { deleted: true, identity: inputs.identity } };
                const data = await res.json();
                return { error: data.message || 'Failed to delete entity' };
            }
            default:
                return { error: `Unknown Twilio Verify action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`TwilioVerify error: ${err.message}`);
        return { error: err.message || 'TwilioVerify action failed' };
    }
}
