import "server-only";

import path from "path";

import { v4 } from "uuid";

import {
  type CodeExecutionData,
  type CodeExecutionFile,
  type CodeExecutionState,
} from "@/lib/sabcrm/shared/src/ai/types/DataMessagePart";
import { FileFolder } from "@/lib/sabcrm/shared/src/types/FileFolder";

import { CodeInterpreterInputZodSchema } from "@/lib/sabcrm/server/src/engine/core-modules/tool/tools/code-interpreter-tool/code-interpreter-tool.schema";
import { TWENTY_MCP_HELPER } from "@/lib/sabcrm/server/src/engine/core-modules/tool/tools/code-interpreter-tool/twenty-mcp-helper.const";
import {
  type CodeInterpreterFileInput,
  type CodeInterpreterInput,
} from "@/lib/sabcrm/server/src/engine/core-modules/tool/tools/code-interpreter-tool/types/code-interpreter-input.type";
import { type ToolExecutionContext } from "@/lib/sabcrm/server/src/engine/core-modules/tool/types/tool-execution-context.type";
import { type ToolInput } from "@/lib/sabcrm/server/src/engine/core-modules/tool/types/tool-input.type";
import { type ToolOutput } from "@/lib/sabcrm/server/src/engine/core-modules/tool/types/tool-output.type";
import { type Tool } from "@/lib/sabcrm/server/src/engine/core-modules/tool/types/tool.type";

// PORT-NOTE: The following NestJS services have no direct Next.js equivalent.
// Callers must supply concrete implementations (or stubs) for each interface
// when constructing CodeInterpreterTool.

export type InputFile = {
  filename: string;
  content: Buffer;
  mimeType: string;
};

export type OutputFile = {
  filename: string;
  content: Buffer;
  mimeType: string;
};

export type CodeExecutionResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  files: OutputFile[];
  error?: string;
};

export type CodeExecutionCallbacks = {
  onStdout?: (line: string) => void;
  onStderr?: (line: string) => void;
  onResult?: (file: OutputFile) => Promise<void>;
};

export type CodeExecutionOptions = {
  env?: Record<string, string>;
};

// Interfaces that callers must provide:
export type ICodeInterpreterService = {
  execute(
    code: string,
    inputFiles: InputFile[],
    options: CodeExecutionOptions,
    callbacks: CodeExecutionCallbacks,
  ): Promise<CodeExecutionResult>;
};

export type IFileStorageService = {
  writeFile(params: {
    sourceFile: Buffer;
    fileFolder: FileFolder;
    applicationUniversalIdentifier: string;
    workspaceId: string;
    resourcePath: string;
    fileId: string;
    settings: { isTemporaryFile: boolean; toDelete: boolean };
  }): Promise<{ id: string }>;
};

export type IFileService = {
  getFileContentById(params: {
    fileId: string;
    workspaceId: string;
    fileFolder: FileFolder;
  }): Promise<{ buffer: Buffer; mimeType: string } | null>;
};

export type IFileUrlService = {
  signFileByIdUrl(params: {
    fileId: string;
    workspaceId: string;
    fileFolder: FileFolder;
  }): Promise<string>;
};

export type IApplicationService = {
  findWorkspaceTwentyStandardAndCustomApplicationOrThrow(params: {
    workspaceId: string;
  }): Promise<{
    workspaceCustomFlatApplication: { universalIdentifier: string };
  }>;
};

export type ISecureHttpClientService = unknown;

export type ITwentyConfigService = {
  get(key: string): string;
};

export type IJwtWrapperService = {
  signAsyncOrThrow(
    payload: Record<string, unknown>,
    options: { expiresIn: string },
  ): Promise<string>;
};

export type CodeInterpreterToolDeps = {
  codeInterpreterService: ICodeInterpreterService;
  fileStorageService: IFileStorageService;
  fileService: IFileService;
  fileUrlService: IFileUrlService;
  applicationService: IApplicationService;
  twentyConfigService: ITwentyConfigService;
  jwtWrapperService: IJwtWrapperService;
};

function buildExecutionState(
  executionId: string,
  state: CodeExecutionState,
  code: string,
  stdout: string,
  stderr: string,
  files: CodeExecutionFile[],
  extras?: { exitCode?: number; executionTimeMs?: number; error?: string },
): CodeExecutionData {
  return {
    executionId,
    state,
    code,
    language: "python",
    stdout,
    stderr,
    files,
    ...extras,
  };
}

