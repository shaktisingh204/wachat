import "server-only";

// PORT-NOTE: NestJS @Injectable() / @InjectRepository() removed.
// FileStorageService, ApplicationEntity (Mongo), WorkspaceCacheService are referenced
// by import path stubs — wire concrete implementations when those modules are ported.
// ApplicationEntity (TypeORM) → sabcrm_application Mongo collection.
// streamToBuffer inlined below.

import { Readable } from "stream";

import type { SdkModuleName } from "@/lib/sabcrm/server/src/engine/core-modules/sdk-client/constants/allowed-sdk-modules";
import {
  SdkClientException,
  SdkClientExceptionCode,
} from "@/lib/sabcrm/server/src/engine/core-modules/sdk-client/exceptions/sdk-client.exception";
import { generateSdkClientForApplication } from "@/lib/sabcrm/server/src/engine/core-modules/sdk-client/sdk-client-generation.service";

// PORT-NOTE: FileFolder enum mirrors twenty-shared/types FileFolder.
export enum FileFolder {
  GeneratedSdkClient = "GeneratedSdkClient",
}

const SDK_CLIENT_ARCHIVE_NAME = "twenty-client-sdk.zip";

// ---- inline helpers ----

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

// ---- abstract interfaces (filled by the file-storage port when available) ----

export interface IFileStorageService {
  readFile(opts: {
    workspaceId: string;
    applicationUniversalIdentifier: string;
    fileFolder: FileFolder;
    resourcePath: string;
  }): Promise<Readable>;

  writeFile(opts: {
    workspaceId: string;
    applicationUniversalIdentifier: string;
    fileFolder: FileFolder;
    resourcePath: string;
    sourceFile: Buffer;
    settings: { isTemporaryFile: boolean; toDelete: boolean };
  }): Promise<void>;
}

export interface IWorkspaceCacheService {
  invalidateAndRecompute(
    workspaceId: string,
    keys: string[],
  ): Promise<void>;
}

export interface IApplicationRepository {
  updateOne(
    filter: { id: string; workspaceId: string },
    update: Partial<{ isSdkLayerStale: boolean }>,
  ): Promise<void>;
}

// ---- service ----

type ArchiveServiceDeps = {
  fileStorageService: IFileStorageService;
  applicationRepository: IApplicationRepository;
  workspaceCacheService: IWorkspaceCacheService;
};

async function downloadArchiveBufferOrGenerate(
  deps: ArchiveServiceDeps,
  {
    workspaceId,
    applicationId,
    applicationUniversalIdentifier,
  }: {
    workspaceId: string;
    applicationId: string;
    applicationUniversalIdentifier: string;
  },
): Promise<Buffer> {
  try {
    const stream = await deps.fileStorageService.readFile({
      workspaceId,
      applicationUniversalIdentifier,
      fileFolder: FileFolder.GeneratedSdkClient,
      resourcePath: SDK_CLIENT_ARCHIVE_NAME,
    });

    return await streamToBuffer(stream);
  } catch (error) {
    // Only fall through to generation if the file was simply not found.
    // Re-throw all other errors.
    const isNotFound =
      error instanceof Error && error.message.includes("NOT_FOUND");
    if (!isNotFound) {
      throw error;
    }
  }

  console.warn(
    `SDK client archive missing for application "${applicationUniversalIdentifier}" in workspace "${workspaceId}", generating on-the-fly`,
  );

  return generateSdkClientForApplication({
    workspaceId,
    applicationId,
    applicationUniversalIdentifier,
  });
}

export async function downloadAndExtractToPackage(
  deps: ArchiveServiceDeps,
  {
    workspaceId,
    applicationId,
    applicationUniversalIdentifier,
    targetPackagePath,
  }: {
    workspaceId: string;
    applicationId: string;
    applicationUniversalIdentifier: string;
    targetPackagePath: string;
  },
): Promise<void> {
  const fs = await import("fs/promises");
  const archiveBuffer = await downloadArchiveBufferOrGenerate(deps, {
    workspaceId,
    applicationId,
    applicationUniversalIdentifier,
  });

  await fs.rm(targetPackagePath, { recursive: true, force: true });
  await fs.mkdir(targetPackagePath, { recursive: true });

  const { default: unzipper } = await import("unzipper");
  const directory = await unzipper.Open.buffer(archiveBuffer);

  await directory.extract({ path: targetPackagePath });
}

export async function downloadArchiveBuffer(
  deps: ArchiveServiceDeps,
  opts: {
    workspaceId: string;
    applicationId: string;
    applicationUniversalIdentifier: string;
  },
): Promise<Buffer> {
  return downloadArchiveBufferOrGenerate(deps, opts);
}

export async function getClientModuleFromArchive(
  opts: {
    workspaceId: string;
    applicationId: string;
    applicationUniversalIdentifier: string;
    moduleName: SdkModuleName;
  } & Partial<ArchiveServiceDeps>,
): Promise<Buffer> {
  const filePath = `dist/${opts.moduleName}.mjs`;

  // When called without deps (e.g. from the controller stub), we generate directly.
  const archiveBuffer = await generateSdkClientForApplication({
    workspaceId: opts.workspaceId,
    applicationId: opts.applicationId,
    applicationUniversalIdentifier: opts.applicationUniversalIdentifier,
  });

  const { default: unzipper } = await import("unzipper");
  const directory = await unzipper.Open.buffer(archiveBuffer);

  const entry = directory.files.find(
    (file: { path: string }) =>
      file.path === filePath || file.path === `./${filePath}`,
  );

  if (!entry) {
    throw new SdkClientException(
      `Module "${opts.moduleName}" not found in SDK client archive for application "${opts.applicationUniversalIdentifier}" in workspace "${opts.workspaceId}"`,
      SdkClientExceptionCode.FILE_NOT_FOUND_IN_ARCHIVE,
    );
  }

  return (entry as { buffer(): Promise<Buffer> }).buffer();
}

export async function markSdkLayerFresh(
  deps: ArchiveServiceDeps,
  {
    applicationId,
    workspaceId,
  }: {
    applicationId: string;
    workspaceId: string;
  },
): Promise<void> {
  await deps.applicationRepository.updateOne(
    { id: applicationId, workspaceId },
    { isSdkLayerStale: false },
  );

  await deps.workspaceCacheService.invalidateAndRecompute(workspaceId, [
    "flatApplicationMaps",
  ]);
}

// Class-style surface for consumers that import SdkClientArchiveService by name.
export class SdkClientArchiveService {
  constructor(private readonly deps: ArchiveServiceDeps) {}

  downloadAndExtractToPackage = (
    opts: Parameters<typeof downloadAndExtractToPackage>[1],
  ) => downloadAndExtractToPackage(this.deps, opts);

  downloadArchiveBuffer = (
    opts: Parameters<typeof downloadArchiveBuffer>[1],
  ) => downloadArchiveBuffer(this.deps, opts);

  getClientModuleFromArchive = (
    opts: Parameters<typeof getClientModuleFromArchive>[0],
  ) => getClientModuleFromArchive({ ...opts, ...this.deps });

  markSdkLayerFresh = (opts: Parameters<typeof markSdkLayerFresh>[1]) =>
    markSdkLayerFresh(this.deps, opts);
}
