import { NextResponse } from "next/server";

import { ensureStandardObjects, listObjects } from "@/lib/sabcrm/objects.server";
import { ensureSabcrmIndexes } from "@/lib/sabcrm/db";
import { verifyApiKey } from "@/lib/sabcrm/apikeys.server";
import { MAX_BULK_BATCH } from "@/lib/sabcrm/api-logs.server";
import type { FieldMetadata, FieldType, ObjectMetadata } from "@/lib/sabcrm/types";

/**
 * SabCRM — public REST API: OpenAPI 3.1 document.
 *
 * `GET /api/sabcrm/openapi`
 *
 * Returns a live OpenAPI 3.1 JSON document generated from the authenticating
 * tenant's object metadata. Every object (standard + custom) contributes:
 *
 *   GET    /api/sabcrm/{slug}                — list records
 *   POST   /api/sabcrm/{slug}                — create a record
 *   GET    /api/sabcrm/{slug}/{recordId}     — read one record
 *   PATCH  /api/sabcrm/{slug}/{recordId}     — update a record
 *   DELETE /api/sabcrm/{slug}/{recordId}     — delete a record
 *   POST   /api/sabcrm/{slug}/bulk           — bulk create/update/delete
 *
 * Each object also gets a generated component schema describing its fields, so
 * the document is self-describing and feeds straight into Swagger UI / codegen.
 *
 * Auth: the same SabCRM API key (bearer / `X-Api-Key`) used by the data routes —
 * the doc is tenant-specific because the object catalogue is. A `?baseUrl=`
 * query (or the request origin) sets the `servers` entry. Auth failures `401`.
 */

/** Mongo driver + node:crypto in the auth path — Node.js runtime only. */
export const runtime = "nodejs";
/** Per-request auth + metadata reads — never statically cached. */
export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ *
 * Field-type → JSON Schema mapping
 * ------------------------------------------------------------------ */

/** A minimal JSON-Schema fragment we emit per field. */
type JsonSchema = Record<string, unknown>;

/**
 * Map a SabCRM {@link FieldType} onto a JSON-Schema fragment. Composite types
 * (CURRENCY, ADDRESS, RELATION, …) are described as objects/arrays with a brief
 * note rather than fully expanded — enough for codegen + validation without
 * over-specifying SabCRM internals.
 */
function fieldSchema(field: FieldMetadata): JsonSchema {
  const base: JsonSchema = {};
  if (field.description) base.description = field.description;

  const type: FieldType = field.type;
  switch (type) {
    case "TEXT":
    case "RICH_TEXT_V2":
      return { ...base, type: "string" };
    case "EMAIL":
      return { ...base, type: "string", format: "email" };
    case "PHONE":
      return { ...base, type: "string" };
    case "LINK":
      return { ...base, type: "string", format: "uri" };
    case "NUMBER":
    case "RATING":
      return { ...base, type: "number" };
    case "NUMERIC":
      // High-precision numeric is string-backed in SabCRM.
      return { ...base, type: "string" };
    case "BOOLEAN":
      return { ...base, type: "boolean" };
    case "DATE":
      return { ...base, type: "string", format: "date" };
    case "DATE_TIME":
      return { ...base, type: "string", format: "date-time" };
    case "SELECT":
      return {
        ...base,
        type: "string",
        ...(field.options && field.options.length
          ? { enum: field.options.map((o) => o.value) }
          : {}),
      };
    case "MULTI_SELECT":
    case "ARRAY":
      return {
        ...base,
        type: "array",
        items:
          type === "MULTI_SELECT" && field.options && field.options.length
            ? { type: "string", enum: field.options.map((o) => o.value) }
            : { type: "string" },
      };
    case "CURRENCY":
      return {
        ...base,
        type: "object",
        properties: {
          amount: { type: "number" },
          currency: { type: "string" },
        },
      };
    case "RELATION":
      return {
        ...base,
        type: "object",
        description:
          (field.description ? `${field.description} ` : "") +
          `Relation to "${field.relation?.targetObject ?? "?"}".`,
        properties: { id: { type: "string" }, label: { type: "string" } },
      };
    case "FILE":
      return {
        ...base,
        type: "object",
        properties: { url: { type: "string", format: "uri" } },
      };
    case "FULL_NAME":
      return {
        ...base,
        type: "object",
        properties: {
          firstName: { type: "string" },
          lastName: { type: "string" },
        },
      };
    case "ADDRESS":
      return { ...base, type: "object" };
    case "EMAILS":
    case "PHONES":
    case "LINKS":
      return { ...base, type: "array", items: { type: "string" } };
    case "ACTOR":
      return { ...base, type: "object" };
    case "RAW_JSON":
      return { ...base };
    case "AI":
      // Value is a plain scalar in data; type unknown at the schema level.
      return { ...base };
    default:
      return { ...base, type: "string" };
  }
}

