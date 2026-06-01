import { type z } from "zod";

import { type HttpRequestInputZodSchema } from "@/lib/sabcrm/server/src/engine/core-modules/tool/tools/http-tool/http-tool.schema";

export type HttpRequestInput = z.infer<typeof HttpRequestInputZodSchema>;
