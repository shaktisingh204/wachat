import "server-only";

// PORT-NOTE: NestJS @Injectable removed. The class is replaced by a plain
// factory function that generates the same AI tool-set. The zod schemas and
// tool definitions are preserved verbatim from the original.

import { z } from "zod";

import {
  createOneField,
  createManyFields,
  updateOneField,
  deleteOneField,
  queryFieldMetadata,
  type CreateFieldInput,
  type UpdateFieldInput,
  type DeleteOneFieldInput,
} from "@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/services/field-metadata.service";

// ---------------------------------------------------------------------------
// Zod input schemas (unchanged from the original NestJS source)
// ---------------------------------------------------------------------------

const GetFieldMetadataInputSchema = z.object({
  id: z
    .string()
    .uuid()
    .optional()
    .describe(
      "Unique identifier for the field metadata. If provided, returns a single field.",
    ),
  objectMetadataId: z
    .string()
    .uuid()
    .optional()
    .describe("Filter fields by object metadata ID."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(100)
    .describe("Maximum number of fields to return."),
});

const CreateFieldMetadataInputSchema = z.object({
  objectMetadataId: z
    .string()
    .uuid()
    .describe("ID of the object to add the field to"),
  type: z
    .string()
    .describe(
      "Field type (e.g., TEXT, NUMBER, BOOLEAN, DATE_TIME, RELATION, etc.)",
    ),
  name: z.string().describe("Internal name of the field (camelCase)"),
  label: z.string().describe("Display label of the field"),
  description: z.string().optional().describe("Description of the field"),
  icon: z.string().optional().describe("Icon identifier for the field"),
  isNullable: z.boolean().optional().describe("Whether the field can be null"),
  isUnique: z
    .boolean()
    .optional()
    .describe("Whether the field value must be unique"),
  defaultValue: z.unknown().optional().describe("Default value for the field"),
  options: z
    .unknown()
    .optional()
    .describe("Options for SELECT/MULTI_SELECT fields"),
  settings: z
    .unknown()
    .optional()
    .describe("Additional settings for the field"),
  isLabelSyncedWithName: z
    .boolean()
    .optional()
    .describe("Whether label should sync with name changes"),
  isRemoteCreation: z
    .boolean()
    .optional()
    .describe("Whether this is a remote field creation"),
  relationCreationPayload: z
    .unknown()
    .optional()
    .describe("Payload for creating relation fields"),
});

const UpdateFieldMetadataInputSchema = z.object({
  id: z.string().uuid().describe("ID of the field to update"),
  name: z.string().optional().describe("Internal name of the field"),
  label: z.string().optional().describe("Display label of the field"),
  description: z.string().optional().describe("Description of the field"),
  icon: z.string().optional().describe("Icon identifier for the field"),
  isActive: z.boolean().optional().describe("Whether the field is active"),
  isNullable: z.boolean().optional().describe("Whether the field can be null"),
  isUnique: z
    .boolean()
    .optional()
    .describe("Whether the field value must be unique"),
  defaultValue: z.unknown().optional().describe("Default value for the field"),
  options: z
    .unknown()
    .optional()
    .describe("Options for SELECT/MULTI_SELECT fields"),
  settings: z
    .unknown()
    .optional()
    .describe("Additional settings for the field"),
  isLabelSyncedWithName: z
    .boolean()
    .optional()
    .describe("Whether label should sync with name changes"),
});

const DeleteFieldMetadataInputSchema = z.object({
  id: z.string().uuid().describe("ID of the field to delete"),
});

const CreateManyFieldMetadataInputSchema = z.object({
  fields: z
    .array(CreateFieldMetadataInputSchema)
    .min(1)
    .max(20)
    .describe("Array of field metadata to create (1-20 items)."),
});

const UpdateManyFieldMetadataInputSchema = z.object({
  fields: z
    .array(UpdateFieldMetadataInputSchema)
    .min(1)
    .max(20)
    .describe("Array of field metadata updates to apply (1-20 items)."),
});

const CreateManyRelationFieldsInputSchema = z.object({
  relations: z
    .array(
      z.object({
        objectMetadataId: z
          .string()
          .uuid()
          .describe("ID of the source object to add the relation field to"),
        name: z
          .string()
          .describe("Internal name of the relation field (camelCase)"),
        label: z.string().describe("Display label of the relation field"),
        description: z
          .string()
          .optional()
          .describe("Description of the relation field"),
        icon: z
          .string()
          .optional()
          .describe("Icon identifier for the relation field"),
        type: z
          .enum(["MANY_TO_ONE", "ONE_TO_MANY"])
          .describe("Relation type: MANY_TO_ONE or ONE_TO_MANY"),
        targetObjectMetadataId: z
          .string()
          .uuid()
          .describe("ID of the target object this relation points to"),
        targetFieldLabel: z
          .string()
          .describe(
            "Display label for the inverse relation field on the target object",
          ),
        targetFieldIcon: z
          .string()
          .describe("Icon for the inverse relation field (e.g. IconSomething)"),
      }),
    )
    .min(1)
    .max(20)
    .describe("Array of relation fields to create (1-20 items)."),
});

// ---------------------------------------------------------------------------
// Tool-set type (matches the `ai` ToolSet shape without importing from `ai`)
// ---------------------------------------------------------------------------

type ToolDefinition<TInput> = {
  description: string;
  inputSchema: z.ZodType<TInput>;
  execute: (parameters: TInput) => Promise<unknown>;
};

type FieldMetadataToolSet = {
  get_field_metadata: ToolDefinition<z.infer<typeof GetFieldMetadataInputSchema>>;
  create_field_metadata: ToolDefinition<z.infer<typeof CreateFieldMetadataInputSchema>>;
  update_field_metadata: ToolDefinition<z.infer<typeof UpdateFieldMetadataInputSchema>>;
  delete_field_metadata: ToolDefinition<z.infer<typeof DeleteFieldMetadataInputSchema>>;
  create_many_field_metadata: ToolDefinition<z.infer<typeof CreateManyFieldMetadataInputSchema>>;
  update_many_field_metadata: ToolDefinition<z.infer<typeof UpdateManyFieldMetadataInputSchema>>;
  create_many_relation_fields: ToolDefinition<z.infer<typeof CreateManyRelationFieldsInputSchema>>;
};

// ---------------------------------------------------------------------------
// Factory function
// ---------------------------------------------------------------------------

export function generateFieldMetadataTools(
  workspaceId: string,
): FieldMetadataToolSet {
  return {
    get_field_metadata: {
      description:
        "Find fields metadata. Retrieve information about the fields of objects in the workspace data model.",
      inputSchema: GetFieldMetadataInputSchema,
      execute: async (parameters) => {
        return queryFieldMetadata({
          filter: {
            workspaceId: { eq: workspaceId },
            ...(parameters.id ? { id: { eq: parameters.id } } : {}),
            ...(parameters.objectMetadataId
              ? { objectMetadataId: { eq: parameters.objectMetadataId } }
              : {}),
          },
          paging: { limit: parameters.limit ?? 100 },
        });
      },
    },

    create_field_metadata: {
      description:
        "Create a new field metadata on an object. Specify the objectMetadataId and field properties.",
      inputSchema: CreateFieldMetadataInputSchema,
      execute: async (parameters) => {
        return createOneField({
          createFieldInput: parameters as Omit<CreateFieldInput, "workspaceId">,
          workspaceId,
        });
      },
    },

    update_field_metadata: {
      description:
        "Update an existing field metadata. Provide the field ID and the properties to update.",
      inputSchema: UpdateFieldMetadataInputSchema,
      execute: async (parameters) => {
        const { id, ...update } = parameters;
        return updateOneField({
          updateFieldInput: { id, ...update } as Omit<UpdateFieldInput, "workspaceId"> & { id: string },
          workspaceId,
        });
      },
    },

    delete_field_metadata: {
      description: "Delete a field metadata by its ID.",
      inputSchema: DeleteFieldMetadataInputSchema,
      execute: async (parameters) => {
        return deleteOneField({
          deleteOneFieldInput: parameters as DeleteOneFieldInput,
          workspaceId,
        });
      },
    },

    create_many_field_metadata: {
      description:
        "Create multiple field metadata at once on one or more objects. More efficient than calling create_field_metadata multiple times.",
      inputSchema: CreateManyFieldMetadataInputSchema,
      execute: async (parameters) => {
        await createManyFields({
          createFieldInputs: parameters.fields as Omit<CreateFieldInput, "workspaceId">[],
          workspaceId,
        });
        return true;
      },
    },

    update_many_field_metadata: {
      description:
        "Update multiple field metadata at once. More efficient than calling update_field_metadata multiple times.",
      inputSchema: UpdateManyFieldMetadataInputSchema,
      execute: async (parameters) => {
        await Promise.all(
          parameters.fields.map(async ({ id, ...update }) => {
            await updateOneField({
              updateFieldInput: { id, ...update } as Omit<UpdateFieldInput, "workspaceId"> & { id: string },
              workspaceId,
            });
          }),
        );
        return true;
      },
    },

    create_many_relation_fields: {
      description:
        "Create multiple relation fields between objects at once. Recommended way to add relations after creating objects.",
      inputSchema: CreateManyRelationFieldsInputSchema,
      execute: async (parameters) => {
        await createManyFields({
          createFieldInputs: parameters.relations.map((relation) => ({
            objectMetadataId: relation.objectMetadataId,
            type: "RELATION",
            name: relation.name,
            label: relation.label,
            description: relation.description,
            icon: relation.icon,
            relationCreationPayload: {
              type: relation.type,
              targetObjectMetadataId: relation.targetObjectMetadataId,
              targetFieldLabel: relation.targetFieldLabel,
              targetFieldIcon: relation.targetFieldIcon,
            },
          })),
          workspaceId,
        });
        return true;
      },
    },
  };
}
