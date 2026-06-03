"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, PlayCircle, Trash2 } from "lucide-react";

export default function SabMeetRecordingsPage() {
    const recordings = [
        { id: "1", name: "Daily Standup - Oct 12", date: "2023-10-12", duration: "45m", size: "320MB", room: "Daily Standup" },
        { id: "2", name: "Client Sync - Acme Corp", date: "2023-10-11", duration: "1h 15m", size: "850MB", room: "Client Sync" },
        { id: "3", name: "Design Review - Q4", date: "2023-10-10", duration: "30m", size: "210MB", room: "Design Review" },
    ];

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Recordings</h1>
                    <p className="text-muted-foreground">View and download meeting recordings.</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent Recordings</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Recording Name</TableHead>
                                <TableHead>Room</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Duration</TableHead>
                                <TableHead>Size</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {recordings.map((rec) => (
                                <TableRow key={rec.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center space-x-2">
                                            <PlayCircle className="h-4 w-4 text-muted-foreground" />
                                            <span>{rec.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>{rec.room}</TableCell>
                                    <TableCell className="text-muted-foreground">{rec.date}</TableCell>
                                    <TableCell>{rec.duration}</TableCell>
                                    <TableCell className="text-muted-foreground">{rec.size}</TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button variant="ghost" size="icon">
                                            <Download className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-destructive">
                                            <Trash2 className="h-4 w-4" />
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
