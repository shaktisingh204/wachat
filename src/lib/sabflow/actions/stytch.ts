'use server';

export async function executeStytchAction(actionName: string, inputs: any, user: any, logger: any) {
    const authHeader = 'Basic ' + Buffer.from(inputs.projectId + ':' + inputs.secret).toString('base64');
    const baseUrl = 'https://api.stytch.com/v1';
    const headers: Record<string, string> = {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'loginOrCreate': {
                const body: Record<string, any> = { email: inputs.email };
                if (inputs.loginMagicLinkUrl) body.login_magic_link_url = inputs.loginMagicLinkUrl;
                if (inputs.signupMagicLinkUrl) body.signup_magic_link_url = inputs.signupMagicLinkUrl;
                const res = await fetch(`${baseUrl}/magic_links/email/login_or_create`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error_message || 'Failed to login or create' };
                return { output: data };
            }
            case 'sendMagicLink': {
                const body: Record<string, any> = { email: inputs.email };
                if (inputs.loginMagicLinkUrl) body.login_magic_link_url = inputs.loginMagicLinkUrl;
                if (inputs.signupMagicLinkUrl) body.signup_magic_link_url = inputs.signupMagicLinkUrl;
                if (inputs.expirationMinutes) body.expiration_minutes = inputs.expirationMinutes;
                const res = await fetch(`${baseUrl}/magic_links/email/send`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error_message || 'Failed to send magic link' };
                return { output: data };
            }
            case 'authenticateMagicLink': {
                const body: Record<string, any> = { token: inputs.token };
                if (inputs.sessionDurationMinutes) body.session_duration_minutes = inputs.sessionDurationMinutes;
                const res = await fetch(`${baseUrl}/magic_links/authenticate`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error_message || 'Failed to authenticate magic link' };
                return { output: data };
            }
            case 'sendOTP': {
                const body: Record<string, any> = {};
                if (inputs.email) body.email = inputs.email;
                if (inputs.phoneNumber) body.phone_number = inputs.phoneNumber;
                if (inputs.expirationMinutes) body.expiration_minutes = inputs.expirationMinutes;
                const endpoint = inputs.email ? `${baseUrl}/otps/email/login_or_create` : `${baseUrl}/otps/sms/login_or_create`;
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error_message || 'Failed to send OTP' };
                return { output: data };
            }
            case 'authenticateOTP': {
                const body: Record<string, any> = { method_id: inputs.methodId, code: inputs.code };
                if (inputs.sessionDurationMinutes) body.session_duration_minutes = inputs.sessionDurationMinutes;
                const res = await fetch(`${baseUrl}/otps/authenticate`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error_message || 'Failed to authenticate OTP' };
                return { output: data };
            }
            case 'createUser': {
                const body: Record<string, any> = {};
                if (inputs.email) body.email = inputs.email;
                if (inputs.phoneNumber) body.phone_number = inputs.phoneNumber;
                if (inputs.name) body.name = inputs.name;
                if (inputs.attributes) body.attributes = inputs.attributes;
                const res = await fetch(`${baseUrl}/users`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error_message || 'Failed to create user' };
                return { output: data };
            }
            case 'getUser': {
                const res = await fetch(`${baseUrl}/users/${inputs.userId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error_message || 'Failed to get user' };
                return { output: data };
            }
            case 'updateUser': {
                const body: Record<string, any> = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.attributes) body.attributes = inputs.attributes;
                const res = await fetch(`${baseUrl}/users/${inputs.userId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error_message || 'Failed to update user' };
                return { output: data };
            }
            case 'deleteUser': {
                const res = await fetch(`${baseUrl}/users/${inputs.userId}`, {
                    method: 'DELETE',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error_message || 'Failed to delete user' };
                return { output: data };
            }
            case 'loginOrCreateUser': {
                const body: Record<string, any> = { email: inputs.email };
                if (inputs.sessionDurationMinutes) body.session_duration_minutes = inputs.sessionDurationMinutes;
                const res = await fetch(`${baseUrl}/passwords/email/login_or_create`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error_message || 'Failed to login or create user' };
                return { output: data };
            }
            case 'searchUsers': {
                const body: Record<string, any> = {};
                if (inputs.cursor) body.cursor = inputs.cursor;
                if (inputs.limit) body.limit = inputs.limit;
                if (inputs.query) body.query = inputs.query;
                const res = await fetch(`${baseUrl}/users/search`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error_message || 'Failed to search users' };
                return { output: data };
            }
            case 'authenticateSession': {
                const body: Record<string, any> = {};
                if (inputs.sessionToken) body.session_token = inputs.sessionToken;
                if (inputs.sessionJwt) body.session_jwt = inputs.sessionJwt;
                if (inputs.sessionDurationMinutes) body.session_duration_minutes = inputs.sessionDurationMinutes;
                const res = await fetch(`${baseUrl}/sessions/authenticate`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error_message || 'Failed to authenticate session' };
                return { output: data };
            }
            case 'revokeSession': {
                const body: Record<string, any> = {};
                if (inputs.sessionId) body.session_id = inputs.sessionId;
                if (inputs.sessionToken) body.session_token = inputs.sessionToken;
                const res = await fetch(`${baseUrl}/sessions/revoke`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error_message || 'Failed to revoke session' };
                return { output: data };
            }
            case 'listSessions': {
                const params = new URLSearchParams({ user_id: inputs.userId });
                const res = await fetch(`${baseUrl}/sessions?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error_message || 'Failed to list sessions' };
                return { output: data };
            }
            case 'createSession': {
                const body: Record<string, any> = { user_id: inputs.userId };
                if (inputs.sessionDurationMinutes) body.session_duration_minutes = inputs.sessionDurationMinutes;
                if (inputs.sessionCustomClaims) body.session_custom_claims = inputs.sessionCustomClaims;
                const res = await fetch(`${baseUrl}/sessions`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error_message || 'Failed to create session' };
                return { output: data };
            }
            default:
                return { error: `Unknown Stytch action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Stytch error: ${err.message}`);
        return { error: err.message || 'Stytch action failed' };
    }
}
