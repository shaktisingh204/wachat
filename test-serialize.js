const { ObjectId } = require('mongodb');
const obj = { _id: new ObjectId(), nested: { _id: new ObjectId(), date: new Date() }, arr: [new ObjectId()] };

function serializeMongoDoc(doc) {
    if (doc === null || doc === undefined) return doc;
    if (Array.isArray(doc)) return doc.map(serializeMongoDoc);
    if (doc instanceof Date) return doc.toISOString(); // Or leave as Date since Next.js supports Date
    if (typeof doc === 'object') {
        if (doc.toHexString) return doc.toHexString();
        if (doc.toString && typeof doc._bsontype === 'string' && doc._bsontype === 'ObjectId') return doc.toString(); // For mongodb ObjectId
        const newDoc = {};
        for (const key in doc) {
            newDoc[key] = serializeMongoDoc(doc[key]);
        }
        return newDoc;
    }
    return doc;
}

console.log(serializeMongoDoc(obj));
