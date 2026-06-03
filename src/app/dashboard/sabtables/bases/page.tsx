"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Database, Plus, Settings, Activity } from "lucide-react";

export default function SabTablesBasesPage() {
    const bases = [
        { id: "1", name: "Customer CRM", workspace: "Sales", status: "Active", size: "2.4 MB" },
        { id: "2", name: "Inventory Tracker", workspace: "Operations", status: "Active", size: "8.1 MB" },
        { id: "3", name: "Event Planning", workspace: "Marketing", status: "Archived", size: "1.2 MB" },
        { id: "4", name: "Employee Directory", workspace: "HR", status: "Active", size: "3.5 MB" },
    ];

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Bases</h1>
                    <p className="text-muted-foreground">Manage your relational database bases.</p>
                </div>
                <Button>
                    <Plus className="mr-2 h-4 w-4" /> Create Base
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Bases</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Base Name</TableHead>
                                <TableHead>Workspace</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Size</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {bases.map((base) => (
                                <TableRow key={base.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center space-x-2">
                                            <Database className="h-4 w-4 text-muted-foreground" />
                                            <span>{base.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">{base.workspace}</TableCell>
                                    <TableCell>
                                        <Badge variant={base.status === "Active" ? "default" : "secondary"}>
                                            {base.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">{base.size}</TableCell>
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
