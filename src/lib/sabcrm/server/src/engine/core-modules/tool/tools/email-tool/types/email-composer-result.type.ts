import { type ToolOutput } from "@/lib/sabcrm/server/src/engine/core-modules/tool/types/tool-output.type";
import { type ComposedEmail } from "@/lib/sabcrm/server/src/engine/core-modules/tool/tools/email-tool/types/composed-email.type";

export type EmailComposerResult =
  | { success: true; data: ComposedEmail }
  | { success: false; output: ToolOutput };