async function downloadInputFiles(
  deps: CodeInterpreterToolDeps,
  files: CodeInterpreterFileInput[] | undefined,
  workspaceId: string | undefined,
): Promise<InputFile[]> {
  if (!files || files.length === 0) {
    return [];
  }

  const inputFiles: InputFile[] = [];

  for (const file of files) {
    try {
      if (!workspaceId) {
        console.warn(
          `Cannot resolve file ${file.filename}: workspaceId is required`,
        );
        continue;
      }

      const fileContent = await deps.fileService.getFileContentById({
        fileId: file.fileId,
        workspaceId,
        fileFolder: FileFolder.AgentChat,
      });

      if (fileContent === null) {
        console.warn(
          `File ${file.filename} no longer available (id=${file.fileId})`,
        );
        continue;
      }

      inputFiles.push({
        filename: file.filename,
        content: fileContent.buffer,
        mimeType: fileContent.mimeType,
      });
    } catch (error) {
      console.warn(`Failed to resolve file ${file.filename}`, error);
    }
  }

  return inputFiles;
}

async function generateSessionToken(
  deps: CodeInterpreterToolDeps,
  workspaceId: string,
  userId?: string,
  userWorkspaceId?: string,
): Promise<string> {
  return deps.jwtWrapperService.signAsyncOrThrow(
    {
      sub: userId ?? workspaceId,
      type: "ACCESS",
      workspaceId,
      userId: userId ?? workspaceId,
      userWorkspaceId: userWorkspaceId ?? workspaceId,
      authProvider: "Password",
    },
    { expiresIn: "5m" },
  );
}

async function uploadSingleFile(
  deps: CodeInterpreterToolDeps,
  file: OutputFile,
  workspaceId: string,
  executionId: string,
): Promise<CodeExecutionFile | null> {
  const sanitizedFilename = path.basename(file.filename);

  try {
    const { workspaceCustomFlatApplication } =
      await deps.applicationService.findWorkspaceTwentyStandardAndCustomApplicationOrThrow(
        { workspaceId },
      );

    const fileId = v4();
    const resourcePath = `code-interpreter/${executionId}/${fileId}-${sanitizedFilename}`;

    const savedFile = await deps.fileStorageService.writeFile({
      sourceFile: file.content,
      fileFolder: FileFolder.AgentChat,
      applicationUniversalIdentifier:
        workspaceCustomFlatApplication.universalIdentifier,
      workspaceId,
      resourcePath,
      fileId,
      settings: {
        isTemporaryFile: false,
        toDelete: false,
      },
    });

    const signedUrl = await deps.fileUrlService.signFileByIdUrl({
      fileId: savedFile.id,
      workspaceId,
      fileFolder: FileFolder.AgentChat,
    });

    return {
      fileId: savedFile.id,
      filename: sanitizedFilename,
      url: signedUrl,
      mimeType: file.mimeType,
    };
  } catch (error) {
    console.warn(`Failed to upload output file ${file.filename}`, error);
    return null;
  }
}

async function uploadOutputFiles(
  deps: CodeInterpreterToolDeps,
  files: OutputFile[],
  workspaceId: string,
  executionId: string,
  alreadyUploadedFiles: CodeExecutionFile[],
): Promise<CodeExecutionFile[]> {
  const outputFileUrls: CodeExecutionFile[] = [...alreadyUploadedFiles];
  const uploadedFilenames = new Set(
    alreadyUploadedFiles.map((uploadedFile) => uploadedFile.filename),
  );

  for (const file of files) {
    const sanitizedFilename = path.basename(file.filename);

    if (uploadedFilenames.has(sanitizedFilename)) {
      continue;
    }

    const uploadedFile = await uploadSingleFile(
      deps,
      file,
      workspaceId,
      executionId,
    );

    if (uploadedFile) {
      outputFileUrls.push(uploadedFile);
    }
  }

  return outputFileUrls;
}

