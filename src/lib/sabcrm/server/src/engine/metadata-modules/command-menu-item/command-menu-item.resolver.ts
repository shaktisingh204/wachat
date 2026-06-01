'use server';

// PORT-NOTE: NestJS GraphQL resolver -> Next.js server actions.
// Auth guards (WorkspaceAuthGuard, NoPermissionGuard) and i18n context must be
// enforced by the calling route handler / middleware layer.
// DataLoader-based field resolvers (label, shortLabel, icon, frontComponent) are
// inlined as service calls.

import type { CommandMenuItemDTO } from '@/lib/sabcrm/server/src/engine/metadata-modules/command-menu-item/dtos/command-menu-item.dto';
import type { CreateCommandMenuItemInput } from '@/lib/sabcrm/server/src/engine/metadata-modules/command-menu-item/dtos/create-command-menu-item.input';
import type { UpdateCommandMenuItemInput } from '@/lib/sabcrm/server/src/engine/metadata-modules/command-menu-item/dtos/update-command-menu-item.input';
import { withCommandMenuItemExceptionHandling } from '@/lib/sabcrm/server/src/engine/metadata-modules/command-menu-item/interceptors/command-menu-item-graphql-api-exception.interceptor';
import { commandMenuItemService } from '@/lib/sabcrm/server/src/engine/metadata-modules/command-menu-item/command-menu-item.service';

// --- Query: commandMenuItems ---
export async function queryCommandMenuItems(
  workspaceId: string,
): Promise<CommandMenuItemDTO[]> {
  return withCommandMenuItemExceptionHandling(() =>
    commandMenuItemService.findAll(workspaceId),
  );
}

// --- Query: commandMenuItem ---
export async function queryCommandMenuItem(
  id: string,
  workspaceId: string,
): Promise<CommandMenuItemDTO | null> {
  return withCommandMenuItemExceptionHandling(() =>
    commandMenuItemService.findById(id, workspaceId),
  );
}

// --- Mutation: createCommandMenuItem ---
export async function createCommandMenuItem(
  input: CreateCommandMenuItemInput,
  workspaceId: string,
): Promise<CommandMenuItemDTO> {
  return withCommandMenuItemExceptionHandling(() =>
    commandMenuItemService.create(input, workspaceId),
  );
}

// --- Mutation: updateCommandMenuItem ---
export async function updateCommandMenuItem(
  input: UpdateCommandMenuItemInput,
  workspaceId: string,
): Promise<CommandMenuItemDTO> {
  return withCommandMenuItemExceptionHandling(() =>
    commandMenuItemService.update(input, workspaceId),
  );
}

// --- Mutation: deleteCommandMenuItem ---
export async function deleteCommandMenuItem(
  id: string,
  workspaceId: string,
): Promise<CommandMenuItemDTO> {
  return withCommandMenuItemExceptionHandling(() =>
    commandMenuItemService.delete(id, workspaceId),
  );
}

export const commandMenuItemActions = {
  queryCommandMenuItems,
  queryCommandMenuItem,
  createCommandMenuItem,
  updateCommandMenuItem,
  deleteCommandMenuItem,
};
