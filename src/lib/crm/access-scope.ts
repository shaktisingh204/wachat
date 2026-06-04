import 'server-only';

import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getEffectivePermissionsForProject } from '@/lib/rbac-server';
import { isElevatedRole } from '@/lib/rbac';

/**
 * Record-level access scope for the sales-CRM (`crm_leads` + `crm_contacts`).
 *
 * Project owners and elevated roles (admin) keep full access to every record in
 * their tenant — behaviour is unchanged for them. Invited members (the `agent` /
 * `member` roles created through the team-invite flow) are restricted to ONLY
 * the records ASSIGNED to them (`assignedTo === their own user id`); they can
 * neither see nor manage any record that isn't theirs.
 *
 * The returned filter fragments are designed to be merged directly into the
 * existing Mongo queries:
 *
 *   // list / count / aggregate
 *   const filter = { ...scope.leadList, ...otherFilters };
 *
 *   // single-record read / update / delete (already pinned by _id)
 *   { _id: new ObjectId(leadId), ...scope.leadById }
 *
 * `assignedTo` is stored as an `ObjectId` on leads but as a string on contacts,
 * hence the two field sets.
 *
 * Security note: the `assignedTo: self` clause is the hard guarantee. Even if
 * the tenant-owner resolution below is wrong, a restricted member can only ever
 * match records explicitly assigned to their own id — the scope can narrow
 * access but never widen it.
 */
export interface CrmAccessScope {
    /** The acting user's id. */
    selfId: ObjectId;
    /** True for invited members who must be limited to their assigned records. */
    restricted: boolean;
    /** Merge into list/count/aggregate queries over `crm_leads`. */
    leadList: Record<string, unknown>;
    /** Merge alongside `{ _id }` into single-doc `crm_leads` read/write. */
    leadById: Record<string, unknown>;
    /** Merge into list/count/aggregate queries over `crm_contacts`. */
    contactList: Record<string, unknown>;
    /** Merge alongside `{ _id }` into single-doc `crm_contacts` read/write. */
    contactById: Record<string, unknown>;
}

export async function crmAccessScope(session: {
    user: { _id: unknown; activeProjectId?: unknown };
}): Promise<CrmAccessScope> {
    const selfId = new ObjectId(String(session.user._id));
    const effective = await getEffectivePermissionsForProject();
    const restricted = !!effective && !effective.isOwner && !isElevatedRole(effective.role);

    if (!restricted) {
        // Owner / admin — unchanged tenant scope.
        const tenant = { userId: selfId };
        return {
            selfId,
            restricted: false,
            leadList: tenant,
            leadById: tenant,
            contactList: tenant,
            contactById: tenant,
        };
    }

    // Invited member — assigned records live under the OWNER's `userId`, so
    // resolve the tenant owner for list scoping. Single-record ops are pinned
    // by `_id`, so for those we rely on the `assignedTo` clause alone (robust
    // even if owner resolution falls back).
    const ownerId = await resolveTenantOwnerId(session, selfId);
    const selfStr = String(selfId);
    return {
        selfId,
        restricted: true,
        leadList: { userId: ownerId, assignedTo: selfId },
        leadById: { assignedTo: selfId },
        contactList: { userId: ownerId, assignedTo: selfStr },
        contactById: { assignedTo: selfStr },
    };
}

async function resolveTenantOwnerId(
    session: { user: { activeProjectId?: unknown } },
    fallback: ObjectId,
): Promise<ObjectId> {
    const apid = session.user?.activeProjectId;
    if (!apid || !ObjectId.isValid(String(apid))) return fallback;
    try {
        const { db } = await connectToDatabase();
        const project = await db
            .collection('projects')
            .findOne({ _id: new ObjectId(String(apid)) }, { projection: { userId: 1 } });
        return (project?.userId as ObjectId | undefined) ?? fallback;
    } catch {
        return fallback;
    }
}
