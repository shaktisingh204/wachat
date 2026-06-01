import { type FlatAuthContextUser } from "@/lib/sabcrm/server/src/engine/core-modules/auth/types/flat-auth-context-user.type";
import { type FlatWorkspace } from "@/lib/sabcrm/server/src/engine/core-modules/workspace/types/flat-workspace.type";

// PORT-NOTE: Original extended YogaDriverServerContext<'express'> from @graphql-yoga/nestjs.
// Ported as a plain interface without the Yoga driver dependency.
export interface GraphQLContext {
  user?: FlatAuthContextUser;
  workspace?: FlatWorkspace;
}
