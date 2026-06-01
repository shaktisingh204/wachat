import { type z } from "zod";

import { type EmailToolInputZodSchema } from "@/lib/sabcrm/server/src/engine/core-modules/tool/tools/email-tool/email-tool.schema";

export type EmailToolInput = z.infer<typeof EmailToolInputZodSchema>;
