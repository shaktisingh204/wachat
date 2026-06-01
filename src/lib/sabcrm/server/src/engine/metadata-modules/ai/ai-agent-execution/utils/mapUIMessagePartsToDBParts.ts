// PORT-NOTE: Ported from twenty-server mapUIMessagePartsToDBParts.ts
// Maps UI message parts to partial Mongo AgentMessagePartDocument records for persistence.

import type { ToolUIPart } from "ai";
import {
  isExtendedFileUIPart,
  type ExtendedUIMessagePart,
} from "@/lib/sabcrm/shared/src/ai/index";

import type { AgentMessagePartDocument } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent-execution/entities/agent-message-part.entity";

const isToolPart = (part: ExtendedUIMessagePart): part is ToolUIPart => {
  return part.type.includes("tool-") && "toolCallId" in part;
};

export const mapUIMessagePartsToDBParts = (
  uiMessageParts: ExtendedUIMessagePart[],
  messageId: string,
  workspaceId: string,
): Partial<AgentMessagePartDocument>[] => {
  return uiMessageParts
    .map((part, index) => {
      const basePart: Partial<AgentMessagePartDocument> = {
        messageId,
        orderIndex: index,
        type: part.type,
        workspaceId,
      };

      switch (part.type) {
        case "text":
          return {
            ...basePart,
            textContent: part.text,
          };
        case "reasoning":
          return {
            ...basePart,
            reasoningContent: part.text,
          };
        case "file": {
          if (!isExtendedFileUIPart(part)) {
            throw new Error("Expected file part");
          }

          return {
            ...basePart,
            fileFilename: part.filename,
            fileId: part.fileId,
          };
        }
        case "source-url":
          return {
            ...basePart,
            sourceUrlSourceId: part.sourceId,
            sourceUrlUrl: part.url,
            sourceUrlTitle: part.title,
            providerMetadata: part.providerMetadata ?? null,
          };
        case "source-document":
          return {
            ...basePart,
            sourceDocumentSourceId: part.sourceId,
            sourceDocumentMediaType: part.mediaType,
            sourceDocumentTitle: part.title,
            sourceDocumentFilename: part.filename,
            providerMetadata: part.providerMetadata ?? null,
          };
        case "step-start":
          return basePart;
        case "data-compaction":
          return null;
        case "data-routing-status":
          return {
            ...basePart,
            textContent: (part as { data: { text: string; state: string } }).data.text,
            state: (part as { data: { text: string; state: string } }).data.state,
          };
        case "data-code-execution":
          // Code execution parts are streamed during execution but don't need
          // to be persisted — the final result is captured in the tool part.
          return null;
        case "data-thread-title":
          // Thread title is a transient notification for the client.
          return null;
        default: {
          if (isToolPart(part)) {
            const { toolCallId, input, output, errorText, state } = part;

            return {
              ...basePart,
              toolCallId,
              toolInput: input,
              toolOutput: output,
              errorMessage: errorText,
              state,
              providerExecuted:
                (part as { providerExecuted?: boolean | null }).providerExecuted ?? null,
            };
          }

          throw new Error(`Unsupported part type: ${part.type}`);
        }
      }
    })
    .filter(
      (part): part is Partial<AgentMessagePartDocument> => part !== null,
    );
};
