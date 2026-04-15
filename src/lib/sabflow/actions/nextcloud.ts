
'use server';

export async function executeNextCloudAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const serverUrl = String(inputs.serverUrl ?? '').replace(/\/$/, '');
        const username = String(inputs.username ?? '').trim();
        const password = String(inputs.password ?? '').trim();

        if (!serverUrl) throw new Error('serverUrl is required.');
        if (!username) throw new Error('username is required.');
        if (!password) throw new Error('password is required.');

        const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
        const webdavBase = `${serverUrl}/remote.php/dav/files/${username}`;
        const ocsBase = `${serverUrl}/ocs/v2.php/apps`;

        const webdavFetch = async (method: string, path: string, body?: string | Buffer, extraHeaders?: Record<string, string>) => {
            const url = `${webdavBase}${path.startsWith('/') ? path : '/' + path}`;
            logger?.log(`[Nextcloud] WebDAV ${method} ${url}`);
            const headers: Record<string, string> = {
                Authorization: authHeader,
                ...extraHeaders,
            };
            const res = await fetch(url, { method, headers, body: body as any });
            const text = await res.text();
            if (!res.ok && res.status !== 207) throw new Error(`Nextcloud WebDAV error ${res.status}: ${text}`);
            return { status: res.status, body: text, headers: Object.fromEntries(res.headers.entries()) };
        };

        const ocsFetch = async (method: string, path: string, body?: string, bodyContentType?: string) => {
            const url = `${ocsBase}${path}`;
            logger?.log(`[Nextcloud] OCS ${method} ${url}`);
            const headers: Record<string, string> = {
                Authorization: authHeader,
                'OCS-APIRequest': 'true',
                Accept: 'application/json',
            };
            if (body && bodyContentType) headers['Content-Type'] = bodyContentType;
            const res = await fetch(url, { method, headers, body });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.ocs?.meta?.message || `Nextcloud OCS error ${res.status}`);
            return data;
        };

        switch (actionName) {
            case 'listFiles': {
                const path = String(inputs.path ?? '/').trim();
                const body = `<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:displayname/><d:getcontentlength/><d:getcontenttype/><d:getlastmodified/><d:resourcetype/></d:prop></d:propfind>`;
                const result = await webdavFetch('PROPFIND', path, body, { 'Content-Type': 'application/xml', Depth: '1' });
                return { output: { path, xmlResponse: result.body, status: result.status } };
            }

            case 'getFile': {
                const path = String(inputs.path ?? '').trim();
                if (!path) throw new Error('path is required.');
                const result = await webdavFetch('GET', path);
                return { output: { path, content: result.body, contentType: result.headers['content-type'] } };
            }

            case 'uploadFile': {
                const path = String(inputs.path ?? '').trim();
                const content = String(inputs.content ?? '');
                if (!path) throw new Error('path is required.');
                const result = await webdavFetch('PUT', path, content, { 'Content-Type': inputs.contentType ?? 'application/octet-stream' });
                return { output: { path, status: result.status, success: true } };
            }

            case 'deleteFile': {
                const path = String(inputs.path ?? '').trim();
                if (!path) throw new Error('path is required.');
                const result = await webdavFetch('DELETE', path);
                return { output: { path, status: result.status, success: true } };
            }

            case 'createFolder': {
                const path = String(inputs.path ?? '').trim();
                if (!path) throw new Error('path is required.');
                const result = await webdavFetch('MKCOL', path);
                return { output: { path, status: result.status, success: true } };
            }

            case 'moveFile': {
                const sourcePath = String(inputs.sourcePath ?? '').trim();
                const destinationPath = String(inputs.destinationPath ?? '').trim();
                if (!sourcePath || !destinationPath) throw new Error('sourcePath and destinationPath are required.');
                const destination = `${webdavBase}${destinationPath.startsWith('/') ? destinationPath : '/' + destinationPath}`;
                const result = await webdavFetch('MOVE', sourcePath, undefined, { Destination: destination });
                return { output: { sourcePath, destinationPath, status: result.status, success: true } };
            }

            case 'shareFile': {
                const path = String(inputs.path ?? '').trim();
                const shareType = String(inputs.shareType ?? '3'); // 3 = public link
                const permissions = String(inputs.permissions ?? '1');
                if (!path) throw new Error('path is required.');
                const params = new URLSearchParams({ path, shareType, permissions });
                if (inputs.shareWith) params.set('shareWith', String(inputs.shareWith));
                const data = await ocsFetch('POST', '/files_sharing/api/v1/shares', params.toString(), 'application/x-www-form-urlencoded');
                return { output: data?.ocs?.data ?? data };
            }

            case 'listShares': {
                const path = inputs.path ? `?path=${encodeURIComponent(String(inputs.path))}` : '';
                const data = await ocsFetch('GET', `/files_sharing/api/v1/shares${path}`);
                return { output: { shares: data?.ocs?.data ?? [] } };
            }

            case 'deleteShare': {
                const shareId = String(inputs.shareId ?? '').trim();
                if (!shareId) throw new Error('shareId is required.');
                const data = await ocsFetch('DELETE', `/files_sharing/api/v1/shares/${shareId}`);
                return { output: { shareId, success: true, meta: data?.ocs?.meta } };
            }

            case 'getUser': {
                const userId = String(inputs.userId ?? username).trim();
                const data = await ocsFetch('GET', `/files_sharing/api/v1/shares`);
                const userData = await ocsFetch('GET', `/../../ocs/v2.php/cloud/users/${userId}`.replace('/apps', ''));
                return { output: userData?.ocs?.data ?? userData };
            }

            case 'createUser': {
                const newUsername = String(inputs.newUsername ?? '').trim();
                const newPassword = String(inputs.newPassword ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!newUsername || !newPassword) throw new Error('newUsername and newPassword are required.');
                const params = new URLSearchParams({ userid: newUsername, password: newPassword });
                if (email) params.set('email', email);
                const res = await fetch(`${serverUrl}/ocs/v2.php/cloud/users`, {
                    method: 'POST',
                    headers: { Authorization: authHeader, 'OCS-APIRequest': 'true', Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: params.toString(),
                });
                const text = await res.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = { raw: text }; }
                if (!res.ok) throw new Error(data?.ocs?.meta?.message || `Error ${res.status}`);
                return { output: { success: true, meta: data?.ocs?.meta } };
            }

            case 'listUsers': {
                const res = await fetch(`${serverUrl}/ocs/v2.php/cloud/users`, {
                    headers: { Authorization: authHeader, 'OCS-APIRequest': 'true', Accept: 'application/json' },
                });
                const text = await res.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = { raw: text }; }
                if (!res.ok) throw new Error(`Error ${res.status}`);
                return { output: { users: data?.ocs?.data?.users ?? [] } };
            }

            case 'getAppInfo': {
                const appId = String(inputs.appId ?? '').trim();
                if (!appId) throw new Error('appId is required.');
                const res = await fetch(`${serverUrl}/ocs/v2.php/apps/${appId}`, {
                    headers: { Authorization: authHeader, 'OCS-APIRequest': 'true', Accept: 'application/json' },
                });
                const text = await res.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = { raw: text }; }
                if (!res.ok) throw new Error(`Error ${res.status}`);
                return { output: data?.ocs?.data ?? data };
            }

            default:
                throw new Error(`Unknown Nextcloud action: "${actionName}"`);
        }
    } catch (err: any) {
        logger?.log(`[Nextcloud] Error: ${err.message}`);
        return { error: err.message };
    }
}
