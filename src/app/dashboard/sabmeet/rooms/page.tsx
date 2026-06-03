"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Video, Plus, Settings } from "lucide-react";

export default function SabMeetRoomsPage() {
    const rooms = [
        { id: "1", name: "Daily Standup", url: "meet.sabnode.com/daily-standup", status: "Active", participants: 8 },
        { id: "2", name: "Client Sync", url: "meet.sabnode.com/client-sync", status: "Inactive", participants: 0 },
        { id: "3", name: "Design Review", url: "meet.sabnode.com/design-review", status: "Active", participants: 3 },
    ];

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Meeting Rooms</h1>
                    <p className="text-muted-foreground">Manage your video conferencing rooms.</p>
                </div>
                <Button>
                    <Plus className="mr-2 h-4 w-4" /> Create Room
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Active Rooms</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Room Name</TableHead>
                                <TableHead>URL</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Participants</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rooms.map((room) => (
                                <TableRow key={room.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center space-x-2">
                                            <Video className="h-4 w-4 text-muted-foreground" />
                                            <span>{room.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">{room.url}</TableCell>
                                    <TableCell>
                                        <Badge variant={room.status === "Active" ? "default" : "secondary"}>
                                            {room.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{room.participants}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon">
                                            <Settings className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
