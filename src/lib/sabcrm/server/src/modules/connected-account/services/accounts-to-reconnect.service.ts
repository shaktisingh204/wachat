import "server-only";

// PORT-NOTE: Ported from NestJS AccountsToReconnectService.
// NestJS @Injectable and DI removed; UserVarsService is injected at call-site.

import type { UserVarsService } from "../../../../../engine/core-modules/user/user-vars/services/user-vars.service";
import {
  type AccountsToReconnectKeyValueType,
  AccountsToReconnectKeys,
} from "../types/accounts-to-reconnect-key-value.type";

export function createAccountsToReconnectService(
  userVarsService: UserVarsService<AccountsToReconnectKeyValueType>,
) {
  async function removeAccountToReconnect(
    userId: string,
    workspaceId: string,
    connectedAccountId: string,
  ): Promise<void> {
    for (const key of Object.values(AccountsToReconnectKeys)) {
      await removeAccountToReconnectByKey(
        key,
        userId,
        workspaceId,
        connectedAccountId,
      );
    }
  }

  async function removeAccountToReconnectByKey(
    key: AccountsToReconnectKeys,
    userId: string,
    workspaceId: string,
    connectedAccountId: string,
  ): Promise<void> {
    const accountsToReconnect = await userVarsService.get({
      userId,
      workspaceId,
      key,
    });

    if (!accountsToReconnect) {
      return;
    }

    const updatedAccountsToReconnect = accountsToReconnect.filter(
      (id) => id !== connectedAccountId,
    );

    if (updatedAccountsToReconnect.length === 0) {
      await userVarsService.delete({
        userId,
        workspaceId,
        key,
      });

      return;
    }

    await userVarsService.set({
      userId,
      workspaceId,
      key,
      value: updatedAccountsToReconnect,
    });
  }

  async function addAccountToReconnectByKey(
    key: AccountsToReconnectKeys,
    userId: string,
    workspaceId: string,
    connectedAccountId: string,
  ): Promise<void> {
    const accountsToReconnect =
      (await userVarsService.get({
        userId,
        workspaceId,
        key,
      })) ?? [];

    if (accountsToReconnect.includes(connectedAccountId)) {
      return;
    }

    accountsToReconnect.push(connectedAccountId);

    await userVarsService.set({
      userId,
      workspaceId,
      key,
      value: accountsToReconnect,
    });
  }

  return {
    removeAccountToReconnect,
    removeAccountToReconnectByKey,
    addAccountToReconnectByKey,
  };
}
