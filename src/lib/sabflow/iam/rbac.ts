/**
 * Identity & Access Management: Role-Based Access Control (RBAC) Scaffolding
 */

export type Role = 'admin' | 'editor' | 'viewer';
export type Resource = 'workflow' | 'credentials' | 'execution_history' | 'settings';
export type Action = 'create' | 'read' | 'update' | 'delete' | 'execute';

export interface RBACPolicy {
  role: Role;
  permissions: Array<{
    resource: Resource;
    actions: Action[];
  }>;
}

export const DEFAULT_POLICIES: RBACPolicy[] = [
  {
    role: 'admin',
    permissions: [
      { resource: 'workflow', actions: ['create', 'read', 'update', 'delete', 'execute'] },
      { resource: 'credentials', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'execution_history', actions: ['read', 'delete'] },
      { resource: 'settings', actions: ['read', 'update'] },
    ],
  },
  {
    role: 'editor',
    permissions: [
      { resource: 'workflow', actions: ['create', 'read', 'update', 'execute'] },
      { resource: 'credentials', actions: ['read'] },
      { resource: 'execution_history', actions: ['read'] },
      { resource: 'settings', actions: ['read'] },
    ],
  },
  {
    role: 'viewer',
    permissions: [
      { resource: 'workflow', actions: ['read'] },
      { resource: 'credentials', actions: [] },
      { resource: 'execution_history', actions: ['read'] },
      { resource: 'settings', actions: [] },
    ],
  },
];

export class RBACService {
  can(role: Role, action: Action, resource: Resource): boolean {
    const policy = DEFAULT_POLICIES.find(p => p.role === role);
    if (!policy) return false;

    const resourcePerms = policy.permissions.find(p => p.resource === resource);
    if (!resourcePerms) return false;

    return resourcePerms.actions.includes(action);
  }

  canAll(role: Role, requirements: { action: Action; resource: Resource }[]): boolean {
    return requirements.every(req => this.can(role, req.action, req.resource));
  }
}
