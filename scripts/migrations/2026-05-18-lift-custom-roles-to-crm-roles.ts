/**
 * Migration: lift embedded `users.<tenantId>.crm.customRoles[]` (+
 * `crm.permissions`) into the top-level `crm_roles` collection that the
 * Rust crate (`rust/crates/crm-roles`) reads from.
 *
 * Fork being closed: the TS action persists roles inside the tenant `users`
 * doc; the Rust handlers read/write a separate `crm_roles` collection. Cutting
 * over to Rust today returns an empty role list per tenant — data loss in the
 * UI even though Mongo is intact.
 *
 * Approach: additive copy. For each tenant we insert one `crm_roles` doc per
 * embedded role, mapping `tenantUserId -> userId`, deriving a slug, and
 * lifting that role's slice out of `crm.permissions` into the new
 * `permissions` map. Idempotent via `(userId, slug)` skip.
 *
 * Rollback: `crm_roles` is additive — the embedded array under
 * `users.<tid>.crm` is left untouched. To revert, drop the inserted docs:
 *   db.crm_roles.deleteMany({ _migratedFrom: 'users.crm.customRoles' })
 *
 * Run:
 *   tsx scripts/migrations/2026-05-18-lift-custom-roles-to-crm-roles.ts            # dry-run
 *   tsx scripts/migrations/2026-05-18-lift-custom-roles-to-crm-roles.ts --execute  # write
 */

import { connectToDatabase } from '../../src/lib/mongodb';
import { ObjectId } from 'mongodb';

type PermFlagBlock = {
    view?: boolean;
    create?: boolean;
    edit?: boolean;
    delete?: boolean;
};

type EmbeddedRole = {
    id: string;
    name: string;
};

interface TenantUserDoc {
    _id: ObjectId;
    crm?: {
        customRoles?: EmbeddedRole[];
        permissions?: Record<string, Record<string, PermFlagBlock>>;
    };
}

interface Summary {
    tenantsScanned: number;
    rolesInserted: number;
    rolesSkipped: number;
}

function slugify(raw: string): string {
    let out = '';
    let lastHyphen = true;
    for (const ch of raw) {
        if (/[a-zA-Z0-9]/.test(ch)) {
            out += ch.toLowerCase();
            lastHyphen = false;
        } else if (!lastHyphen) {
            out += '-';
            lastHyphen = true;
        }
    }
    return out.replace(/^-+|-+$/g, '');
}

function normalizeFlags(raw: PermFlagBlock | undefined): {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
} {
    return {
        view: Boolean(raw?.view),
        create: Boolean(raw?.create),
        edit: Boolean(raw?.edit),
        delete: Boolean(raw?.delete),
    };
}

async function run(execute: boolean): Promise<Summary> {
    const summary: Summary = {
        tenantsScanned: 0,
        rolesInserted: 0,
        rolesSkipped: 0,
    };

    console.log(`[lift-custom-roles] mode=${execute ? 'EXECUTE' : 'DRY-RUN'}`);
    const { db } = await connectToDatabase();
    const usersCol = db.collection<TenantUserDoc>('users');
    const rolesCol = db.collection('crm_roles');

    const cursor = usersCol.find(
        { 'crm.customRoles.0': { $exists: true } },
        { projection: { _id: 1, 'crm.customRoles': 1, 'crm.permissions': 1 } },
    );

    while (await cursor.hasNext()) {
        const user = await cursor.next();
        if (!user) break;
        summary.tenantsScanned += 1;

        const tenantUserId = user._id;
        const roles = user.crm?.customRoles ?? [];
        const permMap = user.crm?.permissions ?? {};

        // Track slugs we've assigned within this tenant in this run so a
        // collision inside the same embedded array (rare) doesn't blow up the
        // unique-skip check.
        const seenSlugsThisTenant = new Set<string>();

        for (const role of roles) {
            if (!role || !role.name) {
                summary.rolesSkipped += 1;
                continue;
            }

            const slug = slugify(role.name) || slugify(role.id || 'role');
            if (!slug) {
                summary.rolesSkipped += 1;
                continue;
            }

            if (seenSlugsThisTenant.has(slug)) {
                summary.rolesSkipped += 1;
                continue;
            }

            const existing = await rolesCol.findOne(
                { userId: tenantUserId, slug },
                { projection: { _id: 1 } },
            );
            if (existing) {
                summary.rolesSkipped += 1;
                seenSlugsThisTenant.add(slug);
                continue;
            }

            const rolePerms = permMap[role.id] || permMap[slug] || {};
            const permissions: Record<
                string,
                { view: boolean; create: boolean; edit: boolean; delete: boolean }
            > = {};
            for (const [moduleKey, flags] of Object.entries(rolePerms)) {
                permissions[moduleKey] = normalizeFlags(flags);
            }

            const now = new Date();
            const doc = {
                userId: tenantUserId,
                name: role.name,
                slug,
                displayName: role.name,
                isAdmin: false,
                permissions,
                status: 'active',
                createdAt: now,
                updatedAt: now,
                _migratedFrom: 'users.crm.customRoles',
                _migratedRoleId: role.id,
            };

            if (execute) {
                await rolesCol.insertOne(doc);
            } else {
                console.log(
                    `[lift-custom-roles] would insert tenant=${tenantUserId.toHexString()} slug=${slug} name=${JSON.stringify(role.name)} permModules=${Object.keys(permissions).length}`,
                );
            }
            summary.rolesInserted += 1;
            seenSlugsThisTenant.add(slug);
        }
    }

    console.log(
        `[lift-custom-roles] ${JSON.stringify(summary)}${execute ? '' : ' (dry-run, no writes)'}`,
    );
    return summary;
}

const execute = process.argv.includes('--execute');

run(execute)
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('[lift-custom-roles] failed:', e);
        process.exit(1);
    });