export async function executeCodeInterpreter(
  deps: CodeInterpreterToolDeps,
  parameters: ToolInput,
  context: ToolExecutionContext,
): Promise<ToolOutput> {
  const { workspaceId, userId, userWorkspaceId, onCodeExecutionUpdate } =
    context;
  const { code, files } = parameters as CodeInterpreterInput;
  const executionId = v4();
  const startTime = Date.now();

  let accumulatedStdout = "";
  let accumulatedStderr = "";
  const streamedFiles: CodeExecutionFile[] = [];

  onCodeExecutionUpdate?.(
    buildExecutionState(executionId, "pending", code, "", "", []),
  );

  try {
    const inputFiles = await downloadInputFiles(deps, files, workspaceId);

    onCodeExecutionUpdate?.(
      buildExecutionState(executionId, "running", code, "", "", []),
    );

    const serverUrl = deps.twentyConfigService.get("SERVER_URL");
    const sessionToken = await generateSessionToken(
      deps,
      workspaceId,
      userId,
      userWorkspaceId,
    );

    const codeWithHelper = TWENTY_MCP_HELPER + "\n\n" + code;

    const result = await deps.codeInterpreterService.execute(
      codeWithHelper,
      inputFiles,
      {
        env: {
          TWENTY_SERVER_URL: serverUrl,
          TWENTY_API_TOKEN: sessionToken,
        },
      },
      {
        onStdout: (line) => {
          accumulatedStdout += line + "\n";
          onCodeExecutionUpdate?.(
            buildExecutionState(
              executionId,
              "running",
              code,
              accumulatedStdout,
              accumulatedStderr,
              streamedFiles,
            ),
          );
        },
        onStderr: (line) => {
          accumulatedStderr += line + "\n";
          onCodeExecutionUpdate?.(
            buildExecutionState(
              executionId,
              "running",
              code,
              accumulatedStdout,
              accumulatedStderr,
              streamedFiles,
            ),
          );
        },
        onResult: async (outputFile: OutputFile) => {
          const uploadedFile = await uploadSingleFile(
            deps,
            outputFile,
            workspaceId,
            executionId,
          );

          if (uploadedFile) {
            streamedFiles.push(uploadedFile);
            onCodeExecutionUpdate?.(
              buildExecutionState(
                executionId,
                "running",
                code,
                accumulatedStdout,
                accumulatedStderr,
                streamedFiles,
              ),
            );
          }
        },
      },
    );

    const allOutputFileUrls = await uploadOutputFiles(
      deps,
      result.files,
      workspaceId,
      executionId,
      streamedFiles,
    );

    const executionTimeMs = Date.now() - startTime;
    const finalState = result.exitCode === 0 ? "completed" : "error";

    onCodeExecutionUpdate?.(
      buildExecutionState(
        executionId,
        finalState,
        code,
        result.stdout || accumulatedStdout,
        result.stderr || accumulatedStderr,
        allOutputFileUrls,
        {
          exitCode: result.exitCode,
          executionTimeMs,
          error: result.error,
        },
      ),
    );

    return {
      success: result.exitCode === 0,
      message:
        result.exitCode === 0
          ? "Code executed successfully"
          : "Code execution failed",
      result: {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        files: allOutputFileUrls,
        error: result.error,
      },
    };
  } catch (error) {
    console.error("Code interpreter execution failed", error);

    const executionTimeMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error
        ? error.message
        : `Unexpected error: ${String(error)}`;

    onCodeExecutionUpdate?.(
      buildExecutionState(
        executionId,
        "error",
        code,
        accumulatedStdout,
        accumulatedStderr,
        streamedFiles,
        { executionTimeMs, error: errorMessage },
      ),
    );

    return {
      success: false,
      message: "Code interpreter execution failed",
      error: errorMessage,
    };
  }
}

// Class wrapper matching the original Tool interface, for callers that expect it.
export class CodeInterpreterTool implements Tool {
  readonly description =
    "Execute Python code in a sandboxed environment for data analysis, CSV processing, calculations, and chart generation. Returns stdout, stderr, and generated files. Input files are available at /home/user/{filename}. Save output files (charts, reports) to /home/user/output/ using plt.savefig() for matplotlib charts.";

  readonly inputSchema = CodeInterpreterInputZodSchema;

  constructor(private readonly deps: CodeInterpreterToolDeps) {}

  execute(parameters: ToolInput, context: ToolExecutionContext): Promise<ToolOutput> {
    return executeCodeInterpreter(this.deps, parameters, context);
  }
}
