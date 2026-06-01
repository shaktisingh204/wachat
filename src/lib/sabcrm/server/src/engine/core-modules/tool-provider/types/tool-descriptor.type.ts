import { type ToolIndexEntry } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/types/tool-index-entry.type";

export type ToolDescriptor = ToolIndexEntry & {
  inputSchema: object;
};
