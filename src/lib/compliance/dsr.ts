/**
 * GDPR data-subject request handler.
 *
 *   - `exportData`  →  Article 15 (right of access) + Article 20
 *                      (right to portability).  Returns a ZIP-of-JSON
 *                      Buffer suitable for email delivery or signed-URL
 *                      download.
 *   - `eraseData`   →  Article 17 (right to erasure).  Marks records
 *                      for tombstone — physical deletion is performed
 *                      by `applyRetention()` once the legal-hold and
 *                      TTL clock allow it.
 *
 * The set of collections to traverse is *configurable per tenant* via
 * the `dsr_subject_index` collection.  This avoids hard-coding the
 * SabNode data-model into the compliance package and lets future
 * modules opt-in by registering their own pointer documents.
 */

import { deflateRawSync } from 'node:zlib';

/* ── Subject index ──────────────────────────────────────────────────── */

/**
 * Pointer document indicating "tenant `T`'s subject `S` is referenced
 * in collection `C` under field `F`".  Each module registers one row
 * per (collection, field) pair.
 */
export interface SubjectIndexEntry {
    tenantId: string;
    subjectId: string;
    collection: string;
    /** Field on the target collection holding `subjectId`. */
    field: string;
}

const SUBJECT_INDEX_COLLECTION = 'dsr_subject_index';

/* ── ZIP-of-JSON builder ────────────────────────────────────────────── */

/**
 * Build a *valid*, *deterministic* ZIP archive entirely in-memory.
 * We avoid pulling in a full ZIP library (and its native deps) because
 * the only thing we need to produce is a flat archive of JSON files.
 *
 * Each entry uses STORE (method 0) when smaller, or DEFLATE (method 8).
 *
 * The implementation follows APPNOTE.TXT 6.3.10:
 *   - Local file headers      (LFH)
 *   - Central directory entries (CDE)
 *   - End-of-central-directory record (EOCD)
 */
const SIG_LFH = 0x04034b50;
const SIG_CDE = 0x02014b50;
const SIG_EOCD = 0x06054b50;

function crc32(buf: Buffer): number {
    let c: number;
    const table: number[] = [];
    for (let n = 0; n < 256; n++) {
        c = n;
        for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[n] = c >>> 0;
    }
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
        crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
    name: string;
    data: Buffer;
}

/**
 * Build a flat ZIP archive.  Exposed so tests can verify portability
 * without booting a full Mongo instance.
 */
