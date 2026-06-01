import "server-only";

// server-logic: CalendarEventParticipantMatchParticipantJob → plain async function.
// PORT-NOTE: NestJS @Processor / BullMQ pattern dropped. In SabNode this function
// is invoked directly (or via a lightweight queue) instead of via BullMQ.
// The workspace-active guard is preserved via a Mongo lookup on the workspace doc.

import { connectToDatabase } from "@/lib/mongodb";

export type CalendarEventParticipantMatchParticipantJobData = {
  workspaceId: string;
  participantMatching: {
    personIds: string[];
    personEmails: string[];
    workspaceMemberIds: string[];
  };
};

interface WorkspaceDoc {
  id: string;
  activationStatus: string;
}

async function isWorkspaceActive(workspaceId: string): Promise<boolean> {
  const { db } = await connectToDatabase();
  const workspace = await db
    .collection<WorkspaceDoc>("sabcrm_workspace")
    .findOne({ id: workspaceId });
  return workspace?.activationStatus === "ACTIVE";
}

// Stub for match-participant service — replace with real impl when ported.
async function matchParticipantsForPeople(params: {
  objectMetadataName: string;
  participantMatching: {
    personIds: string[];
    personEmails: string[];
    workspaceMemberIds: string[];
  };
  workspaceId: string;
}): Promise<void> {
  // PORT-NOTE: delegate to MatchParticipantService once that module is ported.
  // src/lib/sabcrm/server/src/modules/match-participant/match-participant.service.ts
  console.info(
    `[calendar-participant-match] matchForPeople workspace=${params.workspaceId}`,
  );
}

async function matchParticipantsForWorkspaceMembers(params: {
  objectMetadataName: string;
  participantMatching: {
    personIds: string[];
    personEmails: string[];
    workspaceMemberIds: string[];
  };
  workspaceId: string;
}): Promise<void> {
  // PORT-NOTE: delegate to MatchParticipantService once that module is ported.
  console.info(
    `[calendar-participant-match] matchForWorkspaceMembers workspace=${params.workspaceId}`,
  );
}

export async function handleCalendarEventParticipantMatchParticipantJob(
  data: CalendarEventParticipantMatchParticipantJobData,
): Promise<void> {
  const { workspaceId, participantMatching } = data;

  const active = await isWorkspaceActive(workspaceId);
  if (!active) {
    return;
  }

  if (
    participantMatching.personIds.length > 0 ||
    participantMatching.personEmails.length > 0
  ) {
    await matchParticipantsForPeople({
      objectMetadataName: "calendarEventParticipant",
      participantMatching,
      workspaceId,
    });
  }

  if (participantMatching.workspaceMemberIds.length > 0) {
    await matchParticipantsForWorkspaceMembers({
      objectMetadataName: "calendarEventParticipant",
      participantMatching,
      workspaceId,
    });
  }
}
