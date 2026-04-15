'use server';

export async function executeMongodbAtlasAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const dataApiBase = `https://data.mongodb-api.com/app/${inputs.appId}/endpoint/data/v1`;
        const adminApiBase = 'https://cloud.mongodb.com/api/atlas/v2';

        const dataRequest = async (action: string, body: any) => {
            const res = await fetch(`${dataApiBase}/action/${action}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': inputs.apiKey,
                },
                body: JSON.stringify({
                    dataSource: inputs.dataSource || inputs.cluster,
                    database: inputs.database,
                    collection: inputs.collection,
                    ...body,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || data.error_code || JSON.stringify(data));
            return data;
        };

        const adminRequest = async (method: string, path: string, body?: any) => {
            const encoded = Buffer.from(`${inputs.publicKey}:${inputs.privateKey}`).toString('base64');
            const res = await fetch(`${adminApiBase}${path}`, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${encoded}`,
                    'Accept': 'application/vnd.atlas.2023-01-01+json',
                },
                body: body !== undefined ? JSON.stringify(body) : undefined,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || data.errorCode || JSON.stringify(data));
            return data;
        };

        switch (actionName) {
            case 'findOne': {
                const data = await dataRequest('findOne', {
                    filter: inputs.filter || {},
                    projection: inputs.projection,
                });
                return { output: data };
            }
            case 'findMany': {
                const data = await dataRequest('find', {
                    filter: inputs.filter || {},
                    projection: inputs.projection,
                    sort: inputs.sort,
                    limit: inputs.limit,
                    skip: inputs.skip,
                });
                return { output: data };
            }
            case 'insertOne': {
                const data = await dataRequest('insertOne', { document: inputs.document });
                return { output: data };
            }
            case 'insertMany': {
                const data = await dataRequest('insertMany', { documents: inputs.documents });
                return { output: data };
            }
            case 'updateOne': {
                const data = await dataRequest('updateOne', {
                    filter: inputs.filter || {},
                    update: inputs.update,
                    upsert: inputs.upsert || false,
                });
                return { output: data };
            }
            case 'updateMany': {
                const data = await dataRequest('updateMany', {
                    filter: inputs.filter || {},
                    update: inputs.update,
                    upsert: inputs.upsert || false,
                });
                return { output: data };
            }
            case 'deleteOne': {
                const data = await dataRequest('deleteOne', { filter: inputs.filter || {} });
                return { output: data };
            }
            case 'deleteMany': {
                const data = await dataRequest('deleteMany', { filter: inputs.filter || {} });
                return { output: data };
            }
            case 'aggregate': {
                const data = await dataRequest('aggregate', { pipeline: inputs.pipeline || [] });
                return { output: data };
            }
            case 'runAtlasQuery': {
                const data = await dataRequest('find', {
                    filter: inputs.filter || {},
                    sort: inputs.sort,
                    limit: inputs.limit || 100,
                });
                return { output: data };
            }
            case 'listProjects': {
                const data = await adminRequest('GET', '/groups');
                return { output: data };
            }
            case 'listClusters': {
                const data = await adminRequest('GET', `/groups/${inputs.groupId || inputs.projectId}/clusters`);
                return { output: data };
            }
            case 'getCluster': {
                const data = await adminRequest('GET', `/groups/${inputs.groupId || inputs.projectId}/clusters/${inputs.clusterName}`);
                return { output: data };
            }
            case 'createCluster': {
                const data = await adminRequest('POST', `/groups/${inputs.groupId || inputs.projectId}/clusters`, inputs.clusterConfig);
                return { output: data };
            }
            case 'pauseCluster': {
                const data = await adminRequest('PATCH', `/groups/${inputs.groupId || inputs.projectId}/clusters/${inputs.clusterName}`, {
                    paused: inputs.paused !== false,
                });
                return { output: data };
            }
            default:
                return { error: `Unknown MongoDB Atlas action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`MongoDB Atlas action error [${actionName}]: ${err.message}`);
        return { error: err.message };
    }
}
