"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart, Plus } from "lucide-react";

export default function SabMeetPollsPage() {
    const polls = [
        { id: "1", question: "What should we order for lunch?", room: "Team Lunch Sync", status: "Closed", votes: 12 },
        { id: "2", question: "Feature prioritization for Q4", room: "Product Planning", status: "Active", votes: 8 },
        { id: "3", question: "Preferred sync time next week?", room: "Design Review", status: "Closed", votes: 5 },
    ];

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Meeting Polls</h1>
                    <p className="text-muted-foreground">Manage interactive polls across your rooms.</p>
                </div>
                <Button>
                    <Plus className="mr-2 h-4 w-4" /> Create Poll
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Polls</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Question</TableHead>
                                <TableHead>Room</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Votes</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {polls.map((poll) => (
                                <TableRow key={poll.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center space-x-2">
                                            <BarChart className="h-4 w-4 text-muted-foreground" />
                                            <span>{poll.question}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>{poll.room}</TableCell>
                                    <TableCell>
                                        <Badge variant={poll.status === "Active" ? "default" : "secondary"}>
                                            {poll.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{poll.votes}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm">
                                            View Results
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
