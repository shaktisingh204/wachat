"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Repeat, Settings } from "lucide-react";

export default function SabSprintsSprintsPage() {
    const sprints = [
        { id: "1", name: "Sprint 42", startDate: "2026-06-01", endDate: "2026-06-14", status: "Active", points: 45 },
        { id: "2", name: "Sprint 41", startDate: "2026-05-18", endDate: "2026-05-31", status: "Completed", points: 52 },
        { id: "3", name: "Sprint 43", startDate: "2026-06-15", endDate: "2026-06-28", status: "Planned", points: 38 },
    ];

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Sprints</h1>
                    <p className="text-muted-foreground">Manage your agile sprints and iterations.</p>
                </div>
                <Button>
                    <Plus className="mr-2 h-4 w-4" /> New Sprint
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Sprints</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Sprint Name</TableHead>
                                <TableHead>Start Date</TableHead>
                                <TableHead>End Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Total Points</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sprints.map((sprint) => (
                                <TableRow key={sprint.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center space-x-2">
                                            <Repeat className="h-4 w-4 text-muted-foreground" />
                                            <span>{sprint.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">{sprint.startDate}</TableCell>
                                    <TableCell className="text-muted-foreground">{sprint.endDate}</TableCell>
                                    <TableCell>
                                        <Badge variant={sprint.status === "Active" ? "default" : sprint.status === "Completed" ? "secondary" : "outline"}>
                                            {sprint.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{sprint.points}</TableCell>
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
