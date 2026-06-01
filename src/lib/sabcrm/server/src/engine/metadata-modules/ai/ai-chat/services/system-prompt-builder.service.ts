import "server-only";

// PORT-NOTE: NestJS @Injectable() removed. Export as a plain class or call
// createSystemPromptBuilderService() for a factory pattern.

export type SystemPromptSection = {
  title: string;
  content: string;
  estimatedTokenCount: number;
};

export type SystemPromptPreview = {
  sections: SystemPromptSection[];
  estimatedTokenCount: number;
};

export type ToolIndexEntry = {
  name: string;
  category: string;
};

export type FlatSkill = {
  name: string;
  description?: string;
  label: string;
};

export type UserContext = {
  firstName: string;
  lastName: string;
  locale: string;
  timezone?: string;
};

// ~4 characters per token for mixed English/code content
const estimateTokenCount = (text: string): number => Math.ceil(text.length / 4);

// Supported tool categories — mirrors Twenty's ToolCategory enum.
const TOOL_CATEGORIES = [
  'DATABASE_CRUD',
  'ACTION',
  'WORKFLOW',
  'METADATA',
  'VIEW',
  'DASHBOARD',
  'LOGIC_FUNCTION',
  'NAVIGATION_MENU_ITEM',
  'WEBHOOK',
] as const;

type ToolCategory = (typeof TOOL_CATEGORIES)[number];

const CATEGORY_LABELS: Record<ToolCategory, string> = {
  DATABASE_CRUD: 'Database Tools (CRUD operations)',
  ACTION: 'Action Tools (HTTP, Email, etc.)',
  WORKFLOW: 'Workflow Tools (create/manage workflows)',
  METADATA: 'Metadata Tools (schema management)',
  VIEW: 'View Tools (manage views, fields, filters, and sorts)',
  DASHBOARD: 'Dashboard Tools (create/manage dashboards)',
  LOGIC_FUNCTION: 'Logic Functions (custom tools)',
  NAVIGATION_MENU_ITEM:
    'Navigation Menu Item Tools (sidebar entries, folders, and user favorites)',
  WEBHOOK: 'Webhook Tools (outgoing webhooks)',
};

// Copied from the source's CHAT_SYSTEM_PROMPTS constants (not ported separately).
// PORT-NOTE: In the full SabNode port these should come from
// @/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-chat/constants/chat-system-prompts.const
const BASE_SYSTEM_PROMPT = `You are a CRM assistant. Help the user manage their contacts, companies, and workflows effectively.`;
const RESPONSE_FORMAT_PROMPT = `When responding, be concise and actionable. Use markdown formatting where helpful.`;
const BROWSING_CONTEXT_INSTRUCTION = `Use the browsing context only when the user explicitly asks about the current page or record.`;

export type SystemPromptBuilderServiceDeps = {
  buildToolIndex: (
    workspaceId: string,
    roleId: string,
    userContext: { userId: string; userWorkspaceId: string },
  ) => Promise<ToolIndexEntry[]>;
  findAllFlatSkills: (workspaceId: string) => Promise<FlatSkill[]>;
  buildUserAndAgentActorContext: (
    userWorkspaceId: string,
    workspaceId: string,
  ) => Promise<{
    roleId: string;
    userId: string;
    userContext: UserContext | undefined;
  }>;
  COMMON_PRELOAD_TOOLS: string[];
  LEARN_TOOLS_TOOL_NAME: string;
  EXECUTE_TOOL_TOOL_NAME: string;
  LOAD_SKILL_TOOL_NAME: string;
};

