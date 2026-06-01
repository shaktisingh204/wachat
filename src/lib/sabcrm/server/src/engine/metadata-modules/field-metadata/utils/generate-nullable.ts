// PORT-NOTE: Ported from twenty-server. Plain TypeScript — no NestJS/TypeORM.

export function generateNullable(
  inputNullableValue?: boolean,
  isRemoteCreation?: boolean,
): boolean {
  if (isRemoteCreation) {
    return true;
  }

  return inputNullableValue ?? true;
}
