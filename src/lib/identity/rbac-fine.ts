/**
 * Fine-grained per-resource ACL evaluator.
 *
 * Combines:
 *   - Role-level grants (broad, type-based)
 *   - Per-resource ACL grants (narrow, instance-based)
 *   - Per-resource ACL denies (override anything)
 *   - Inheritance from a parent resource (recursive)
 *
 * This sits *next to* the existing module-based RBAC (`src/lib/rbac.ts`),
 * which clamps overall plan/role permissions. Use this evaluator only for
 * resource-instance gating (e.g. "can Alice edit doc:abc123?").
 */

import type { AclAction, AclSubject, Actor, ResourceAcl, Role } from './types';

export type AclLookup = {
    /** Returns the ACL for a single resource, or null if no rules exist. */
    getAcl(resourceType: string, resourceId: string): ResourceAcl | null;
    /** Returns the role document by id (for inheritance resolution). */
    getRole(roleId: string): Role | null;
};

function subjectMatchesActor(actor: Actor, subj: AclSubject): boolean {
    switch (subj.kind) {
        case 'user':
            return subj.id === actor.userId;
        case 'group':
            return actor.groups.includes(subj.id);
        case 'role':
            return actor.roles.includes(subj.id);
    }
}

/** Walk a role's inheritance chain, collecting all `(resourceType, action)` grants. */
function collectRolePermissions(roleId: string, lookup: AclLookup, seen: Set<string> = new Set()): Record<string, Set<AclAction>> {
    const out: Record<string, Set<AclAction>> = {};
    if (seen.has(roleId)) return out;
    seen.add(roleId);
    const role = lookup.getRole(roleId);
    if (!role) return out;
    for (const [resourceType, actions] of Object.entries(role.permissions ?? {})) {
        if (!out[resourceType]) out[resourceType] = new Set();
        for (const a of actions) out[resourceType].add(a);
    }
    for (const parent of role.inherits ?? []) {
        const parentMap = collectRolePermissions(parent, lookup, seen);
        for (const [rt, actions] of Object.entries(parentMap)) {
            if (!out[rt]) out[rt] = new Set();
            actions.forEach((a) => out[rt].add(a));
        }
    }
    return out;
}

/**
 * Pure check — does the actor have `action` on `resource`?
 *
 * Order of evaluation:
 *   1. If any matching deny on this resource (or up its parent chain) covers
 *      `action` → DENY.
 *   2. If any role grant covers `(resource.type, action)` → ALLOW.
 *   3. If any ACL grant on this resource (or inherited) covers `action` → ALLOW.
 *   4. Default → DENY.
 *
 * `admin` action on a role implicitly grants every other action for that
 * resource type. Same for ACL grants.
 */
export function canAccess(
    actor: Actor,
    resource: { type: string; id: string },
    action: AclAction,
    lookup: AclLookup,
): boolean {
    // 1. Walk parent chain collecting denies first.
    const visited = new Set<string>();
    let current: { type: string; id: string } | null = resource;
    while (current && !visited.has(`${current.type}:${current.id}`)) {
        visited.add(`${current.type}:${current.id}`);
        const acl = lookup.getAcl(current.type, current.id);
        if (acl?.denies) {
            for (const d of acl.denies) {
                if (subjectMatchesActor(actor, d.subject)) {
                    if (d.actions.includes(action) || d.actions.includes('admin')) {
                        return false;
                    }
                }
            }
        }
        current = acl?.parent
            ? { type: acl.parent.resourceType, id: acl.parent.resourceId }
            : null;
    }

    // 2. Role grants.
    const rolePerms: Record<string, Set<AclAction>> = {};
    for (const roleId of actor.roles) {
        const collected = collectRolePermissions(roleId, lookup);
        for (const [rt, actions] of Object.entries(collected)) {
            if (!rolePerms[rt]) rolePerms[rt] = new Set();
            actions.forEach((a) => rolePerms[rt].add(a));
        }
    }
    const roleGrants = rolePerms[resource.type] ?? rolePerms['*'];
    if (roleGrants && (roleGrants.has('admin') || roleGrants.has(action))) {
        return true;
    }

    // 3. ACL grants — walk parent chain.
    visited.clear();
    current = resource;
    while (current && !visited.has(`${current.type}:${current.id}`)) {
        visited.add(`${current.type}:${current.id}`);
        const acl = lookup.getAcl(current.type, current.id);
        if (acl?.grants) {
            for (const g of acl.grants) {
                if (subjectMatchesActor(actor, g.subject)) {
                    if (g.actions.includes('admin') || g.actions.includes(action)) {
                        return true;
                    }
                }
            }
        }
        current = acl?.parent
            ? { type: acl.parent.resourceType, id: acl.parent.resourceId }
            : null;
    }

    return false;
}

/** Convenience — returns the *list* of actions an actor has on a resource. */
export function listActions(
    actor: Actor,
    resource: { type: string; id: string },
    lookup: AclLookup,
): AclAction[] {
    const all: AclAction[] = ['view', 'create', 'edit', 'delete', 'admin'];
    return all.filter((a) => canAccess(actor, resource, a, lookup));
}

/** Build an in-memory `AclLookup` from arrays — useful for tests. */
export function inMemoryLookup(args: { acls?: ResourceAcl[]; roles?: Role[] }): AclLookup {
    const aclMap = new Map<string, ResourceAcl>();
    for (const acl of args.acls ?? []) {
        aclMap.set(`${acl.resourceType}:${acl.resourceId}`, acl);
    }
    const roleMap = new Map<string, Role>();
    for (const role of args.roles ?? []) {
        roleMap.set(role.id, role);
    }
    return {
        getAcl: (t, id) => aclMap.get(`${t}:${id}`) ?? null,
        getRole: (id) => roleMap.get(id) ?? null,
    };
}