/** Build the `data` object schema for one object's records. */
function dataSchema(object: ObjectMetadata): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];
  for (const field of object.fields) {
    properties[field.key] = fieldSchema(field);
    if (field.required) required.push(field.key);
  }
  const schema: JsonSchema = {
    type: "object",
    properties,
    additionalProperties: false,
  };
  if (required.length) schema.required = required;
  return schema;
}

/** Schema component name for an object's record. */
function recordSchemaName(slug: string): string {
  // Component names must match `^[a-zA-Z0-9._-]+$`; slugs are kebab-case already.
  return `${slug}_Record`;
}

/** Schema component name for an object's writable data payload. */
function dataSchemaName(slug: string): string {
  return `${slug}_Data`;
}

/* ------------------------------------------------------------------ *
 * Path generation
 * ------------------------------------------------------------------ */

const COMMON_ERROR_RESPONSES = {
  "401": { description: "Missing or invalid API key." },
  "404": { description: "Object or record not found." },
  "429": { description: "Rate limit exceeded." },
};

/** Build the OpenAPI paths object covering every object's CRUD + bulk. */
function buildPaths(objects: ObjectMetadata[]): Record<string, unknown> {
  const paths: Record<string, unknown> = {};

  for (const object of objects) {
    const slug = object.slug;
    const tag = object.labelPlural;
    const recordRef = `#/components/schemas/${recordSchemaName(slug)}`;
    const dataRef = `#/components/schemas/${dataSchemaName(slug)}`;

    paths[`/api/sabcrm/${slug}`] = {
      get: {
        tags: [tag],
        summary: `List ${object.labelPlural}`,
        operationId: `list_${slug}`,
        parameters: [
          {
            name: "page",
            in: "query",
            schema: { type: "integer", minimum: 1 },
          },
          {
            name: "pageSize",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 200 },
          },
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "sortBy", in: "query", schema: { type: "string" } },
          {
            name: "sortDir",
            in: "query",
            schema: { type: "string", enum: ["asc", "desc"] },
          },
        ],
        responses: {
          "200": {
            description: `A page of ${object.labelPlural}.`,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    object: { type: "string" },
                    records: { type: "array", items: { $ref: recordRef } },
                    page: { type: "integer" },
                    pageSize: { type: "integer" },
                    total: { type: "integer" },
                  },
                },
              },
            },
          },
          ...COMMON_ERROR_RESPONSES,
        },
      },
      post: {
        tags: [tag],
        summary: `Create a ${object.labelSingular}`,
        operationId: `create_${slug}`,
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: dataRef } } },
        },
        responses: {
          "201": {
            description: `The created ${object.labelSingular}.`,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    object: { type: "string" },
                    record: { $ref: recordRef },
                  },
                },
              },
            },
          },
          "400": { description: "Malformed request body." },
          "402": { description: "Plan record limit reached." },
          ...COMMON_ERROR_RESPONSES,
        },
      },
    };

    const recordIdParam = {
      name: "recordId",
      in: "path",
      required: true,
      schema: { type: "string" },
    };

    paths[`/api/sabcrm/${slug}/{recordId}`] = {
      get: {
        tags: [tag],
        summary: `Read a ${object.labelSingular}`,
        operationId: `read_${slug}`,
        parameters: [recordIdParam],
        responses: {
          "200": {
            description: `The ${object.labelSingular}.`,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    object: { type: "string" },
                    record: { $ref: recordRef },
                  },
                },
              },
            },
          },
          ...COMMON_ERROR_RESPONSES,
        },
      },
      patch: {
        tags: [tag],
        summary: `Update a ${object.labelSingular}`,
        operationId: `update_${slug}`,
        parameters: [recordIdParam],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: dataRef } } },
        },
        responses: {
          "200": {
            description: `The updated ${object.labelSingular}.`,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    object: { type: "string" },
                    record: { $ref: recordRef },
                  },
                },
              },
            },
          },
          "400": { description: "Malformed request body." },
          ...COMMON_ERROR_RESPONSES,
        },
      },
      delete: {
        tags: [tag],
        summary: `Delete a ${object.labelSingular}`,
        operationId: `delete_${slug}`,
        parameters: [recordIdParam],
        responses: {
          "200": {
            description: "Deletion result.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    object: { type: "string" },
                    id: { type: "string" },
                    deleted: { type: "boolean" },
                  },
                },
              },
            },
          },
          ...COMMON_ERROR_RESPONSES,
        },
      },
    };

    paths[`/api/sabcrm/${slug}/bulk`] = {
      post: {
        tags: [tag],
        summary: `Bulk create / update / delete ${object.labelPlural}`,
        operationId: `bulk_${slug}`,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["op", "records"],
                properties: {
                  op: {
                    type: "string",
                    enum: ["create", "update", "delete"],
                  },
                  records: {
                    type: "array",
                    maxItems: MAX_BULK_BATCH,
                    items: {},
                    description:
                      "create: field maps; update: { id, data }; delete: id strings or { id }.",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Per-element results (at least one succeeded).",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    object: { type: "string" },
                    op: { type: "string" },
                    summary: {
                      type: "object",
                      properties: {
                        total: { type: "integer" },
                        succeeded: { type: "integer" },
                        failed: { type: "integer" },
                      },
                    },
                    results: { type: "array", items: { type: "object" } },
                  },
                },
              },
            },
          },
          "400": { description: "Malformed request body." },
          "402": { description: "Plan record limit reached." },
          "413": { description: `Batch exceeds ${MAX_BULK_BATCH} records.` },
          "422": { description: "Every element failed." },
          ...COMMON_ERROR_RESPONSES,
        },
      },
    };
  }

  return paths;
}

