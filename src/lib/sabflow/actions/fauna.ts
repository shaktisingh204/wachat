'use server';

export async function executeFaunaAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const secretKey = inputs.secretKey || '';
        const graphqlEndpoint = 'https://graphql.fauna.com/graphql';
        const fqlEndpoint = 'https://db.fauna.com/query/1';

        const authHeaders: Record<string, string> = {
            'Authorization': `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
        };

        const fqlPost = async (query: string, arguments_?: any) => {
            const body: any = { query };
            if (arguments_) body.arguments = arguments_;
            const res = await fetch(fqlEndpoint, {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Fauna FQL error ${res.status}: ${text}`);
            }
            return res.json();
        };

        const graphqlPost = async (query: string, variables?: any) => {
            const body: any = { query };
            if (variables) body.variables = variables;
            const res = await fetch(graphqlEndpoint, {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Fauna GraphQL error ${res.status}: ${text}`);
            }
            return res.json();
        };

        switch (actionName) {
            case 'query': {
                const result = await fqlPost(inputs.query, inputs.arguments);
                return { output: result };
            }

            case 'createDocument': {
                const query = `Collection("${inputs.collection}").create(${JSON.stringify(inputs.data)})`;
                const result = await fqlPost(query);
                return { output: result };
            }

            case 'readDocument': {
                const query = `Collection("${inputs.collection}").byId("${inputs.id}").first()`;
                const result = await fqlPost(query);
                return { output: result };
            }

            case 'updateDocument': {
                const query = `Collection("${inputs.collection}").byId("${inputs.id}").first().update(${JSON.stringify(inputs.data)})`;
                const result = await fqlPost(query);
                return { output: result };
            }

            case 'deleteDocument': {
                const query = `Collection("${inputs.collection}").byId("${inputs.id}").first().delete()`;
                const result = await fqlPost(query);
                return { output: result };
            }

            case 'listDocuments': {
                const pageSize = inputs.pageSize || 64;
                const query = `Collection("${inputs.collection}").all().paginate(${pageSize})`;
                const result = await fqlPost(query);
                return { output: result };
            }

            case 'createCollection': {
                const query = `Collection.create({ name: "${inputs.name}"${inputs.ttl_days ? `, ttl_days: ${inputs.ttl_days}` : ''} })`;
                const result = await fqlPost(query);
                return { output: result };
            }

            case 'listCollections': {
                const result = await fqlPost('Collection.all().paginate(64)');
                return { output: result };
            }

            case 'createIndex': {
                const query = `Collection("${inputs.collection}").index.create({ name: "${inputs.name}", terms: ${JSON.stringify(inputs.terms || [])}, values: ${JSON.stringify(inputs.values || [])} })`;
                const result = await fqlPost(query);
                return { output: result };
            }

            case 'listIndexes': {
                const result = await fqlPost(`Collection("${inputs.collection}").indexes()`);
                return { output: result };
            }

            case 'paginateIndex': {
                const pageSize = inputs.pageSize || 64;
                const afterCursor = inputs.after ? `, after: "${inputs.after}"` : '';
                const query = `Collection("${inputs.collection}").byIndex("${inputs.index}").paginate(${pageSize}${afterCursor})`;
                const result = await fqlPost(query);
                return { output: result };
            }

            case 'callFunction': {
                const argsStr = inputs.arguments ? JSON.stringify(inputs.arguments) : '{}';
                const query = `Function("${inputs.functionName}").call(${argsStr})`;
                const result = await fqlPost(query);
                return { output: result };
            }

            case 'createFunction': {
                const query = `Function.create({ name: "${inputs.name}", body: ${inputs.body}${inputs.role ? `, role: "${inputs.role}"` : ''} })`;
                const result = await fqlPost(query);
                return { output: result };
            }

            case 'listFunctions': {
                const result = await fqlPost('Function.all().paginate(64)');
                return { output: result };
            }

            case 'createDatabase': {
                const query = `Database.create({ name: "${inputs.name}"${inputs.protected ? ', protected: true' : ''} })`;
                const result = await fqlPost(query);
                return { output: result };
            }

            default:
                logger.log(`Fauna: Unknown action "${actionName}"`);
                return { error: `Unknown Fauna action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Fauna action error: ${err.message}`);
        return { error: err.message || 'Unknown Fauna error' };
    }
}
