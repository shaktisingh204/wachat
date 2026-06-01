// PORT-NOTE: NestJS @Module has no direct Next.js equivalent.
// This registry re-exports all pieces wired by the original UserVarsModule.

export { UserVarsService } from "@/lib/sabcrm/server/src/engine/core-modules/user/user-vars/services/user-vars.service";
export type { KeyValuePairServiceLike } from "@/lib/sabcrm/server/src/engine/core-modules/user/user-vars/services/user-vars.service";
export { mergeUserVars } from "@/lib/sabcrm/server/src/engine/core-modules/user/user-vars/utils/merge-user-vars.util";

/*
  Original wiring:
    imports:  [KeyValuePairModule]
    providers: [UserVarsService]
    exports:   [UserVarsService]
*/