export function buildZip(entries: ZipEntry[]): Buffer {
    const localParts: Buffer[] = [];
    const centralParts: Buffer[] = [];
    let offset = 0;
    const epoch = { date: 0x21, time: 0x00 }; // 1980-01-01 00:00:00

    for (const entry of entries) {
        const nameBuf = Buffer.from(entry.name, 'utf8');
        const raw = entry.data;
        const deflated = deflateRawSync(raw);
        const useDeflate = deflated.length < raw.length;
        const stored = useDeflate ? deflated : raw;
        const method = useDeflate ? 8 : 0;
        const crc = crc32(raw);

        // Local file header.
        const lfh = Buffer.alloc(30);
        lfh.writeUInt32LE(SIG_LFH, 0);
        lfh.writeUInt16LE(20, 4); // version needed
        lfh.writeUInt16LE(0, 6); // general purpose bit flag
        lfh.writeUInt16LE(method, 8);
        lfh.writeUInt16LE(epoch.time, 10);
        lfh.writeUInt16LE(epoch.date, 12);
        lfh.writeUInt32LE(crc, 14);
        lfh.writeUInt32LE(stored.length, 18);
        lfh.writeUInt32LE(raw.length, 22);
        lfh.writeUInt16LE(nameBuf.length, 26);
        lfh.writeUInt16LE(0, 28);

        localParts.push(lfh, nameBuf, stored);

        // Central directory entry.
        const cde = Buffer.alloc(46);
        cde.writeUInt32LE(SIG_CDE, 0);
        cde.writeUInt16LE(20, 4); // version made by
        cde.writeUInt16LE(20, 6); // version needed
        cde.writeUInt16LE(0, 8);
        cde.writeUInt16LE(method, 10);
        cde.writeUInt16LE(epoch.time, 12);
        cde.writeUInt16LE(epoch.date, 14);
        cde.writeUInt32LE(crc, 16);
        cde.writeUInt32LE(stored.length, 20);
        cde.writeUInt32LE(raw.length, 24);
        cde.writeUInt16LE(nameBuf.length, 28);
        cde.writeUInt16LE(0, 30);
        cde.writeUInt16LE(0, 32);
        cde.writeUInt16LE(0, 34);
        cde.writeUInt16LE(0, 36);
        cde.writeUInt32LE(0, 38);
        cde.writeUInt32LE(offset, 42);

        centralParts.push(cde, nameBuf);
        offset += lfh.length + nameBuf.length + stored.length;
    }

    const central = Buffer.concat(centralParts);
    const localBlock = Buffer.concat(localParts);

    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(SIG_EOCD, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(entries.length, 8);
    eocd.writeUInt16LE(entries.length, 10);
    eocd.writeUInt32LE(central.length, 12);
    eocd.writeUInt32LE(localBlock.length, 16);
    eocd.writeUInt16LE(0, 20);

    return Buffer.concat([localBlock, central, eocd]);
}

/* ── Public API ─────────────────────────────────────────────────────── */

/**
 * Export every record we hold for `subjectId` within `tenantId`.
 *
 * Returns a ZIP buffer whose layout is:
 *   /manifest.json                    — metadata + collection counts
 *   /<collection>.json                — array of records
 */
export async function exportData(
    tenantId: string,
    subjectId: string,
): Promise<Buffer> {
    const mod: typeof import('../mongodb') = await import('../mongodb');
    const { db } = await mod.connectToDatabase();

    const pointers = await db
        .collection<SubjectIndexEntry>(SUBJECT_INDEX_COLLECTION)
        .find({ tenantId, subjectId })
        .toArray();

    const grouped = new Map<string, SubjectIndexEntry[]>();
    for (const p of pointers) {
        const list = grouped.get(p.collection) ?? [];
        list.push(p);
        grouped.set(p.collection, list);
    }

    const entries: ZipEntry[] = [];
    const counts: Record<string, number> = {};

    for (const [collection, ptrs] of grouped) {
        const orClauses = ptrs.map((p) => ({ [p.field]: subjectId }));
        const records = await db
            .collection(collection)
            .find({ tenantId, $or: orClauses })
            .toArray();
        counts[collection] = records.length;
        entries.push({
            name: `${collection}.json`,
            data: Buffer.from(JSON.stringify(records, null, 2), 'utf8'),
        });
    }

    const manifest = {
        tenantId,
        subjectId,
        generatedAt: new Date().toISOString(),
        articles: ['GDPR-Art15', 'GDPR-Art20'],
        counts,
    };

    entries.unshift({
        name: 'manifest.json',
        data: Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'),
    });

    return buildZip(entries);
}

/**
 * Mark every record we hold for `subjectId` for tombstone.  We do not
 * physically delete here — physical removal is the responsibility of
 * `applyRetention()`, which respects legal holds and TTLs.
 */
export async function eraseData(
    tenantId: string,
    subjectId: string,
): Promise<{ tombstoned: Record<string, number> }> {
    const mod: typeof import('../mongodb') = await import('../mongodb');
    const { db } = await mod.connectToDatabase();

    const pointers = await db
        .collection<SubjectIndexEntry>(SUBJECT_INDEX_COLLECTION)
        .find({ tenantId, subjectId })
        .toArray();

    const grouped = new Map<string, SubjectIndexEntry[]>();
    for (const p of pointers) {
        const list = grouped.get(p.collection) ?? [];
        list.push(p);
        grouped.set(p.collection, list);
    }

    const tombstoned: Record<string, number> = {};
    const now = new Date().toISOString();

    for (const [collection, ptrs] of grouped) {
        const orClauses = ptrs.map((p) => ({ [p.field]: subjectId }));
        const res = await db.collection(collection).updateMany(
            { tenantId, $or: orClauses, deletedAt: { $exists: false } },
            {
                $set: {
                    deletedAt: now,
                    deletedReason: 'gdpr_art17',
                },
            },
        );
        tombstoned[collection] = res.modifiedCount ?? 0;
    }

    return { tombstoned };
}

/** Exposed for tests. */
export const __internals = {
    SUBJECT_INDEX_COLLECTION,
    buildZip,
    crc32,
};
