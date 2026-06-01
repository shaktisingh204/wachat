import { type ObjectRecord } from "@/lib/sabcrm/shared/types";

export type PartialObjectRecordWithId = Partial<ObjectRecord> & { id: string };
