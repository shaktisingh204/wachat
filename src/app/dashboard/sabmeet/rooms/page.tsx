"use client";

import React from "react";
import {
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
  IconButton,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  StatCard,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Badge,
  Dot,
  EmptyState,
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from "@/components/sabcrm/20ui";
import { Video, Plus, Settings, Users, Radio, ExternalLink } from "lucide-react";

interface Room {
  id: string;
  name: string;
  url: string;
  status: "Active" | "Inactive";
  participants: number;
}

export default function SabMeetRoomsPage() {
  const rooms: Room[] = [
    { id: "1", name: "Daily Standup", url: "meet.sabnode.com/daily-standup", status: "Active", participants: 8 },
    { id: "2", name: "Client Sync", url: "meet.sabnode.com/client-sync", status: "Inactive", participants: 0 },
    { id: "3", name: "Design Review", url: "meet.sabnode.com/design-review", status: "Active", participants: 3 },
  ];

  const activeCount = rooms.filter((room) => room.status === "Active").length;
  const liveParticipants = rooms.reduce((sum, room) => sum + room.participants, 0);

  return (
    <TooltipProvider>
      <main className="space-y-6 p-6">
        <PageHeader>
          <PageHeaderHeading>
            <PageEyebrow>SabMeet</PageEyebrow>
            <PageTitle>Meeting rooms</PageTitle>
            <PageDescription>Manage your video conferencing rooms and see who is live.</PageDescription>
          </PageHeaderHeading>
          <PageActions>
            <Button variant="primary" iconLeft={Plus}>
              Create room
            </Button>
          </PageActions>
        </PageHeader>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Total rooms" value={rooms.length} icon={Video} accent="#2b6ef2" />
          <StatCard label="Active now" value={activeCount} icon={Radio} accent="#1f9d55" />
          <StatCard label="Live participants" value={liveParticipants} icon={Users} accent="#7c5cff" />
        </div>

        <Card padding="none">
          <CardHeader className="flex items-center gap-2">
            <Video className="h-4 w-4 text-[var(--st-text-tertiary)]" aria-hidden="true" />
            <div>
              <CardTitle>All rooms</CardTitle>
              <CardDescription>Every room in your workspace, with current activity.</CardDescription>
            </div>
          </CardHeader>
          <CardBody>
            {rooms.length === 0 ? (
              <EmptyState
                icon={Video}
                title="No meeting rooms yet"
                description="Create your first room to start hosting video calls with your team."
                action={
                  <Button variant="primary" iconLeft={Plus}>
                    Create room
                  </Button>
                }
              />
            ) : (
              <Table hover>
                <THead>
                  <Tr>
                    <Th>Room Name</Th>
                    <Th>URL</Th>
                    <Th>Status</Th>
                    <Th align="right">Participants</Th>
                    <Th align="right">Actions</Th>
                  </Tr>
                </THead>
                <TBody>
                  {rooms.map((room) => {
                    const isActive = room.status === "Active";
                    return (
                      <Tr key={room.id}>
                        <Td>
                          <span className="flex items-center gap-2 font-medium text-[var(--st-text)]">
                            <Video
                              size={16}
                              className="text-[var(--st-text-tertiary)]"
                              aria-hidden="true"
                            />
                            {room.name}
                          </span>
                        </Td>
                        <Td>
                          <span className="text-[var(--st-text-secondary)]">{room.url}</span>
                        </Td>
                        <Td>
                          <Badge tone={isActive ? "success" : "neutral"} dot>
                            {room.status}
                          </Badge>
                        </Td>
                        <Td align="right">
                          <span className="inline-flex items-center justify-end gap-1.5">
                            {isActive && room.participants > 0 ? (
                              <Dot tone="success" pulse aria-hidden="true" />
                            ) : null}
                            <span className="tabular-nums text-[var(--st-text)]">{room.participants}</span>
                          </span>
                        </Td>
                        <Td align="right">
                          <span className="inline-flex items-center justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <IconButton
                                  label={`Open ${room.name}`}
                                  icon={ExternalLink}
                                  size="sm"
                                />
                              </TooltipTrigger>
                              <TooltipContent>Open room</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <IconButton
                                  label={`Settings for ${room.name}`}
                                  icon={Settings}
                                  size="sm"
                                />
                              </TooltipTrigger>
                              <TooltipContent>Room settings</TooltipContent>
                            </Tooltip>
                          </span>
                        </Td>
                      </Tr>
                    );
                  })}
                </TBody>
              </Table>
            )}
          </CardBody>
        </Card>
      </main>
    </TooltipProvider>
  );
}
