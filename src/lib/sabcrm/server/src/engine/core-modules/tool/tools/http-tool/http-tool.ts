import "server-only";

import { HttpRequestInputZodSchema } from "@/lib/sabcrm/server/src/engine/core-modules/tool/tools/http-tool/http-tool.schema";
import { type HttpRequestInput } from "@/lib/sabcrm/server/src/engine/core-modules/tool/tools/http-tool/types/http-request-input.type";
import { type ToolInput } from "@/lib/sabcrm/server/src/engine/core-modules/tool/types/tool-input.type";
import { type ToolOutput } from "@/lib/sabcrm/server/src/engine/core-modules/tool/types/tool-output.type";
import { type ToolExecutionContext } from "@/lib/sabcrm/server/src/engine/core-modules/tool/types/tool-execution-context.type";
import { type Tool } from "@/lib/sabcrm/server/src/engine/core-modules/tool/types/tool.type";

// PORT-NOTE: SecureHttpClientService (NestJS/Axios) is replaced by a plain
// fetch-based implementation. Callers may override `httpClient` with their
// own implementation (e.g. to add rate limiting, allow-listing, etc.).

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

// Inlined parseDataFromContentType to avoid depending on twenty-shared/workflow
// which is not yet ported.
function parseDataFromContentType(
  data: unknown,
  contentType?: string,
): string | FormData | URLSearchParams {
  const isString = typeof data === "string";

  switch (contentType) {
    case "application/x-www-form-urlencoded": {
      let obj: Record<string, string>;
      if (isString) {
        try {
          obj = JSON.parse(data as string);
        } catch {
          obj = {};
        }
      } else {
        obj = data as Record<string, string>;
      }
      return new URLSearchParams(obj).toString();
    }
    case "multipart/form-data": {
      const form = new FormData();
      if (isString) {
        try {
          const parsed = JSON.parse(data as string);
          Object.entries(parsed).forEach(([k, v]) =>
            form.append(k, String(v)),
          );
        } catch {
          throw new Error("String data for FormData must be valid JSON");
        }
      } else {
        Object.entries(data as Record<string, unknown>).forEach(([k, v]) =>
          form.append(k, String(v)),
        );
      }
      return form;
    }
    case "text/plain": {
      if (isString) return data as string;
      return Object.entries(data as Record<string, unknown>)
        .map(([k, v]) => `${k}=${v}`)
        .join("\n");
    }
    default: {
      if (isString) return data as string;
      return JSON.stringify(data);
    }
  }
}

export class HttpTool implements Tool {
  readonly description =
    "Make an HTTP request to any URL with configurable method, headers, and body.";
  readonly inputSchema = HttpRequestInputZodSchema;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const { url, method, headers, body } = parameters as HttpRequestInput;
    const headersCopy: Record<string, string> = { ...(headers ?? {}) };
    const isMethodForBody = (["POST", "PUT", "PATCH"] as HttpMethod[]).includes(
      method,
    );

    try {
      const fetchInit: RequestInit = {
        method,
        headers: headersCopy,
      };

      if (isMethodForBody && body !== undefined) {
        const contentType = headersCopy["content-type"];
        const parsedBody = parseDataFromContentType(body, contentType);

        if (contentType === "multipart/form-data") {
          // Let fetch set Content-Type with the correct boundary automatically.
          delete headersCopy["content-type"];
          fetchInit.headers = headersCopy;
        }

        fetchInit.body =
          parsedBody instanceof FormData
            ? parsedBody
            : String(parsedBody);
      }

      const response = await fetch(url, fetchInit);

      const responseContentType =
        response.headers.get("content-type") ?? "";
      let responseData: unknown;

      if (responseContentType.includes("application/json")) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      return {
        success: response.ok,
        message: `HTTP ${method} request to ${url} ${response.ok ? "completed successfully" : "failed"}`,
        result: responseData as object,
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      };
    } catch (error) {
      return {
        success: false,
        message: `HTTP ${method} request to ${url} failed`,
        error: error instanceof Error ? error.message : "HTTP request failed",
      };
    }
  }
}
