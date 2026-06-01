import { COMMON_PRELOAD_TOOLS } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/constants/common-preload-tools.const";

export const AI_CHAT_TOOL_NAMES_TO_PRELOAD: string[] = [
  ...COMMON_PRELOAD_TOOLS,
  "app_exa_web_search",
];
