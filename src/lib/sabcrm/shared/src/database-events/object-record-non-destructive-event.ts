import { type ObjectRecordCreateEvent } from './object-record-create.event';
import { type ObjectRecordDeleteEvent } from './object-record-delete.event';
import { type ObjectRecordRestoreEvent } from './object-record-restore.event';
import { type ObjectRecordUpsertEvent } from './object-record-upsert.event';
import { type ObjectRecordUpdateEvent } from './object-record-update.event';

export type ObjectRecordNonDestructiveEvent =
  | ObjectRecordCreateEvent
  | ObjectRecordUpdateEvent
  | ObjectRecordDeleteEvent
  | ObjectRecordRestoreEvent
  | ObjectRecordUpsertEvent;
