"use client";

import { Button } from "@/components/sabcrm/20ui/zoru";

interface Row {
  module: string;
  slug: string;
  method: string;
  path: string;
  summary: string;
  description: string | null;
  pathParams: Array<{ name: string; type: string; description: string }>;
  queryParams: Array<{ name: string; type: string; required: boolean; description: string }>;
  hasBody: boolean;
}

export function OpenApiExportButton({ endpoint }: { endpoint: Row }) {
  const handleExport = () => {
    const openApiSchema = {
      openapi: "3.0.0",
      info: {
        title: endpoint.summary,
        version: "1.0.0",
      },
      paths: {
        [endpoint.path]: {
          [endpoint.method.toLowerCase()]: {
            summary: endpoint.summary,
            description: endpoint.description || "",
            parameters: [
              ...endpoint.pathParams.map(p => ({
                name: p.name,
                in: "path",
                required: true,
                description: p.description,
                schema: { type: p.type === "number" ? "integer" : "string" }
              })),
              ...endpoint.queryParams.map(p => ({
                name: p.name,
                in: "query",
                required: p.required,
                description: p.description,
                schema: { type: p.type === "number" ? "integer" : p.type === "boolean" ? "boolean" : "string" }
              }))
            ],
            responses: {
              "200": {
                description: "Successful response"
              }
            }
          }
        }
      }
    };

    if (endpoint.hasBody) {
      (openApiSchema.paths[endpoint.path] as any)[endpoint.method.toLowerCase()].requestBody = {
        content: {
          "application/json": {
            schema: {
              type: "object"
            }
          }
        }
      };
    }

    const blob = new Blob([JSON.stringify(openApiSchema, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `openapi-${endpoint.slug}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport}>
      Export OpenAPI JSON
    </Button>
  );
}
