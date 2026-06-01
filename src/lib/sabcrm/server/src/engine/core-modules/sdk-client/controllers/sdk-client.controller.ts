import "server-only";

// PORT-NOTE: NestJS @Controller / @UseGuards / @Get are replaced by a plain
// handler function intended to be wired into a Next.js Route Handler
// (app/api/rest/sdk-client/[applicationId]/[moduleName]/route.ts).
// Auth guard logic must be applied at the route level.

import { NextRequest, NextResponse } from "next/server";

import {
  ALLOWED_SDK_MODULES,
  type SdkModuleName,
} from "@/lib/sabcrm/server/src/engine/core-modules/sdk-client/constants/allowed-sdk-modules";
import { getClientModuleFromArchive } from "@/lib/sabcrm/server/src/engine/core-modules/sdk-client/sdk-client-archive.service";

export type SdkClientRouteParams = {
  applicationId: string;
  moduleName: SdkModuleName;
};

/**
 * Handler for GET /rest/sdk-client/:applicationId/:moduleName
 * Wire this into a Next.js Route Handler that resolves workspaceId from the session.
 */
export async function handleGetSdkModule(
  _req: NextRequest,
  {
    workspaceId,
    applicationId,
    moduleName,
    applicationUniversalIdentifier,
  }: {
    workspaceId: string;
    applicationId: string;
    moduleName: string;
    applicationUniversalIdentifier: string;
  },
): Promise<NextResponse> {
  if (!ALLOWED_SDK_MODULES.includes(moduleName as SdkModuleName)) {
    return NextResponse.json(
      {
        error: `SDK module "${moduleName}" not found. Allowed: ${ALLOWED_SDK_MODULES.join(", ")}`,
      },
      { status: 404 },
    );
  }

  const fileBuffer = await getClientModuleFromArchive({
    workspaceId,
    applicationId,
    applicationUniversalIdentifier,
    moduleName: moduleName as SdkModuleName,
  });

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: { "Content-Type": "application/javascript" },
  });
}
