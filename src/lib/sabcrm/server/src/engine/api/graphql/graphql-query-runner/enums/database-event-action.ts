// PORT-NOTE: Original called registerEnumType from @nestjs/graphql — omitted, not needed in Next.js.

export enum DatabaseEventAction {
  CREATED = 'created',
  UPDATED = 'updated',
  DELETED = 'deleted',
  DESTROYED = 'destroyed',
  RESTORED = 'restored',
  UPSERTED = 'upserted',
}
