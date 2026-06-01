import "server-only";

// PORT-NOTE: NestJS @Injectable() / @InjectRepository() / @InjectMessageQueue() removed.
// WorkspaceSchemaFactory (GraphQL schema builder) is not ported yet — this module stubs
// the dependency. replaceCoreClient from twenty-client-sdk/generate is preserved.
// The message-queue service is replaced with a direct function call pattern;
// callers should enqueue via SabNode's queue infrastructure.

import * as fs from "fs/promises";
import { printSchema } from "graphql";
import path, { join } from "path";

import { SDK_CLIENT_PACKAGE_DIRNAME } from "@/lib/sabcrm/server/src/engine/core-modules/sdk-client/constants/sdk-client-package-dirname";
import {
  SdkClientException,
  SdkClientExceptionCode,
} from "@/lib/sabcrm/server/src/engine/core-modules/sdk-client/exceptions/sdk-client.exception";
import {
  GENERATE_SDK_CLIENT_JOB_NAME,
  type GenerateSdkClientJobData,
} from "@/lib/sabcrm/server/src/engine/core-modules/sdk-client/jobs/generate-sdk-client.job-constants";

// PORT-NOTE: FileFolder enum mirrors twenty-shared/types FileFolder.
export enum FileFolder {
  GeneratedSdkClient = "GeneratedSdkClient",
}

const SDK_CLIENT_ARCHIVE_NAME = "twenty-client-sdk.zip";
const SDK_CLIENT_GENERATION_RETRY_LIMIT = 3;

export { GENERATE_SDK_CLIENT_JOB_NAME, SDK_CLIENT_GENERATION_RETRY_LIMIT };
export type { GenerateSdkClientJobData };

// ---- abstract interfaces ----

export interface IWorkspaceCacheService {
  invalidateAndRecompute(workspaceId: string, keys: string[]): Promise<void>;
}

export interface IFileStorageService {
  writeFile(opts: {
    workspaceId: string;
    applicationUniversalIdentifier: string;
    fileFolder: FileFolder;
    resourcePath: string;
    sourceFile: Buffer;
    settings: { isTemporaryFile: boolean; toDelete: boolean };
  }): Promise<void>;
}

export interface IApplicationRepository {
  updateOne(
    filter: { id: string; workspaceId: string },
    update: Partial<{ isSdkLayerStale: boolean }>,
  ): Promise<void>;
}

// PORT-NOTE: WorkspaceSchemaFactory is not ported yet.
// This interface allows the caller to provide a schema string directly,
// or supply a factory that generates one.
export interface IWorkspaceSchemaProvider {
  createGraphQLSchema(
    workspace: unknown,
    applicationId: string,
  ): Promise<{ toString(): string } | ReturnType<typeof printSchema>>;
}

