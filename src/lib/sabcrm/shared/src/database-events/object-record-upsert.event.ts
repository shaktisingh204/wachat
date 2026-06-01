import { ObjectRecordBaseEvent } from './object-record.base.event';
import { type ObjectRecordDiff } from './object-record-diff';

export class ObjectRecordUpsertEvent<
  T = object,
> extends ObjectRecordBaseEvent<T> {
  declare properties: {
    before?: T;
    after: T;
    diff?: Partial<ObjectRecordDiff<T>>;
    updatedFields?: string[];
  };
}
