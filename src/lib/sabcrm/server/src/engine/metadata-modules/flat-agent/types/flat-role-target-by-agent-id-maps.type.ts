import { type FlatRoleTarget } from 'src/lib/sabcrm/server/src/engine/metadata-modules/flat-role-target/types/flat-role-target.type';

export type FlatRoleTargetByAgentIdMaps = Partial<
  Record<string, FlatRoleTarget>
>;