/** Build the `components.schemas` block for every object. */
function buildSchemas(objects: ObjectMetadata[]): Record<string, unknown> {
  const schemas: Record<string, unknown> = {};
  for (const object of objects) {
    const data = dataSchema(object);
    schemas[dataSchemaName(object.slug)] = data;
    schemas[recordSchemaName(object.slug)] = {
      type: "object",
      properties: {
        _id: { type: "string" },
        object: { type: "string" },
        label: { type: "string" },
        userId: { type: "string" },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
        data: { $ref: `#/components/schemas/${dataSchemaName(object.slug)}` },
      },
    };
  }
  return schemas;
}

/** Resolve the `servers[].url` from `?baseUrl=` or the request origin. */
function resolveBaseUrl(req: Request): string {
  try {
    const url = new URL(req.url);
    const override = url.searchParams.get("baseUrl");
    if (override && /^https?:\/\//i.test(override)) {
      return override.replace(/\/+$/, "");
    }
    return url.origin;
  } catch {
    return "";
  }
}

export async function GET(req: Request): Promise<NextResponse> {
  const auth = await verifyApiKey(req);
  if (!auth) {
    return NextResponse.json(
      { error: "Unauthorized: a valid SabCRM API key is required." },
      { status: 401 },
    );
  }

  try {
    await Promise.all([
      ensureSabcrmIndexes(),
      ensureStandardObjects(auth.projectId),
    ]);

    const objects = await listObjects(auth.projectId);
    const baseUrl = resolveBaseUrl(req);

    const doc = {
      openapi: "3.1.0",
      info: {
        title: "SabCRM REST API",
        version: "1.0.0",
        description:
          "Headless REST access to SabCRM objects. Authenticate every request " +
          "with a SabCRM API key via the `Authorization: Bearer <key>` header " +
          "or `X-Api-Key`. This document is generated live from your project's " +
          "object metadata, so it reflects your custom objects and fields.",
      },
      servers: baseUrl ? [{ url: baseUrl }] : [],
      tags: objects.map((o) => ({
        name: o.labelPlural,
        description: o.description || `${o.labelPlural} object`,
      })),
      paths: buildPaths(objects),
      components: {
        securitySchemes: {
          ApiKeyAuth: {
            type: "http",
            scheme: "bearer",
            description:
              "SabCRM API key. Send as `Authorization: Bearer <key>` or `X-Api-Key: <key>`.",
          },
        },
        schemas: buildSchemas(objects),
      },
      security: [{ ApiKeyAuth: [] }],
    };

    return NextResponse.json(doc, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[sabcrm:api] openapi generation failed:", err);
    const message =
      err instanceof Error ? err.message : "Failed to generate OpenAPI document.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
