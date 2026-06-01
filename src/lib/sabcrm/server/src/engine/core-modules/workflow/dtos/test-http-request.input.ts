import { z } from 'zod';

// PORT: graphql-input->zod
// Original: NestJS @InputType() with @Field decorators; fields typed from WorkflowHttpRequestActionInput

export type TestHttpRequestInput = {
  /** URL to make the request to */
  url: string;
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** HTTP headers */
  headers?: Record<string, string>;
  /** Request body */
  body?:
    | Record<
        string,
        | string
        | number
        | boolean
        | null
        | undefined
        | Array<string | number | boolean | null>
      >
    | string;
};

export const testHttpRequestInputSchema = z.object({
  url: z.string().url({ message: 'url must be a valid URL' }),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  headers: z.record(z.string()).optional(),
  body: z
    .union([
      z.record(
        z.union([
          z.string(),
          z.number(),
          z.boolean(),
          z.null(),
          z.undefined(),
          z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])),
        ]),
      ),
      z.string(),
    ])
    .optional(),
});
