import 'server-only';

// PORT-NOTE: NestJS @Injectable service → plain exported class.
// NestJS DI removed; dependencies are passed to the constructor directly.
// PermissionsService.hasToolPermission is stubbed as a local helper that
// reads from the RolePermissionConfig already present in the context
// (mirrors the engine's permission-flag check without the Mongo round-trip).
// CodeInterpreterService.isEnabled() is preserved as an env-flag check.
// z.toJSONSchema() from zod v4 is used directly (zod must be installed).

import { z } from 'zod';

import {
  type ToolProvider,
  ToolCategory,
} from '@/lib/sabcrm/server/src/engine/core-modules/tool-provider/interfaces/tool-provider.interface';
import { type GenerateDescriptorOptions } from '@/lib/sabcrm/server/src/engine/core-modules/tool-provider/interfaces/generate-descriptor-options.type';
import { type ToolProviderContext } from '@/lib/sabcrm/server/src/engine/core-modules/tool-provider/interfaces/tool-provider-context.type';
import { type ToolDescriptor } from '@/lib/sabcrm/server/src/engine/core-modules/tool-provider/types/tool-descriptor.type';
import { type ToolIndexEntry } from '@/lib/sabcrm/server/src/engine/core-modules/tool-provider/types/tool-index-entry.type';
import { type ToolOutput } from '@/lib/sabcrm/server/src/engine/core-modules/tool-provider/types/tool-output.type';

// ── Permission flag constants (mirrors twenty-shared/constants PermissionFlagType) ──

const PermissionFlagType = {
  HTTP_REQUEST_TOOL: 'HTTP_REQUEST_TOOL',
  SEND_EMAIL_TOOL: 'SEND_EMAIL_TOOL',
  CODE_INTERPRETER_TOOL: 'CODE_INTERPRETER_TOOL',
} as const;

// ── Minimal tool interface ────────────────────────────────────────────────────

export interface Tool {
  readonly description: string;
  readonly inputSchema: z.ZodType;
  execute(
    args: Record<string, unknown>,
    context: {
      workspaceId: string;
      userId?: string;
      userWorkspaceId?: string;
      onCodeExecutionUpdate?: (data: unknown) => void;
    },
  ): Promise<ToolOutput>;
}

// ── Local permission helper ───────────────────────────────────────────────────

function hasToolPermission(
  rolePermissionConfig: ToolProviderContext['rolePermissionConfig'],
  flag: string,
): boolean {
  return rolePermissionConfig.permissions.includes(flag);
}

// ── Code-interpreter availability ────────────────────────────────────────────

function isCodeInterpreterEnabled(): boolean {
  return process.env.CODE_INTERPRETER_ENABLED === 'true';
}

// ── ActionToolProvider ────────────────────────────────────────────────────────

export class ActionToolProvider implements ToolProvider {
  readonly category = ToolCategory.ACTION;

  private readonly toolMap: Map<string, Tool>;

  constructor(
    private readonly httpTool: Tool,
    private readonly sendEmailTool: Tool,
    private readonly draftEmailTool: Tool,
    private readonly searchHelpCenterTool: Tool,
    private readonly codeInterpreterTool: Tool,
    private readonly navigateAppTool: Tool,
  ) {
    this.toolMap = new Map<string, Tool>([
      ['http_request', this.httpTool],
      ['send_email', this.sendEmailTool],
      ['draft_email', this.draftEmailTool],
      ['search_help_center', this.searchHelpCenterTool],
      ['code_interpreter', this.codeInterpreterTool],
      ['navigate_app', this.navigateAppTool],
    ]);
  }

  async isAvailable(_context: ToolProviderContext): Promise<boolean> {
    return true;
  }

  async generateDescriptors(
    context: ToolProviderContext,
    options?: GenerateDescriptorOptions,
  ): Promise<(ToolIndexEntry | ToolDescriptor)[]> {
    const includeSchemas = options?.includeSchemas ?? true;
    const descriptors: (ToolIndexEntry | ToolDescriptor)[] = [];

    const hasHttpPermission = hasToolPermission(
      context.rolePermissionConfig,
      PermissionFlagType.HTTP_REQUEST_TOOL,
    );

    if (hasHttpPermission) {
      descriptors.push(
        this.buildDescriptor('http_request', this.httpTool, includeSchemas),
      );
    }

    const hasEmailPermission = hasToolPermission(
      context.rolePermissionConfig,
      PermissionFlagType.SEND_EMAIL_TOOL,
    );

    if (hasEmailPermission) {
      descriptors.push(
        this.buildDescriptor('send_email', this.sendEmailTool, includeSchemas),
      );
      descriptors.push(
        this.buildDescriptor('draft_email', this.draftEmailTool, includeSchemas),
      );
    }

    descriptors.push(
      this.buildDescriptor(
        'search_help_center',
        this.searchHelpCenterTool,
        includeSchemas,
      ),
    );

    descriptors.push(
      this.buildDescriptor('navigate_app', this.navigateAppTool, includeSchemas),
    );

    const hasCodeInterpreterPermission =
      isCodeInterpreterEnabled() &&
      hasToolPermission(
        context.rolePermissionConfig,
        PermissionFlagType.CODE_INTERPRETER_TOOL,
      );

    if (hasCodeInterpreterPermission) {
      descriptors.push(
        this.buildDescriptor(
          'code_interpreter',
          this.codeInterpreterTool,
          includeSchemas,
        ),
      );
    }

    return descriptors;
  }

  async executeStaticTool(
    toolName: string,
    args: Record<string, unknown>,
    context: ToolProviderContext,
  ): Promise<ToolOutput> {
    const tool = this.toolMap.get(toolName);

    if (!tool) {
      throw new Error(
        `Unknown action tool "${toolName}" (category: ${this.category})`,
      );
    }

    return tool.execute(args, {
      workspaceId: context.workspaceId,
      userId: context.userId,
      userWorkspaceId: context.userWorkspaceId,
      onCodeExecutionUpdate: context.onCodeExecutionUpdate,
    });
  }

  private buildDescriptor(
    toolId: string,
    tool: Tool,
    includeSchemas: boolean,
  ): ToolIndexEntry | ToolDescriptor {
    return {
      name: toolId,
      description: tool.description,
      category: ToolCategory.ACTION,
      icon: 'IconPlayerPlay',
      ...(includeSchemas && {
        inputSchema: z.toJSONSchema(tool.inputSchema),
      }),
      executionRef: { kind: 'static', toolId },
    };
  }
}
