import { type ObjectRecordDiff } from './object-record-diff';
import { ObjectRecordBaseEvent } from './object-record.base.event';

export class ObjectRecordDeleteEvent<
  T = object,
> extends ObjectRecordBaseEvent<T> {
  declare properties: {
    before: T;
    after: T;
    updatedFields: string[];
    diff: Partial<ObjectRecordDiff<T>>;
  };
}
