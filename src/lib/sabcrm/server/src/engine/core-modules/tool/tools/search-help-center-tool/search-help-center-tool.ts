import "server-only";

import axios from 'axios';

import { SearchHelpCenterInputZodSchema } from '@/lib/sabcrm/server/src/engine/core-modules/tool/tools/search-help-center-tool/search-help-center-tool.schema';
import { type ToolInput } from '@/lib/sabcrm/server/src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from '@/lib/sabcrm/server/src/engine/core-modules/tool/types/tool-output.type';
import { type ToolExecutionContext } from '@/lib/sabcrm/server/src/engine/core-modules/tool/types/tool-execution-context.type';
import { type Tool } from '@/lib/sabcrm/server/src/engine/core-modules/tool/types/tool.type';

// PORT-NOTE: NestJS class-based injection removed. Construct via factory or
// call searchHelpCenter() directly. Config values are read from process.env.
export const searchHelpCenterToolDescription =
  'Search Twenty documentation and help center to find information about features, setup, usage, and troubleshooting.';

export const searchHelpCenterToolInputSchema = SearchHelpCenterInputZodSchema;

export async function executeSearchHelpCenterTool(
  parameters: ToolInput,
  _context: ToolExecutionContext,
): Promise<ToolOutput> {
  const { query } = parameters as { query: string };

  try {
    const MINTLIFY_API_KEY = process.env.MINTLIFY_API_KEY;
    const MINTLIFY_SUBDOMAIN = process.env.MINTLIFY_SUBDOMAIN;

    const useDirectApi = MINTLIFY_API_KEY && MINTLIFY_SUBDOMAIN;

    const endpoint = useDirectApi
      ? `https://api-dsc.mintlify.com/v1/search/${MINTLIFY_SUBDOMAIN}`
      : 'https://twenty-help-search.com/search/twenty';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(useDirectApi && { Authorization: `Bearer ${MINTLIFY_API_KEY}` }),
    };

    const response = await axios.post(
      endpoint,
      { query, pageSize: 10 },
      { headers },
    );

    const results = response.data;

    if (results.length === 0) {
      return {
        success: true,
        message: `No help center articles found for "${query}"`,
        result: [],
      };
    }

    return {
      success: true,
      message: `Found ${results.length} relevant help center article${results.length === 1 ? '' : 's'} for "${query}"`,
      result: results,
    };
  } catch (error) {
    const isAxiosError = axios.isAxiosError(error);
    const errorDetail = isAxiosError
      ? (error.response?.data?.message as string | undefined) || error.message
      : error instanceof Error
        ? error.message
        : 'Help center search failed';

    return {
      success: false,
      message: `Failed to search help center for "${query}"`,
      error: errorDetail,
    };
  }
}

// Tool object conforming to the Tool interface
export const searchHelpCenterTool: Tool = {
  description: searchHelpCenterToolDescription,
  inputSchema: searchHelpCenterToolInputSchema,
  execute: executeSearchHelpCenterTool,
};
