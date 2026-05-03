## 07. Identity, RBAC & Multi-Tenancy

1. Extend `src/lib/rbac.ts` `EffectivePermissions` to carry an `attributes` ABAC payload (region, ownership, sensitivity) consumed by every `can()` call across the app.
2. Add per-resource ACL collection `rbac_resource_acls` queried from `src/lib/rbac-server.ts` so individual flows, broadcasts, and CRM records can override role grants.
3. Introduce role-inheritance graph in `src/lib/permission-modules.ts` letting custom roles `extends` a base role and merge clamped permissions before plan ceiling intersection.
4. Build custom-role editor at `src/app/dashboard/team/manage-roles/custom/page.tsx` with module-by-module action toggles backed by `crm-roles.actions.ts`.
5. Persist a `roleVersion` stamp on every grant so cached permission maps in `ProjectContext` invalidate when admins edit a role.
6. Add JIT access grant model with TTL stored in `rbac_jit_grants`, evaluated alongside static permissions inside `getEffectivePermissionsForProject`.
7. Wire SAML 2.0 service-provider endpoints under `src/app/api/auth/saml/[...samlAction]/route.ts` issuing the existing `SessionPayload` JWT from `src/lib/auth.ts`.
8. Implement OIDC relying-party flow at `src/app/api/auth/oidc/callback/route.ts` reusing `getJwtSecretKey()` to mint cookie sessions for federated identities.
9. Expose SCIM 2.0 `/Users` and `/Groups` endpoints under `src/app/api/scim/v2/[[...path]]/route.ts` translating to the Mongo user/team models from `team-invites.ts`.
10. Add SCIM bearer-token store on the workspace document in `src/lib/sabflow/workspaces/db.ts`, rotated from the security tab.
11. Layer MFA enrollment at `src/app/dashboard/settings/security/mfa/page.tsx` supporting TOTP, with secrets encrypted at rest in the user document.
12. Add WebAuthn passkey registration flow under `src/app/api/auth/webauthn/[register|authenticate]/route.ts` using server challenges keyed in Redis.
13. Implement push-MFA via the existing `src/lib/webhook-processor.ts` worker so login can dispatch a Firebase push the user approves.
14. Add session-management dashboard at `src/app/dashboard/settings/security/sessions/page.tsx` listing active JWTs from a new `auth_sessions` collection with revoke buttons.
15. Track device trust by hashing User-Agent + IP into `auth_devices` and surfacing a "remember device" checkbox on the login form in `src/app/login/`.
16. Enforce IP allowlists per workspace in `src/lib/sabflow/workspaces/permissions.ts` and short-circuit unauthorized requests at the dashboard layout.
17. Split billing-admin from workspace-admin by adding a `billing` permission module in `src/lib/permission-modules.ts` that owners can delegate without granting full admin.
18. Add separation-of-duties guard preventing the same user from creating and approving a credit purchase inside `src/app/dashboard/settings/billing/`.
19. Introduce delegated-admin claim for partner agencies so an MSP user can switch into a customer workspace via `src/app/dashboard/sabflow/workspaces/` without password sharing.
20. Build workspace switcher dropdown in `src/components/wabasimplify/session-provider.tsx` listing all memberships from `team-invites.ts` plus delegated tenancies.
21. Add guest collaborator role in `src/lib/sabflow/workspaces/types.ts` below `viewer` with ephemeral access to a single resource ID.
22. Render guest-share dialog in `src/components/sabflow/canvas/Canvas.tsx` issuing scoped JWTs that only `can()` the shared flow.
23. Emit organization-level audit events to a new `audit_logs` collection from every `*.actions.ts` mutation, indexed by `workspaceId` and `actor`.
24. Add audit-trail viewer at `src/app/dashboard/team/activity/page.tsx` with filters for actor, module, and action verb.
25. Stream high-severity audit events (role escalation, MFA disabled) to the admin panel `src/app/admin/dashboard/system/` for cross-tenant SOC review.
26. Implement step-up authentication in `src/lib/rbac-server.ts` so destructive permissions require a fresh MFA challenge within the last N minutes.
27. Add break-glass admin role gated by hardware-key WebAuthn that bypasses ABAC but writes a tamper-evident audit row.
28. Cache resolved `EffectivePermissions` in Redis keyed on `userId:workspaceId:roleVersion` to remove the hot-path Mongo read in `getMyEffectivePermissions`.
29. Replace string module keys in `src/lib/permission-modules.ts` with a typed enum so TypeScript catches typos in every `can('...', 'view')` call site.
30. Add a `rbac:lint` script that scans every server action for a `requirePermission` call and fails CI when one is missing.
31. Federate the admin-login flow in `src/app/admin-login/` with WebAuthn-only enforcement, removing password fallback for staff accounts.
32. Add tenant data-residency tag on the workspace doc consumed by Mongo connection routing in `src/lib/mongodb.ts` to pin EU tenants to EU shards.
33. Cross-tenant query firewall: wrap every collection accessor in `src/lib/sabflow/workspaces/db.ts` requiring an explicit `workspaceId` filter, throwing otherwise.
34. Build tenant-isolation test suite under `src/lib/__tests__/tenant-isolation.test.ts` asserting no action returns rows from a sibling workspace.
35. Add invitation-link signing with workspace-scoped secret in `src/lib/team-invites.ts` so leaked links cannot be replayed across tenants.
36. Implement just-in-time onboarding so first OIDC login auto-provisions the user, assigns the IdP-mapped role, and emits an audit row.
37. Add SCIM group-to-role mapping UI at `src/app/dashboard/settings/security/scim/page.tsx` linking IdP groups to SabNode roles.
38. Surface MFA enforcement policy at the workspace level enforced by the dashboard layout in `src/app/dashboard/layout.tsx`, redirecting non-compliant users to enrollment.
39. Add password-policy controls (min length, rotation, breach check via HIBP) consumed by `hashPassword` in `src/lib/auth.ts` before write.
40. Introduce risk-based auth in `src/lib/auth.edge.ts` scoring login attempts by IP, ASN, and device, escalating to MFA when score exceeds threshold.
41. Add API-key scoping in `src/app/actions/api-keys.actions.ts` so each key carries an explicit module/action subset rather than full owner authority.
42. Rotate JWT signing keys via a `JWT_KID` registry in `src/lib/auth.ts` and accept N-1 keys to allow zero-downtime rollover.
43. Move `JWT_SECRET` to KMS-encrypted Vercel env so secret material never sits in plaintext on disk during deploy.
44. Add cross-region session replication so workspace switches in `src/components/wabasimplify/session-provider.tsx` survive a regional Vercel failover.
45. Encrypt PII columns (email, phone, name) in user documents with envelope encryption keyed per-tenant for true multi-tenant data segregation.
46. Add SOC 2-friendly access-review report at `src/app/admin/dashboard/users/access-review/` listing every user-role pairing for quarterly attestation.
47. Implement consent receipts when guests accept a share, persisted alongside `audit_logs` for GDPR data-subject access requests.
48. Add tenant offboarding workflow in `src/app/admin/dashboard/whatsapp-projects/` that revokes all sessions, rotates webhooks, and queues data export to S3.
49. Surface real-time session and grant changes via Firestore listeners so revoking a role in `manage-roles` immediately invalidates the target user's `useCan` hook.
50. Document the full identity model in `docs/ecosystem/slices/07-identity-rbac-multitenant.md` plus a runbook covering IdP onboarding, key rotation, and incident-driven session purge.
