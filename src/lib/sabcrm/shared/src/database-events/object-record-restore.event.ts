import { ObjectRecordCreateEvent } from './object-record-create.event';
import { type ObjectRecordDiff } from './object-record-diff';

export class ObjectRecordRestoreEvent<
  T = object,
> extends ObjectRecordCreateEvent<T> {
  declare properties: {
    before: T;
    after: T;
    updatedFields: string[];
    diff: Partial<ObjectRecordDiff<T>>;
  };
}
