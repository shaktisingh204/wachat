import 'server-only';

import type { Document } from 'mongodb';

import {
  CalendarChannelSyncStage,
  CalendarChannelVisibility,
} from '@/lib/sabcrm/server/src/engine/metadata-modules/calendar-channel/dtos/calendar-channel.dto';
import type { CalendarChannelDTO } from '@/lib/sabcrm/server/src/engine/metadata-modules/calendar-channel/dtos/calendar-channel.dto';
import {
  CalendarChannelDocument,
  getCalendarChannelCollection,
} from '@/lib/sabcrm/server/src/engine/metadata-modules/calendar-channel/entities/calendar-channel.entity';
import {
  CalendarChannelException,
  CalendarChannelExceptionCode,
} from '@/lib/sabcrm/server/src/engine/metadata-modules/calendar-channel/calendar-channel.exception';
import { ConnectedAccountMetadataService } from '@/lib/sabcrm/server/src/engine/metadata-modules/connected-account/connected-account-metadata.service';

// Map a Mongo document to the DTO shape.
function toDto(doc: CalendarChannelDocument): CalendarChannelDTO {
  return {
    id: doc.id,
    handle: doc.handle,
    syncStatus: doc.syncStatus,
    syncStage: doc.syncStage,
    visibility: doc.visibility,
    isContactAutoCreationEnabled: doc.isContactAutoCreationEnabled,
    contactAutoCreationPolicy: doc.contactAutoCreationPolicy,
    isSyncEnabled: doc.isSyncEnabled,
    syncCursor: doc.syncCursor,
    syncedAt: doc.syncedAt,
    syncStageStartedAt: doc.syncStageStartedAt,
    throttleFailureCount: doc.throttleFailureCount,
    connectedAccountId: doc.connectedAccountId,
    workspaceId: doc.workspaceId,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class CalendarChannelMetadataService {
  constructor(
    private readonly connectedAccountMetadataService: ConnectedAccountMetadataService,
  ) {}

  async findAll(workspaceId: string): Promise<CalendarChannelDTO[]> {
    const col = await getCalendarChannelCollection();
    const docs = await col.find({ workspaceId }).toArray();
    return docs.map(toDto);
  }

  async findByUserWorkspaceId({
    userWorkspaceId,
    workspaceId,
  }: {
    userWorkspaceId: string;
    workspaceId: string;
  }): Promise<CalendarChannelDTO[]> {
    const userAccountIds =
      await this.connectedAccountMetadataService.getUserConnectedAccountIds({
        userWorkspaceId,
        workspaceId,
      });

    return this.findByConnectedAccountIds({
      connectedAccountIds: userAccountIds,
      workspaceId,
    });
  }

  async findByConnectedAccountIdForUser({
    connectedAccountId,
    userWorkspaceId,
    workspaceId,
  }: {
    connectedAccountId: string;
    userWorkspaceId: string;
    workspaceId: string;
  }): Promise<CalendarChannelDTO[]> {
    await this.connectedAccountMetadataService.verifyOwnership({
      id: connectedAccountId,
      userWorkspaceId,
      workspaceId,
    });

    return this.findByConnectedAccountId({ connectedAccountId, workspaceId });
  }

  async findByConnectedAccountId({
    connectedAccountId,
    workspaceId,
  }: {
    connectedAccountId: string;
    workspaceId: string;
  }): Promise<CalendarChannelDTO[]> {
    const col = await getCalendarChannelCollection();
    const docs = await col.find({ connectedAccountId, workspaceId }).toArray();
    return docs.map(toDto);
  }

  async findByConnectedAccountIds({
    connectedAccountIds,
    workspaceId,
  }: {
    connectedAccountIds: string[];
    workspaceId: string;
  }): Promise<CalendarChannelDTO[]> {
    if (connectedAccountIds.length === 0) {
      return [];
    }

    const col = await getCalendarChannelCollection();
    const docs = await col
      .find({ connectedAccountId: { $in: connectedAccountIds }, workspaceId })
      .toArray();
    return docs.map(toDto);
  }

  async findById({
    id,
    workspaceId,
  }: {
    id: string;
    workspaceId: string;
  }): Promise<CalendarChannelDTO | null> {
    const col = await getCalendarChannelCollection();
    const doc = await col.findOne({ id, workspaceId });
    return doc ? toDto(doc) : null;
  }

  async verifyOwnership({
    id,
    userWorkspaceId,
    workspaceId,
  }: {
    id: string;
    userWorkspaceId: string;
    workspaceId: string;
  }): Promise<CalendarChannelDTO> {
    const col = await getCalendarChannelCollection();
    const doc = await col.findOne({ id, workspaceId });

    if (!doc) {
      throw new CalendarChannelException(
        `Calendar channel ${id} not found`,
        CalendarChannelExceptionCode.CALENDAR_CHANNEL_NOT_FOUND,
      );
    }

    const userAccountIds =
      await this.connectedAccountMetadataService.getUserConnectedAccountIds({
        userWorkspaceId,
        workspaceId,
      });

    if (!userAccountIds.includes(doc.connectedAccountId)) {
      throw new CalendarChannelException(
        `Calendar channel ${id} does not belong to user workspace ${userWorkspaceId}`,
        CalendarChannelExceptionCode.CALENDAR_CHANNEL_OWNERSHIP_VIOLATION,
      );
    }

    return toDto(doc);
  }

  async create(
    data: Partial<CalendarChannelDocument> & {
      id: string;
      workspaceId: string;
      handle: string;
      connectedAccountId: string;
      visibility: CalendarChannelVisibility;
      syncStage: CalendarChannelSyncStage;
    },
  ): Promise<CalendarChannelDTO> {
    const col = await getCalendarChannelCollection();
    const now = new Date();
    const doc: CalendarChannelDocument = {
      id: data.id,
      handle: data.handle,
      syncStatus: data.syncStatus ?? ('NOT_SYNCED' as CalendarChannelDTO['syncStatus']),
      syncStage: data.syncStage,
      visibility: data.visibility,
      isContactAutoCreationEnabled: data.isContactAutoCreationEnabled ?? false,
      contactAutoCreationPolicy:
        data.contactAutoCreationPolicy ??
        ('AS_PARTICIPANT_AND_ORGANIZER' as CalendarChannelDTO['contactAutoCreationPolicy']),
      isSyncEnabled: data.isSyncEnabled ?? false,
      syncCursor: data.syncCursor ?? null,
      syncedAt: data.syncedAt ?? null,
      syncStageStartedAt: data.syncStageStartedAt ?? null,
      throttleFailureCount: data.throttleFailureCount ?? 0,
      connectedAccountId: data.connectedAccountId,
      workspaceId: data.workspaceId,
      createdAt: data.createdAt ?? now,
      updatedAt: data.updatedAt ?? now,
    };

    await col.insertOne(doc as CalendarChannelDocument & Document);
    return toDto(doc);
  }

  async update({
    id,
    workspaceId,
    data,
  }: {
    id: string;
    workspaceId: string;
    data: Partial<CalendarChannelDocument>;
  }): Promise<CalendarChannelDTO> {
    const col = await getCalendarChannelCollection();
    const updatePayload = { ...data, updatedAt: new Date() };
    await col.updateOne({ id, workspaceId }, { $set: updatePayload });

    const updated = await col.findOne({ id, workspaceId });
    if (!updated) {
      throw new CalendarChannelException(
        `Calendar channel ${id} not found after update`,
        CalendarChannelExceptionCode.CALENDAR_CHANNEL_NOT_FOUND,
      );
    }
    return toDto(updated);
  }

  async delete({
    id,
    workspaceId,
  }: {
    id: string;
    workspaceId: string;
  }): Promise<CalendarChannelDTO> {
    const col = await getCalendarChannelCollection();
    const doc = await col.findOne({ id, workspaceId });

    if (!doc) {
      throw new CalendarChannelException(
        `Calendar channel ${id} not found`,
        CalendarChannelExceptionCode.CALENDAR_CHANNEL_NOT_FOUND,
      );
    }

    await col.deleteOne({ id, workspaceId });
    return toDto(doc);
  }
}
