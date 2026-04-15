
'use server';

/**
 * SFTP Action Executor
 *
 * SFTP is an SSH-based protocol that cannot be initiated directly from a
 * serverless / edge environment. This executor acts as a REST client that
 * forwards all requests to a user-supplied SFTP-to-REST bridge URL
 * (`inputs.sftpApiUrl`).  A compatible bridge can be built with packages
 * such as `ssh2-sftp-client` running in a long-lived Node.js process, or
 * any HTTP gateway that exposes the operations below.
 *
 * Each action sends a POST request to `${sftpApiUrl}/${actionName}` with a
 * JSON body containing the connection credentials and operation parameters.
 */

async function sftpBridgeFetch(sftpApiUrl: string, action: string, payload: any, logger?: any) {
    const url = `${sftpApiUrl.replace(/\/$/, '')}/${action}`;
    logger?.log(`[SFTP] POST ${url}`);
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
    });
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) throw new Error(data?.error || data?.message || text || `SFTP bridge error ${res.status}`);
    return data;
}

function buildCredentials(inputs: any) {
    return {
        host: String(inputs.host ?? '').trim(),
        port: inputs.port ? Number(inputs.port) : 22,
        username: String(inputs.username ?? '').trim(),
        ...(inputs.privateKey
            ? { privateKey: String(inputs.privateKey) }
            : { password: String(inputs.password ?? '') }),
    };
}

export async function executeSftpAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const sftpApiUrl = String(inputs.sftpApiUrl ?? '').trim();
        if (!sftpApiUrl) {
            return {
                error:
                    'SFTP requires a proxy service. Please provide `sftpApiUrl` pointing to an SFTP-to-REST bridge ' +
                    '(e.g. a Node.js server using ssh2-sftp-client). ' +
                    'Native SFTP/SSH is not supported in serverless environments.',
            };
        }

        const credentials = buildCredentials(inputs);
        if (!credentials.host) throw new Error('host is required.');
        if (!credentials.username) throw new Error('username is required.');

        const call = (payload: any) => sftpBridgeFetch(sftpApiUrl, actionName, { ...credentials, ...payload }, logger);

        switch (actionName) {
            case 'listFiles': {
                const path = String(inputs.path ?? '/').trim();
                const data = await call({ path });
                return { output: data };
            }

            case 'readFile': {
                const path = String(inputs.path ?? '').trim();
                if (!path) throw new Error('path is required.');
                const data = await call({ path, encoding: inputs.encoding ?? 'base64' });
                return { output: data };
            }

            case 'writeFile': {
                const path = String(inputs.path ?? '').trim();
                const content = String(inputs.content ?? inputs.fileContent ?? '').trim();
                if (!path) throw new Error('path is required.');
                if (!content) throw new Error('content (base64) is required.');
                const data = await call({ path, content, encoding: inputs.encoding ?? 'base64' });
                return { output: { success: true, ...data } };
            }

            case 'deleteFile': {
                const path = String(inputs.path ?? '').trim();
                if (!path) throw new Error('path is required.');
                const data = await call({ path });
                return { output: { success: true, ...data } };
            }

            case 'createDirectory': {
                const path = String(inputs.path ?? '').trim();
                if (!path) throw new Error('path is required.');
                const data = await call({ path });
                return { output: { success: true, ...data } };
            }

            case 'renameFile': {
                const oldPath = String(inputs.oldPath ?? inputs.path ?? '').trim();
                const newPath = String(inputs.newPath ?? '').trim();
                if (!oldPath || !newPath) throw new Error('oldPath and newPath are required.');
                const data = await call({ oldPath, newPath });
                return { output: { success: true, ...data } };
            }

            case 'moveFile': {
                const sourcePath = String(inputs.sourcePath ?? inputs.src ?? '').trim();
                const destinationPath = String(inputs.destinationPath ?? inputs.dest ?? '').trim();
                if (!sourcePath || !destinationPath) throw new Error('sourcePath and destinationPath are required.');
                const data = await call({ sourcePath, destinationPath });
                return { output: { success: true, ...data } };
            }

            case 'getFileStats': {
                const path = String(inputs.path ?? '').trim();
                if (!path) throw new Error('path is required.');
                const data = await call({ path });
                return { output: data };
            }

            case 'downloadFile': {
                const path = String(inputs.path ?? '').trim();
                if (!path) throw new Error('path is required.');
                // Bridge may return a signed URL or base64 content
                const data = await call({ path, returnType: inputs.returnType ?? 'base64' });
                return { output: data };
            }

            case 'uploadFile': {
                const remotePath = String(inputs.remotePath ?? inputs.path ?? '').trim();
                const fileUrl = String(inputs.fileUrl ?? '').trim();
                const content = String(inputs.content ?? '').trim();
                if (!remotePath) throw new Error('remotePath is required.');
                if (!fileUrl && !content) throw new Error('Either fileUrl or content (base64) is required.');
                const data = await call({ remotePath, fileUrl, content });
                return { output: { success: true, ...data } };
            }

            default:
                return { error: `SFTP action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'SFTP action failed.' };
    }
}
