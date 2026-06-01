import "server-only";

import { mergeUserVars } from "@/lib/sabcrm/server/src/engine/core-modules/user/user-vars/utils/merge-user-vars.util";

// PORT-NOTE: Depends on KeyValuePairService which is ported separately.
// We inline the KeyValuePairType enum value used here to avoid circular deps.
const KEY_VALUE_PAIR_TYPE_USER_VARIABLE = "USER_VARIABLE";

export type KeyValuePairEntry = {
  key: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
  userId?: string | null;
  workspaceId?: string | null;
  type: string;
};

export type KeyValuePairServiceLike = {
  get(opts: {
    type: string;
    userId: string | null;
    workspaceId: string | null;
    key?: string;
  }): Promise<KeyValuePairEntry[]>;
  set(
    opts: {
      userId?: string;
      workspaceId?: string;
      key: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      value: any;
      type: string;
    },
    queryRunner?: unknown
  ): Promise<void>;
  delete(
    opts: {
      userId?: string;
      workspaceId?: string;
      key: string;
      type: string;
    },
    queryRunner?: unknown
  ): Promise<void>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class UserVarsService<KeyValueTypesMap extends Record<string, any> = Record<string, any>> {
  constructor(private readonly keyValuePairService: KeyValuePairServiceLike) {}

  async get<K extends keyof KeyValueTypesMap>({
    userId,
    workspaceId,
    key,
  }: {
    userId?: string;
    workspaceId?: string;
    key: Extract<K, string>;
  }): Promise<KeyValueTypesMap[K]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let userVarWorkspaceLevel: any[] = [];

    if (workspaceId) {
      userVarWorkspaceLevel = await this.keyValuePairService.get({
        type: KEY_VALUE_PAIR_TYPE_USER_VARIABLE,
        userId: null,
        workspaceId,
        key,
      });
    }

    if (userVarWorkspaceLevel.length > 1) {
      throw new Error(
        `Multiple values found for key ${key} at workspace level`
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let userVarUserLevel: any[] = [];

    if (userId) {
      userVarUserLevel = await this.keyValuePairService.get({
        type: KEY_VALUE_PAIR_TYPE_USER_VARIABLE,
        userId,
        workspaceId: null,
        key,
      });
    }

    if (userVarUserLevel.length > 1) {
      throw new Error(`Multiple values found for key ${key} at user level`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let userVarWorkspaceAndUserLevel: any[] = [];

    if (userId && workspaceId) {
      userVarWorkspaceAndUserLevel = await this.keyValuePairService.get({
        type: KEY_VALUE_PAIR_TYPE_USER_VARIABLE,
        userId,
        workspaceId,
        key,
      });
    }

    if (userVarWorkspaceAndUserLevel.length > 1) {
      throw new Error(
        `Multiple values found for key ${key} at workspace and user level`
      );
    }

    return mergeUserVars([
      ...userVarUserLevel,
      ...userVarWorkspaceLevel,
      ...userVarWorkspaceAndUserLevel,
    ]).get(key) as KeyValueTypesMap[K];
  }

  async getAll({
    userId,
    workspaceId,
  }: {
    userId?: string;
    workspaceId?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }): Promise<Map<Extract<keyof KeyValueTypesMap, string>, any>> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any[] = [];

    if (userId) {
      result = [
        ...result,
        ...(await this.keyValuePairService.get({
          type: KEY_VALUE_PAIR_TYPE_USER_VARIABLE,
          userId,
          workspaceId: null,
        })),
      ];
    }

    if (workspaceId) {
      result = [
        ...result,
        ...(await this.keyValuePairService.get({
          type: KEY_VALUE_PAIR_TYPE_USER_VARIABLE,
          userId: null,
          workspaceId,
        })),
      ];
    }

    if (workspaceId && userId) {
      result = [
        ...result,
        ...(await this.keyValuePairService.get({
          type: KEY_VALUE_PAIR_TYPE_USER_VARIABLE,
          userId,
          workspaceId,
        })),
      ];
    }

    return mergeUserVars<Extract<keyof KeyValueTypesMap, string>>(result);
  }

  set<K extends keyof KeyValueTypesMap>(
    {
      userId,
      workspaceId,
      key,
      value,
    }: {
      userId?: string;
      workspaceId?: string;
      key: Extract<K, string>;
      value: KeyValueTypesMap[K];
    },
    queryRunner?: unknown
  ) {
    return this.keyValuePairService.set(
      {
        userId,
        workspaceId,
        key,
        value,
        type: KEY_VALUE_PAIR_TYPE_USER_VARIABLE,
      },
      queryRunner
    );
  }

  async delete(
    {
      userId,
      workspaceId,
      key,
    }: {
      userId?: string;
      workspaceId?: string;
      key: Extract<keyof KeyValueTypesMap, string>;
    },
    queryRunner?: unknown
  ) {
    return this.keyValuePairService.delete(
      {
        userId,
        workspaceId,
        key,
        type: KEY_VALUE_PAIR_TYPE_USER_VARIABLE,
      },
      queryRunner
    );
  }
}
