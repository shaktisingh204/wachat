export type KeyValuePairLike = {
  key: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
  userId?: string | null;
  workspaceId?: string | null;
};

export const mergeUserVars = <T extends string>(
  userVars: KeyValuePairLike[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Map<T, any> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workspaceUserVarMap = new Map<T, any>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userUserVarMap = new Map<T, any>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userWorkspaceUserVarMap = new Map<T, any>();

  for (const { key, value, userId, workspaceId } of userVars) {
    if (!userId && workspaceId) {
      workspaceUserVarMap.set(key as T, value);
    }

    if (userId && !workspaceId) {
      userUserVarMap.set(key as T, value);
    }

    if (userId && workspaceId) {
      userWorkspaceUserVarMap.set(key as T, value);
    }
  }

  // Merge order: workspace-level < user-level < user+workspace-level
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mergedUserVars = new Map<T, any>([
    ...workspaceUserVarMap,
    ...userUserVarMap,
    ...userWorkspaceUserVarMap,
  ]);

  return mergedUserVars;
};
