import type { WorkspaceUrlsDTO } from "@/lib/sabcrm/server/src/engine/core-modules/workspace/dtos/workspace-urls.dto";

export type WorkspaceUrlsAndIdDTO = {
  workspaceUrls: WorkspaceUrlsDTO;
  id: string;
};
