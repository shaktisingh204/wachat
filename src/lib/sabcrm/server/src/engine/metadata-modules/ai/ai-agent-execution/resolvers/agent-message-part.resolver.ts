import "server-only";

// PORT-NOTE: Ported from twenty-server AgentMessagePartResolver.
// NestJS @Resolver/@ResolveField removed. Becomes two plain server functions
// with the same inputs/outputs:
//
//  resolveAgentMessagePartFileUrl  — signs a file URL for a given part
//  resolveAgentMessagePartFileMediaType — extracts the MIME type from the loaded file relation
//
// FileUrlService.signFileByIdUrl is injected as a callback to keep the
// function pure and testable.

import type { AgentMessagePartDocument } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent-execution/entities/agent-message-part.entity";

export const AgentChatFileFolder = "AgentChat" as const;

export type SignFileByIdUrlFn = (params: {
  fileId: string;
  workspaceId: string;
  fileFolder: string;
}) => Promise<string>;

/**
 * Resolves a signed URL for the file attached to an agent message part.
 * Returns null when the part has no fileId.
 *
 * @param part         - The agent message part document.
 * @param workspaceId  - The current workspace id.
 * @param signFileByIdUrl - Callback wrapping FileUrlService.signFileByIdUrl.
 */
export async function resolveAgentMessagePartFileUrl(
  part: AgentMessagePartDocument,
  workspaceId: string,
  signFileByIdUrl: SignFileByIdUrlFn,
): Promise<string | null> {
  if (!part.fileId) {
    return null;
  }

  return signFileByIdUrl({
    fileId: part.fileId,
    workspaceId,
    fileFolder: AgentChatFileFolder,
  });
}

/**
 * Resolves the MIME type for the file attached to an agent message part.
 * The file relation must already be loaded (i.e. `fileMimeType` stored on the
 * document or resolved separately). Returns null when not available.
 *
 * In the Mongo layer, mimeType may be stored directly on the part document
 * as `fileMediaType` (denormalised copy) — use that first, fall back to null.
 */
export function resolveAgentMessagePartFileMediaType(
  part: AgentMessagePartDocument & { fileMimeType?: string | null },
): string | null {
  return (part as { fileMimeType?: string | null }).fileMimeType ?? null;
}
