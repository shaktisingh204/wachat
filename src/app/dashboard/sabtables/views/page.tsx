"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Layers, Plus, Settings, Filter, LayoutGrid } from "lucide-react";

export default function SabTablesViewsPage() {
    const views = [
        { id: "1", name: "All Customers", table: "Contacts", type: "Grid", base: "Customer CRM" },
        { id: "2", name: "Q3 Sales Pipeline", table: "Deals", type: "Kanban", base: "Customer CRM" },
        { id: "3", name: "Low Stock Alerts", table: "Products", type: "Grid", base: "Inventory Tracker" },
        { id: "4", name: "Event Calendar", table: "Schedule", type: "Calendar", base: "Event Planning" },
    ];

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Views</h1>
                    <p className="text-muted-foreground">Manage views for your database tables.</p>
                </div>
                <Button>
                    <Plus className="mr-2 h-4 w-4" /> Create View
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Saved Views</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>View Name</TableHead>
                                <TableHead>Table</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Base</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {views.map((view) => (
                                <TableRow key={view.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center space-x-2">
                                            <Layers className="h-4 w-4 text-muted-foreground" />
                                            <span>{view.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">{view.table}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="flex items-center space-x-1 w-fit">
                                            <LayoutGrid className="h-3 w-3 mr-1" />
                                            {view.type}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">{view.base}</TableCell>
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
