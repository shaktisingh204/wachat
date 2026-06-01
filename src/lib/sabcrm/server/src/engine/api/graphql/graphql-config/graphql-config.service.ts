import "server-only";

// PORT-NOTE: GraphQLConfigService was a NestJS injectable that created Yoga/GraphQL config.
// In the SabNode Next.js stack, GraphQL config is assembled as a plain object/function.
// NestJS DI (ModuleRef, @Injectable) and Yoga-specific plugin APIs are not available.
// The config shape is preserved for reference; plugin wiring must be adapted to the actual
// Next.js API route or server-action handler where GraphQL is served.

import { type FlatAuthContextUser } from "@/lib/sabcrm/server/src/engine/core-modules/auth/types/flat-auth-context-user.type";
import { type FlatWorkspace } from "@/lib/sabcrm/server/src/engine/core-modules/workspace/types/flat-workspace.type";

export interface GraphQLContext {
  user?: FlatAuthContextUser;
  workspace?: FlatWorkspace;
}

export interface GraphQLConfigOptions {
  isDebugMode: boolean;
  maxFields?: number;
  maxRootResolvers?: number;
}

/**
 * Builds the GraphQL server configuration options.
 * Replace service dependencies with direct imports or DI-equivalent patterns in your
 * Next.js route handler.
 */
export function createGraphQLConfig(options: GraphQLConfigOptions): {
  resolvers: { JSON: unknown };
  isDebugMode: boolean;
  plugins: string[]; // symbolic — wire actual plugins in the handler
} {
  return {
    resolvers: { JSON: {} }, // replace with graphql-type-json scalar
    isDebugMode: options.isDebugMode,
    plugins: [
      'useDirectExecution',
      'useGraphQLErrorHandlerHook',
      'useDisableIntrospectionAndSuggestionsForUnauthenticatedUsers',
      'useValidateGraphqlQueryComplexity',
    ],
  };
}
