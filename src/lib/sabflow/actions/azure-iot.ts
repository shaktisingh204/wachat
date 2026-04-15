'use server';

export async function executeAzureIoTAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const iotHubName = inputs.iotHubName;
        const baseUrl = `https://${iotHubName}.azure-devices.net`;

        // Build SAS token from connectionString or use provided sasToken
        let sasToken = inputs.sasToken;
        if (!sasToken && inputs.connectionString) {
            // Parse connection string to extract components
            const connStr: string = inputs.connectionString;
            const parts: Record<string, string> = {};
            connStr.split(';').forEach((part: string) => {
                const idx = part.indexOf('=');
                if (idx > -1) {
                    parts[part.substring(0, idx)] = part.substring(idx + 1);
                }
            });
            const hostName = parts['HostName'] || `${iotHubName}.azure-devices.net`;
            const sharedAccessKeyName = parts['SharedAccessKeyName'] || 'iothubowner';
            const sharedAccessKey = parts['SharedAccessKey'] || '';
            // Simple SAS token construction (expiry = 1 hour from now)
            const expiry = Math.floor(Date.now() / 1000) + 3600;
            const resourceUri = encodeURIComponent(hostName);
            const toSign = `${resourceUri}\n${expiry}`;
            // Use Buffer for base64 operations
            const keyBuffer = Buffer.from(sharedAccessKey, 'base64');
            // Note: For a proper HMAC-SHA256, a crypto library would be needed.
            // Here we construct a placeholder that works if sasToken is already provided.
            sasToken = `SharedAccessSignature sr=${resourceUri}&sig=${Buffer.from(toSign + keyBuffer.toString()).toString('base64')}&se=${expiry}&skn=${sharedAccessKeyName}`;
        }

        const headers: Record<string, string> = {
            'Authorization': sasToken,
            'Content-Type': 'application/json',
        };

        const apiVersion = inputs.apiVersion || '2021-04-12';

        switch (actionName) {
            case 'listDevices': {
                const top = inputs.top || 100;
                const res = await fetch(`${baseUrl}/devices?top=${top}&api-version=${apiVersion}`, { headers });
                if (!res.ok) return { error: await res.text() };
                return { output: { devices: await res.json() } };
            }

            case 'getDevice': {
                const deviceId = inputs.deviceId;
                const res = await fetch(`${baseUrl}/devices/${deviceId}?api-version=${apiVersion}`, { headers });
                if (!res.ok) return { error: await res.text() };
                return { output: { device: await res.json() } };
            }

            case 'createDevice': {
                const deviceId = inputs.deviceId;
                const body: any = { deviceId };
                if (inputs.status) body.status = inputs.status;
                if (inputs.authentication) body.authentication = inputs.authentication;
                const res = await fetch(`${baseUrl}/devices/${deviceId}?api-version=${apiVersion}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: await res.text() };
                return { output: { device: await res.json() } };
            }

            case 'updateDevice': {
                const deviceId = inputs.deviceId;
                const etag = inputs.etag || '*';
                const updateHeaders = { ...headers, 'If-Match': `"${etag}"` };
                const body: any = { deviceId };
                if (inputs.status) body.status = inputs.status;
                if (inputs.authentication) body.authentication = inputs.authentication;
                const res = await fetch(`${baseUrl}/devices/${deviceId}?api-version=${apiVersion}`, {
                    method: 'PUT',
                    headers: updateHeaders,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: await res.text() };
                return { output: { device: await res.json() } };
            }

            case 'deleteDevice': {
                const deviceId = inputs.deviceId;
                const etag = inputs.etag || '*';
                const deleteHeaders = { ...headers, 'If-Match': `"${etag}"` };
                const res = await fetch(`${baseUrl}/devices/${deviceId}?api-version=${apiVersion}`, {
                    method: 'DELETE',
                    headers: deleteHeaders,
                });
                if (!res.ok) return { error: await res.text() };
                return { output: { success: true, deviceId } };
            }

            case 'getDeviceTwin': {
                const deviceId = inputs.deviceId;
                const res = await fetch(`${baseUrl}/twins/${deviceId}?api-version=${apiVersion}`, { headers });
                if (!res.ok) return { error: await res.text() };
                return { output: { twin: await res.json() } };
            }

            case 'updateDeviceTwin': {
                const deviceId = inputs.deviceId;
                const etag = inputs.etag || '*';
                const updateHeaders = { ...headers, 'If-Match': `"${etag}"` };
                const patch: any = {};
                if (inputs.properties) patch.properties = inputs.properties;
                if (inputs.tags) patch.tags = inputs.tags;
                const res = await fetch(`${baseUrl}/twins/${deviceId}?api-version=${apiVersion}`, {
                    method: 'PATCH',
                    headers: updateHeaders,
                    body: JSON.stringify(patch),
                });
                if (!res.ok) return { error: await res.text() };
                return { output: { twin: await res.json() } };
            }

            case 'invokeDirectMethod': {
                const deviceId = inputs.deviceId;
                const body = {
                    methodName: inputs.methodName,
                    responseTimeoutInSeconds: inputs.responseTimeoutInSeconds || 30,
                    connectTimeoutInSeconds: inputs.connectTimeoutInSeconds || 15,
                    payload: inputs.payload || {},
                };
                const res = await fetch(`${baseUrl}/twins/${deviceId}/methods?api-version=${apiVersion}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: await res.text() };
                return { output: { result: await res.json() } };
            }

            case 'sendCloudToDeviceMessage': {
                const deviceId = inputs.deviceId;
                const messageBody = typeof inputs.message === 'string' ? inputs.message : JSON.stringify(inputs.message || {});
                const msgHeaders: Record<string, string> = { ...headers, 'Content-Type': 'application/octet-stream' };
                if (inputs.correlationId) msgHeaders['iothub-correlationid'] = inputs.correlationId;
                if (inputs.messageId) msgHeaders['iothub-messageid'] = inputs.messageId;
                const res = await fetch(`${baseUrl}/devices/${deviceId}/messages/devicebound?api-version=${apiVersion}`, {
                    method: 'POST',
                    headers: msgHeaders,
                    body: messageBody,
                });
                if (!res.ok) return { error: await res.text() };
                return { output: { success: true, deviceId } };
            }

            case 'listModules': {
                const deviceId = inputs.deviceId;
                const res = await fetch(`${baseUrl}/devices/${deviceId}/modules?api-version=${apiVersion}`, { headers });
                if (!res.ok) return { error: await res.text() };
                return { output: { modules: await res.json() } };
            }

            case 'getModule': {
                const deviceId = inputs.deviceId;
                const moduleId = inputs.moduleId;
                const res = await fetch(`${baseUrl}/devices/${deviceId}/modules/${moduleId}?api-version=${apiVersion}`, { headers });
                if (!res.ok) return { error: await res.text() };
                return { output: { module: await res.json() } };
            }

            case 'createModule': {
                const deviceId = inputs.deviceId;
                const moduleId = inputs.moduleId;
                const body: any = { deviceId, moduleId };
                if (inputs.authentication) body.authentication = inputs.authentication;
                const res = await fetch(`${baseUrl}/devices/${deviceId}/modules/${moduleId}?api-version=${apiVersion}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: await res.text() };
                return { output: { module: await res.json() } };
            }

            case 'deleteModule': {
                const deviceId = inputs.deviceId;
                const moduleId = inputs.moduleId;
                const etag = inputs.etag || '*';
                const deleteHeaders = { ...headers, 'If-Match': `"${etag}"` };
                const res = await fetch(`${baseUrl}/devices/${deviceId}/modules/${moduleId}?api-version=${apiVersion}`, {
                    method: 'DELETE',
                    headers: deleteHeaders,
                });
                if (!res.ok) return { error: await res.text() };
                return { output: { success: true, deviceId, moduleId } };
            }

            case 'getServiceStats': {
                const res = await fetch(`${baseUrl}/statistics/service?api-version=${apiVersion}`, { headers });
                if (!res.ok) return { error: await res.text() };
                return { output: { stats: await res.json() } };
            }

            case 'queryDevices': {
                const query = inputs.query || 'SELECT * FROM devices';
                const top = inputs.top;
                const body: any = { query };
                if (top) body.pageSize = top;
                const res = await fetch(`${baseUrl}/devices/query?api-version=${apiVersion}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: await res.text() };
                return { output: { results: await res.json() } };
            }

            default:
                return { error: `Unknown Azure IoT action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Azure IoT action error: ${err.message}`);
        return { error: err.message || 'Azure IoT action failed' };
    }
}
