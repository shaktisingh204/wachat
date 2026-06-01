// PORT: dto
// Original: NestJS @ObjectType() for GraphQL response

export type TestHttpRequestDTO = {
  /** Whether the request was successful */
  success: boolean;
  /** Message describing the result */
  message: string;
  /** Response data */
  result?: object;
  /** Error information */
  error?: string;
  /** HTTP status code */
  status?: number;
  /** HTTP status text */
  statusText?: string;
  /** Response headers */
  headers?: Record<string, string>;
};
