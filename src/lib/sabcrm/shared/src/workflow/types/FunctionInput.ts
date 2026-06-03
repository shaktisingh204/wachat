export type FunctionInput =
  | {
      [name: string]: FunctionInput;
    }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | any;
