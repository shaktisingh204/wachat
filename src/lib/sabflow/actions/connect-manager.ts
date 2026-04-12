
'use server';

import type { WithId, User } from '@/lib/definitions';

/**
 * Strip sensitive fields from a connection credentials object before returning it.
 */
function redactConnection(conn: any) {
    if (!conn || typeof conn !== 'object') return conn;
    const SENSITIVE = ['accessToken', 'refreshToken', 'apiKey', 'apiSecret', 'password', 'secret', 'clientSecret', 'token'];
    const safeCreds: Record<string, any> = {};
    if (conn.credentials && typeof conn.credentials === 'object') {
        for (const [k, v] of Object.entries(conn.credentials)) {
            safeCreds[k] = SENSITIVE.includes(k) ? '••••••••' : v;
        }
    }
    return {
        appName: conn.appName,
        connectionType: conn.connectionType,
        connected: true,
        credentials: safeCreds,
        createdAt: conn.createdAt,
        updatedAt: conn.updatedAt,
    };
}

export async function executeConnectManagerAction(
    actionName: string,
    inputs: any,
    user: WithId<User>,
    logger: any
) {
    try {
        const connections: any[] = (user as any).sabFlowConnections || [];

        switch (actionName) {
            case 'listConnections': {
                const safe = connections.map(redactConnection);
                logger.log(`[ConnectManager] Listed ${safe.length} connections`);
                return { output: { connections: safe, count: safe.length } };
            }

            case 'checkConnection': {
                const appName = String(inputs.appName ?? '').trim();
                if (!appName) throw new Error('appName is required.');
                const conn = connections.find(
                    (c: any) => c.appName?.toLowerCase() === appName.toLowerCase()
                );
                logger.log(`[ConnectManager] checkConnection ${appName} → ${conn ? 'connected' : 'not connected'}`);
                return {
                    output: {
                        connected: String(Boolean(conn)),
                        appName,
                    },
                };
            }

            case 'getConnectionDetails': {
                const appName = String(inputs.appName ?? '').trim();
                if (!appName) throw new Error('appName is required.');
                const conn = connections.find(
                    (c: any) => c.appName?.toLowerCase() === appName.toLowerCase()
                );
                if (!conn) {
                    return { output: { details: null }, error: `No connection found for "${appName}".` };
                }
                return { output: { details: redactConnection(conn) } };
            }

            default:
                return { error: `Connect Manager action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Connect Manager action failed.' };
    }
}