export type SystemPromptBuilderService = {
  buildPreview: (
    workspaceId: string,
    userWorkspaceId: string,
    workspaceInstructions?: string,
  ) => Promise<SystemPromptPreview>;
  buildFullPrompt: (
    toolCatalog: ToolIndexEntry[],
    skillCatalog: FlatSkill[],
    preloadedTools: string[],
    storedFiles?: Array<{ filename: string; fileId: string }>,
    workspaceInstructions?: string,
    userContext?: UserContext,
  ) => string;
  buildWorkspaceInstructionsSection: (instructions: string) => string;
  buildUserContextSection: (userContext: UserContext) => string;
  buildUploadedFilesSection: (
    storedFiles: Array<{ filename: string; fileId: string }>,
  ) => string;
  buildSkillCatalogSection: (skillCatalog: FlatSkill[]) => string;
  buildToolCatalogSection: (
    toolCatalog: ToolIndexEntry[],
    preloadedTools: string[],
  ) => string;
};

export function createSystemPromptBuilderService(
  deps: SystemPromptBuilderServiceDeps,
): SystemPromptBuilderService {
  const {
    buildToolIndex,
    findAllFlatSkills,
    buildUserAndAgentActorContext,
    COMMON_PRELOAD_TOOLS,
    LEARN_TOOLS_TOOL_NAME,
    EXECUTE_TOOL_TOOL_NAME,
    LOAD_SKILL_TOOL_NAME,
  } = deps;

  const service: SystemPromptBuilderService = {
    async buildPreview(workspaceId, userWorkspaceId, workspaceInstructions) {
      const { roleId, userId, userContext } =
        await buildUserAndAgentActorContext(userWorkspaceId, workspaceId);

      const toolCatalog = await buildToolIndex(workspaceId, roleId, {
        userId,
        userWorkspaceId,
      });

      const skillCatalog = await findAllFlatSkills(workspaceId);

      const sections: SystemPromptSection[] = [];

      sections.push({
        title: 'Base Instructions',
        content: BASE_SYSTEM_PROMPT,
        estimatedTokenCount: estimateTokenCount(BASE_SYSTEM_PROMPT),
      });

      sections.push({
        title: 'Response Format',
        content: RESPONSE_FORMAT_PROMPT,
        estimatedTokenCount: estimateTokenCount(RESPONSE_FORMAT_PROMPT),
      });

      if (workspaceInstructions) {
        const workspaceSection =
          service.buildWorkspaceInstructionsSection(workspaceInstructions);

        sections.push({
          title: 'Workspace Instructions',
          content: workspaceSection,
          estimatedTokenCount: estimateTokenCount(workspaceSection),
        });
      }

      if (userContext) {
        const userSection = service.buildUserContextSection(userContext);

        sections.push({
          title: 'User Context',
          content: userSection,
          estimatedTokenCount: estimateTokenCount(userSection),
        });
      }

      const toolSection = service.buildToolCatalogSection(
        toolCatalog,
        COMMON_PRELOAD_TOOLS,
      );

      sections.push({
        title: 'Tool Catalog',
        content: toolSection,
        estimatedTokenCount: estimateTokenCount(toolSection),
      });

      const skillSection = service.buildSkillCatalogSection(skillCatalog);

      if (skillSection) {
        sections.push({
          title: 'Skill Catalog',
          content: skillSection,
          estimatedTokenCount: estimateTokenCount(skillSection),
        });
      }

      const totalTokens = sections.reduce(
        (sum, section) => sum + section.estimatedTokenCount,
        0,
      );

      return { sections, estimatedTokenCount: totalTokens };
    },

    buildFullPrompt(
      toolCatalog,
      skillCatalog,
      preloadedTools,
      storedFiles,
      workspaceInstructions,
      userContext,
    ): string {
      const parts: string[] = [
        BASE_SYSTEM_PROMPT,
        BROWSING_CONTEXT_INSTRUCTION,
        RESPONSE_FORMAT_PROMPT,
      ];

      if (workspaceInstructions) {
        parts.push(service.buildWorkspaceInstructionsSection(workspaceInstructions));
      }

      if (userContext) {
        parts.push(service.buildUserContextSection(userContext));
      }

      parts.push(service.buildToolCatalogSection(toolCatalog, preloadedTools));
      parts.push(service.buildSkillCatalogSection(skillCatalog));

      if (storedFiles && storedFiles.length > 0) {
        parts.push(service.buildUploadedFilesSection(storedFiles));
      }

      return parts.join('\n');
    },

    buildWorkspaceInstructionsSection(instructions): string {
      return `
## Workspace Instructions

The following are custom instructions provided by the workspace administrator:

${instructions}`;
    },

    buildUserContextSection(userContext): string {
      const parts = [
        `User: ${userContext.firstName} ${userContext.lastName}`.trim(),
        `Locale: ${userContext.locale}`,
      ];

      if (userContext.timezone) {
        parts.push(`Timezone: ${userContext.timezone}`);
      }

      return `
## User Context

${parts.join('\n')}`;
    },

    buildUploadedFilesSection(storedFiles): string {
      const fileList = storedFiles.map((f) => `- ${f.filename}`).join('\n');

      const filesJson = JSON.stringify(
        storedFiles.map((f) => ({ filename: f.filename, fileId: f.fileId })),
      );

      return `
## Uploaded Files

The user has uploaded the following files:
${fileList}

**IMPORTANT**: Use the \`code_interpreter\` tool to analyze these files.
When calling code_interpreter, include the files parameter with these values (use fileId to reference uploaded files):
\`\`\`json
${filesJson}
\`\`\`

In your Python code, access files at \`/home/user/{filename}\`.`;
    },

    buildSkillCatalogSection(skillCatalog): string {
      if (skillCatalog.length === 0) {
        return '';
      }

      const skillsList = skillCatalog
        .map(
          (skill) =>
            `- \`${skill.name}\`: ${skill.description ?? skill.label}`,
        )
        .join('\n');

      return `
## Available Skills

Skills provide detailed expertise for specialized tasks. Load a skill before attempting complex operations.
To load a skill, call \`${LOAD_SKILL_TOOL_NAME}\` with the skill name(s).

${skillsList}`;
    },

    buildToolCatalogSection(toolCatalog, preloadedTools): string {
      const preloadedSet = new Set(preloadedTools);

      const toolsByCategory = new Map<string, ToolIndexEntry[]>();

      for (const tool of toolCatalog) {
        const category = tool.category;
        const existing = toolsByCategory.get(category) ?? [];

        existing.push(tool);
        toolsByCategory.set(category, existing);
      }

      const sections: string[] = [];

      const preloadedList =
        preloadedTools.length > 0
          ? preloadedTools.map((toolName) => `- \`${toolName}\` ✓`).join('\n')
          : '(none)';

      sections.push(`
## Available Tools

You have access to ${toolCatalog.length} tools. Some are pre-loaded and ready to use immediately.
To use any other tool, first call \`${LEARN_TOOLS_TOOL_NAME}\` to learn its schema, then call \`${EXECUTE_TOOL_TOOL_NAME}\` to run it.

### Pre-loaded Tools (ready to use now)
${preloadedList}

### Tool Catalog by Category`);

      for (const category of TOOL_CATEGORIES) {
        const tools = toolsByCategory.get(category);

        if (!tools || tools.length === 0) {
          continue;
        }

        const categoryLabel = CATEGORY_LABELS[category];

        sections.push(`
#### ${categoryLabel} (${tools.length} tools)
${tools
  .map((tool) => {
    const status = preloadedSet.has(tool.name) ? ' ✓' : '';

    return `- \`${tool.name}\`${status}`;
  })
  .join('\n')}`);
      }

      sections.push(`
### How to Use Tools
1. **Pre-loaded tools** (marked with ✓): Use directly
2. **Other tools**: First call \`${LEARN_TOOLS_TOOL_NAME}({toolNames: ["tool_name"]})\` to learn the schema, then call \`${EXECUTE_TOOL_TOOL_NAME}({toolName: "tool_name", arguments: {...}})\` to run it`);

      return sections.join('\n');
    },
  };

  return service;
}
