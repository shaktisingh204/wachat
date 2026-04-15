
'use server';

export async function executeFirebaseAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        const projectId = String(inputs.projectId ?? '').trim();

        const authHeaders = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        };

        const firestoreBase = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

        async function firestoreFetch(method: string, url: string, body?: any) {
            logger?.log(`[Firebase Firestore] ${method} ${url}`);
            const options: RequestInit = { method, headers: authHeaders };
            if (body !== undefined) options.body = JSON.stringify(body);
            const res = await fetch(url, options);
            if (res.status === 204) return {};
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.error?.message || `Firebase API error: ${res.status}`);
            return data;
        }

        switch (actionName) {
            case 'listDocuments': {
                const collection = String(inputs.collection ?? '').trim();
                if (!collection) throw new Error('collection is required.');
                const pageSize = inputs.pageSize ? `?pageSize=${inputs.pageSize}` : '';
                const data = await firestoreFetch('GET', `${firestoreBase}/${collection}${pageSize}`);
                return { output: data };
            }
            case 'getDocument': {
                const collection = String(inputs.collection ?? '').trim();
                const docId = String(inputs.docId ?? '').trim();
                if (!collection || !docId) throw new Error('collection and docId are required.');
                const data = await firestoreFetch('GET', `${firestoreBase}/${collection}/${docId}`);
                return { output: data };
            }
            case 'createDocument': {
                const collection = String(inputs.collection ?? '').trim();
                if (!collection) throw new Error('collection is required.');
                const fields = inputs.fields
                    ? (typeof inputs.fields === 'string' ? JSON.parse(inputs.fields) : inputs.fields)
                    : {};
                const data = await firestoreFetch('POST', `${firestoreBase}/${collection}`, { fields });
                return { output: data };
            }
            case 'updateDocument': {
                const collection = String(inputs.collection ?? '').trim();
                const docId = String(inputs.docId ?? '').trim();
                if (!collection || !docId) throw new Error('collection and docId are required.');
                const fields = inputs.fields
                    ? (typeof inputs.fields === 'string' ? JSON.parse(inputs.fields) : inputs.fields)
                    : {};
                const updateMask = inputs.updateMask ? `?${inputs.updateMask.split(',').map((f: string) => `updateMask.fieldPaths=${f.trim()}`).join('&')}` : '';
                const data = await firestoreFetch('PATCH', `${firestoreBase}/${collection}/${docId}${updateMask}`, { fields });
                return { output: data };
            }
            case 'deleteDocument': {
                const collection = String(inputs.collection ?? '').trim();
                const docId = String(inputs.docId ?? '').trim();
                if (!collection || !docId) throw new Error('collection and docId are required.');
                await firestoreFetch('DELETE', `${firestoreBase}/${collection}/${docId}`);
                return { output: { success: true } };
            }
            case 'runQuery': {
                const structuredQuery = inputs.structuredQuery
                    ? (typeof inputs.structuredQuery === 'string' ? JSON.parse(inputs.structuredQuery) : inputs.structuredQuery)
                    : {};
                const data = await firestoreFetch('POST', `${firestoreBase}:runQuery`, { structuredQuery });
                return { output: data };
            }
            case 'sendFcmNotification': {
                const token = String(inputs.token ?? '').trim();
                const title = String(inputs.title ?? '').trim();
                const body = String(inputs.body ?? '').trim();
                const messageData = inputs.data
                    ? (typeof inputs.data === 'string' ? JSON.parse(inputs.data) : inputs.data)
                    : undefined;
                if (!token) throw new Error('token is required.');
                const message: any = { token, notification: { title, body } };
                if (messageData) message.data = messageData;
                const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
                const data = await firestoreFetch('POST', url, { message });
                return { output: data };
            }
            case 'sendFcmToTopic': {
                const topic = String(inputs.topic ?? '').trim();
                const title = String(inputs.title ?? '').trim();
                const body = String(inputs.body ?? '').trim();
                const messageData = inputs.data
                    ? (typeof inputs.data === 'string' ? JSON.parse(inputs.data) : inputs.data)
                    : undefined;
                if (!topic) throw new Error('topic is required.');
                const message: any = { topic, notification: { title, body } };
                if (messageData) message.data = messageData;
                const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
                const data = await firestoreFetch('POST', url, { message });
                return { output: data };
            }
            case 'listUsers': {
                const url = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:query`;
                const data = await firestoreFetch('GET', url);
                return { output: data };
            }
            case 'createUser': {
                const email = String(inputs.email ?? '').trim();
                const password = String(inputs.password ?? '').trim();
                if (!email) throw new Error('email is required.');
                const payload: any = { email };
                if (password) payload.password = password;
                if (inputs.displayName) payload.displayName = inputs.displayName;
                const url = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts`;
                const data = await firestoreFetch('POST', url, payload);
                return { output: data };
            }
            case 'updateUser': {
                const localId = String(inputs.localId ?? '').trim();
                if (!localId) throw new Error('localId is required.');
                const payload: any = { localId };
                if (inputs.email) payload.email = inputs.email;
                if (inputs.displayName) payload.displayName = inputs.displayName;
                if (inputs.disabled !== undefined) payload.disableUser = inputs.disabled;
                const url = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`;
                const data = await firestoreFetch('POST', url, payload);
                return { output: data };
            }
            case 'deleteUser': {
                const localId = String(inputs.localId ?? '').trim();
                if (!localId) throw new Error('localId is required.');
                const url = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:delete`;
                const data = await firestoreFetch('POST', url, { localId });
                return { output: data };
            }
            case 'verifyIdToken': {
                const idToken = String(inputs.idToken ?? '').trim();
                if (!idToken) throw new Error('idToken is required.');
                const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup`;
                logger?.log(`[Firebase] POST ${url}`);
                const res = await fetch(url, {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify({ idToken }),
                });
                const text = await res.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = { raw: text }; }
                if (!res.ok) throw new Error(data?.error?.message || `Firebase API error: ${res.status}`);
                return { output: data };
            }
            case 'getRealtimeData': {
                const path = String(inputs.path ?? '').trim();
                const dbSecret = String(inputs.dbSecret ?? '').trim();
                if (!path) throw new Error('path is required.');
                const url = `https://${projectId}-default-rtdb.firebaseio.com/${path}.json?auth=${dbSecret}`;
                logger?.log(`[Firebase RTDB] GET ${url}`);
                const res = await fetch(url, { method: 'GET' });
                const text = await res.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = { raw: text }; }
                if (!res.ok) throw new Error(data?.error || `Firebase RTDB error: ${res.status}`);
                return { output: { data } };
            }
            case 'setRealtimeData': {
                const path = String(inputs.path ?? '').trim();
                const dbSecret = String(inputs.dbSecret ?? '').trim();
                const value = inputs.value
                    ? (typeof inputs.value === 'string' ? JSON.parse(inputs.value) : inputs.value)
                    : {};
                if (!path) throw new Error('path is required.');
                const url = `https://${projectId}-default-rtdb.firebaseio.com/${path}.json?auth=${dbSecret}`;
                logger?.log(`[Firebase RTDB] PUT ${url}`);
                const res = await fetch(url, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(value),
                });
                const text = await res.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = { raw: text }; }
                if (!res.ok) throw new Error(data?.error || `Firebase RTDB error: ${res.status}`);
                return { output: { data } };
            }
            default:
                throw new Error(`Unknown Firebase action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[Firebase] Error: ${err.message}`);
        return { error: err.message || 'Firebase action failed.' };
    }
}
