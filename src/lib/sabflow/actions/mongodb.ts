
'use server';

function buildMongoConnectionString(inputs: any): string {
    const connectionString = String(inputs.connectionString ?? '').trim();
    if (connectionString) return connectionString;

    const host = String(inputs.host ?? 'localhost').trim();
    const port = String(inputs.port ?? '27017').trim();
    const database = String(inputs.database ?? '').trim();
    const username = String(inputs.username ?? '').trim();
    const password = String(inputs.password ?? '').trim();

    if (username && password) {
        return `mongodb://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
    }
    return `mongodb://${host}:${port}/${database}`;
}

function parseJson(value: any, fieldName: string): any {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(String(value));
    } catch {
        throw new Error(`"${fieldName}" must be valid JSON.`);
    }
}

export async function executeMongodbAction(
    actionName: string,
    inputs: any,
    _user: any,
    logger: any
) {
    let client: any = null;
    try {
        const connectionString = buildMongoConnectionString(inputs);
        if (!connectionString || connectionString === 'mongodb://localhost:27017/') {
            throw new Error('connectionString or host+database are required.');
        }

        const { MongoClient } = await import('mongodb');
        client = new MongoClient(connectionString, { serverSelectionTimeoutMS: 10000 });
        await client.connect();

        // Resolve the database name: from URL or explicit input
        const dbName = String(inputs.database ?? '').trim() || undefined;
        const db = client.db(dbName);

        switch (actionName) {
            case 'findDocuments': {
                const collection = String(inputs.collection ?? '').trim();
                if (!collection) throw new Error('"collection" is required.');
                const filter = parseJson(inputs.filter, 'filter') ?? {};
                const limit = Math.min(Number(inputs.limit ?? 100), 10000);
                logger.log(`[MongoDB] findDocuments in "${collection}"`, { filter, limit });
                const docs = await db.collection(collection).find(filter).limit(limit).toArray();
                return { output: { documents: docs, count: docs.length } };
            }

            case 'findOne': {
                const collection = String(inputs.collection ?? '').trim();
                if (!collection) throw new Error('"collection" is required.');
                const filter = parseJson(inputs.filter, 'filter') ?? {};
                logger.log(`[MongoDB] findOne in "${collection}"`, { filter });
                const doc = await db.collection(collection).findOne(filter);
                return { output: { document: doc, found: doc !== null } };
            }

            case 'insertOne': {
                const collection = String(inputs.collection ?? '').trim();
                if (!collection) throw new Error('"collection" is required.');
                const document = parseJson(inputs.document, 'document');
                if (!document || typeof document !== 'object' || Array.isArray(document)) {
                    throw new Error('"document" must be a valid JSON object.');
                }
                logger.log(`[MongoDB] insertOne into "${collection}"`);
                const result = await db.collection(collection).insertOne(document);
                return { output: { insertedId: String(result.insertedId), acknowledged: result.acknowledged } };
            }

            case 'insertMany': {
                const collection = String(inputs.collection ?? '').trim();
                if (!collection) throw new Error('"collection" is required.');
                const documents = parseJson(inputs.documents, 'documents');
                if (!Array.isArray(documents)) throw new Error('"documents" must be a JSON array.');
                logger.log(`[MongoDB] insertMany into "${collection}" (${documents.length} docs)`);
                const result = await db.collection(collection).insertMany(documents);
                return {
                    output: {
                        insertedCount: result.insertedCount,
                        acknowledged: result.acknowledged,
                        insertedIds: Object.values(result.insertedIds).map(String),
                    },
                };
            }

            case 'updateOne': {
                const collection = String(inputs.collection ?? '').trim();
                if (!collection) throw new Error('"collection" is required.');
                const filter = parseJson(inputs.filter, 'filter') ?? {};
                const update = parseJson(inputs.update, 'update');
                if (!update) throw new Error('"update" is required.');
                logger.log(`[MongoDB] updateOne in "${collection}"`, { filter });
                const result = await db.collection(collection).updateOne(filter, update);
                return {
                    output: {
                        matchedCount: result.matchedCount,
                        modifiedCount: result.modifiedCount,
                        acknowledged: result.acknowledged,
                    },
                };
            }

            case 'updateMany': {
                const collection = String(inputs.collection ?? '').trim();
                if (!collection) throw new Error('"collection" is required.');
                const filter = parseJson(inputs.filter, 'filter') ?? {};
                const update = parseJson(inputs.update, 'update');
                if (!update) throw new Error('"update" is required.');
                logger.log(`[MongoDB] updateMany in "${collection}"`, { filter });
                const result = await db.collection(collection).updateMany(filter, update);
                return {
                    output: {
                        matchedCount: result.matchedCount,
                        modifiedCount: result.modifiedCount,
                        acknowledged: result.acknowledged,
                    },
                };
            }

            case 'deleteOne': {
                const collection = String(inputs.collection ?? '').trim();
                if (!collection) throw new Error('"collection" is required.');
                const filter = parseJson(inputs.filter, 'filter') ?? {};
                logger.log(`[MongoDB] deleteOne in "${collection}"`, { filter });
                const result = await db.collection(collection).deleteOne(filter);
                return { output: { deletedCount: result.deletedCount, acknowledged: result.acknowledged } };
            }

            case 'deleteMany': {
                const collection = String(inputs.collection ?? '').trim();
                if (!collection) throw new Error('"collection" is required.');
                const filter = parseJson(inputs.filter, 'filter') ?? {};
                logger.log(`[MongoDB] deleteMany in "${collection}"`, { filter });
                const result = await db.collection(collection).deleteMany(filter);
                return { output: { deletedCount: result.deletedCount, acknowledged: result.acknowledged } };
            }

            case 'countDocuments': {
                const collection = String(inputs.collection ?? '').trim();
                if (!collection) throw new Error('"collection" is required.');
                const filter = parseJson(inputs.filter, 'filter') ?? {};
                logger.log(`[MongoDB] countDocuments in "${collection}"`, { filter });
                const count = await db.collection(collection).countDocuments(filter);
                return { output: { count } };
            }

            case 'aggregate': {
                const collection = String(inputs.collection ?? '').trim();
                if (!collection) throw new Error('"collection" is required.');
                const pipeline = parseJson(inputs.pipeline, 'pipeline');
                if (!Array.isArray(pipeline)) throw new Error('"pipeline" must be a JSON array.');
                logger.log(`[MongoDB] aggregate on "${collection}" (${pipeline.length} stages)`);
                const results = await db.collection(collection).aggregate(pipeline).toArray();
                return { output: { results, count: results.length } };
            }

            case 'createCollection': {
                const collectionName = String(inputs.collectionName ?? '').trim();
                if (!collectionName) throw new Error('"collectionName" is required.');
                logger.log(`[MongoDB] createCollection "${collectionName}"`);
                await db.createCollection(collectionName);
                return { output: { created: true, collectionName } };
            }

            case 'dropCollection': {
                const collectionName = String(inputs.collectionName ?? '').trim();
                if (!collectionName) throw new Error('"collectionName" is required.');
                logger.log(`[MongoDB] dropCollection "${collectionName}"`);
                const dropped = await db.collection(collectionName).drop();
                return { output: { dropped, collectionName } };
            }

            default:
                return { error: `MongoDB action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        const msg = e.message || 'MongoDB action failed.';
        logger.log(`[MongoDB] Error in "${actionName}": ${msg}`);
        return { error: msg };
    } finally {
        if (client) {
            try {
                await client.close();
            } catch {
                // ignore close errors
            }
        }
    }
}
