// PORT-NOTE: TypeORM's ObjectLiteral replaced with a plain Record type.
// WorkspaceRepository and GlobalWorkspaceDataSource are Postgres/TypeORM
// constructs. They are represented here as opaque types so the shape is
// preserved; Mongo-backed callers will use their own collection handles.

import { type WorkspaceAuthContext } from '@/lib/sabcrm/server/src/engine/core-modules/auth/types/workspace-auth-context.type';
import { type CommonBaseQueryRunnerContext } from '@/lib/sabcrm/server/src/engine/api/common/types/common-base-query-runner-context.type';
import { type GraphqlQueryParser } from '@/lib/sabcrm/server/src/engine/api/graphql/graphql-query-runner/graphql-query-parsers/graphql-query.parser';
import { type RolePermissionConfig } from '@/lib/sabcrm/server/src/engine/twenty-orm/types/role-permission-config';

// Opaque stand-ins for Postgres/TypeORM types not used in the Mongo stack
export type WorkspaceRepository<TEntity extends Record<string, unknown>> = {
  // PORT-NOTE: TypeORM WorkspaceRepository stub; not used in Mongo queries
  _entity?: TEntity;
};

export type GlobalWorkspaceDataSource = {
  // PORT-NOTE: TypeORM GlobalWorkspaceDataSource stub; not used in Mongo queries
};

export type CommonExtendedQueryRunnerContext = Omit<
  CommonBaseQueryRunnerContext,
  'authContext'
> & {
  authContext: WorkspaceAuthContext;
  rolePermissionConfig: RolePermissionConfig;
  repository: WorkspaceRepository<Record<string, unknown>>;
  commonQueryParser: GraphqlQueryParser;
  workspaceDataSource: GlobalWorkspaceDataSource;
};