// ---- temporary dir helper ----

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const os = await import("os");
  const tmpBase = os.tmpdir();
  const tmpDir = await fs.mkdtemp(join(tmpBase, "sabcrm-sdk-"));
  try {
    return await fn(tmpDir);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

// ---- zip helper ----

async function createZipFile(
  sourceDir: string,
  outputPath: string,
): Promise<void> {
  // PORT-NOTE: createZipFile from twenty-server is not yet ported.
  // Inline implementation using the 'archiver' package if available,
  // otherwise falls back to the 'zip-a-folder' approach.
  try {
    const archiver = (await import("archiver")).default;
    const { createWriteStream } = await import("fs");
    await new Promise<void>((resolve, reject) => {
      const output = createWriteStream(outputPath);
      const archive = archiver("zip", { zlib: { level: 9 } });
      output.on("close", resolve);
      archive.on("error", reject);
      archive.pipe(output);
      archive.directory(sourceDir, false);
      archive.finalize();
    });
  } catch {
    throw new Error(
      "createZipFile: archiver package not available. Install 'archiver' or port create-zip-file util.",
    );
  }
}

// ---- core generation logic ----

type GenerateDeps = {
  fileStorageService: IFileStorageService;
  applicationRepository: IApplicationRepository;
  workspaceCacheService: IWorkspaceCacheService;
};

async function generateAndStore(
  deps: GenerateDeps,
  {
    workspaceId,
    applicationId,
    applicationUniversalIdentifier,
    schema,
  }: {
    workspaceId: string;
    applicationId: string;
    applicationUniversalIdentifier: string;
    schema: string;
  },
): Promise<Buffer> {
  return withTempDir(async (sourceTemporaryDir) => {
    try {
      const tempPackageRoot = join(sourceTemporaryDir, "twenty-client-sdk");

      await fs.cp(SDK_CLIENT_PACKAGE_DIRNAME, tempPackageRoot, {
        recursive: true,
        filter: (source) => {
          const relativePath = path.relative(
            SDK_CLIENT_PACKAGE_DIRNAME,
            source,
          );
          return (
            !relativePath.includes("node_modules") &&
            !relativePath.startsWith("src")
          );
        },
      });

      // PORT-NOTE: replaceCoreClient from twenty-client-sdk/generate
      const { replaceCoreClient } = await import(
        "twenty-client-sdk/generate"
      );
      await replaceCoreClient({ packageRoot: tempPackageRoot, schema });

      const archivePath = join(sourceTemporaryDir, SDK_CLIENT_ARCHIVE_NAME);
      await createZipFile(tempPackageRoot, archivePath);

      const archiveBuffer = await fs.readFile(archivePath);

      await deps.fileStorageService.writeFile({
        workspaceId,
        applicationUniversalIdentifier,
        fileFolder: FileFolder.GeneratedSdkClient,
        resourcePath: SDK_CLIENT_ARCHIVE_NAME,
        sourceFile: archiveBuffer,
        settings: { isTemporaryFile: false, toDelete: false },
      });

      await deps.applicationRepository.updateOne(
        { id: applicationId, workspaceId },
        { isSdkLayerStale: true },
      );

      await deps.workspaceCacheService.invalidateAndRecompute(workspaceId, [
        "flatApplicationMaps",
      ]);

      return archiveBuffer;
    } catch (error) {
      throw new SdkClientException(
        `Failed to generate SDK client for application "${applicationUniversalIdentifier}" in workspace "${workspaceId}": ${error instanceof Error ? error.message : String(error)}`,
        SdkClientExceptionCode.GENERATION_FAILED,
      );
    }
  });
}

/**
 * Generates the SDK client bundle for a workspace application.
 * This is the stateless core: pass deps explicitly.
 * For the class-style API see SdkClientGenerationService.
 *
 * PORT-NOTE: The workspace is looked up from Mongo; the GraphQL schema is built
 * via IWorkspaceSchemaProvider. Until those modules are ported the caller must
 * provide a schema string directly via generateSdkClientForApplicationWithSchema.
 */
export async function generateSdkClientForApplication({
  workspaceId,
  applicationId,
  applicationUniversalIdentifier,
  deps,
  schemaProvider,
  workspaceDoc,
}: {
  workspaceId: string;
  applicationId: string;
  applicationUniversalIdentifier: string;
  deps?: GenerateDeps;
  schemaProvider?: IWorkspaceSchemaProvider;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workspaceDoc?: any;
}): Promise<Buffer> {
  // PORT-NOTE: When deps/schemaProvider are not provided this function cannot
  // generate a real bundle. It throws a descriptive error so callers can supply
  // the required dependencies as the port progresses.
  if (!deps || !schemaProvider) {
    throw new SdkClientException(
      `generateSdkClientForApplication requires deps and schemaProvider — wire them from SdkClientGenerationService.`,
      SdkClientExceptionCode.GENERATION_FAILED,
    );
  }

  const graphqlSchema = await schemaProvider.createGraphQLSchema(
    workspaceDoc,
    applicationId,
  );

  const schema =
    typeof graphqlSchema === "string"
      ? graphqlSchema
      : printSchema(
          graphqlSchema as Parameters<typeof printSchema>[0],
        );

  return generateAndStore(deps, {
    workspaceId,
    applicationId,
    applicationUniversalIdentifier,
    schema,
  });
}

// ---- class-style surface ----

type GenerationServiceDeps = GenerateDeps & {
  workspaceSchemaProvider: IWorkspaceSchemaProvider;
  // PORT-NOTE: message-queue service omitted — enqueue directly from caller
};

export class SdkClientGenerationService {
  constructor(private readonly deps: GenerationServiceDeps) {}

  async enqueueSdkClientGenerationForWorkspace(
    _workspaceId: string,
  ): Promise<void> {
    // PORT-NOTE: enqueueSdkClientGenerationForWorkspace requires ApplicationService
    // (not yet ported). Callers should enqueue jobs directly via SabNode's queue
    // infrastructure using GENERATE_SDK_CLIENT_JOB_NAME and GenerateSdkClientJobData.
    throw new Error(
      "enqueueSdkClientGenerationForWorkspace: ApplicationService not yet ported — enqueue manually.",
    );
  }

  async generateSdkClientForApplication({
    workspaceId,
    applicationId,
    applicationUniversalIdentifier,
    workspaceDoc,
  }: {
    workspaceId: string;
    applicationId: string;
    applicationUniversalIdentifier: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    workspaceDoc: any;
  }): Promise<Buffer> {
    return generateSdkClientForApplication({
      workspaceId,
      applicationId,
      applicationUniversalIdentifier,
      deps: this.deps,
      schemaProvider: this.deps.workspaceSchemaProvider,
      workspaceDoc,
    });
  }
}
