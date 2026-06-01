// PORT-NOTE: Original used @nestjs/event-emitter's OnEvent decorator.
// In the SabNode Next.js stack there is no NestJS event emitter. This decorator
// is exported as a no-op stub so that any code referencing it still compiles.
// Wire real event subscriptions through your own event bus (e.g., Redis pub/sub).

import { type DatabaseEventAction } from "@/lib/sabcrm/server/src/engine/api/graphql/graphql-query-runner/enums/database-event-action";

export function OnDatabaseBatchEvent(
  _object: string,
  _action: DatabaseEventAction,
): MethodDecorator {
  // PORT-NOTE: No-op — NestJS OnEvent decorator not available in Next.js context.
  return (
    _target: object,
    _propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => descriptor;
}
