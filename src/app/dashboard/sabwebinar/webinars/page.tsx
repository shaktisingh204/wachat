"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Video, Plus, Calendar, Users, Settings } from "lucide-react";

export default function WebinarsPage() {
  const webinars = [
    {
      id: "web_1",
      title: "Q3 Product Launch Event",
      status: "Upcoming",
      date: "Oct 15, 2026",
      registrations: 450,
      host: "Jane Doe",
    },
    {
      id: "web_2",
      title: "Mastering React 19 Features",
      status: "Live",
      date: "Oct 10, 2026",
      registrations: 1200,
      host: "John Smith",
    },
    {
      id: "web_3",
      title: "Enterprise Sales Strategy",
      status: "Ended",
      date: "Sep 28, 2026",
      registrations: 850,
      host: "Sarah Jenkins",
    },
  ];

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Webinars</h2>
        <div className="flex items-center space-x-2">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Schedule Webinar
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Webinars</CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">45</div>
            <p className="text-xs text-muted-foreground">
              +3 from last month
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Webinars</CardTitle>
          <CardDescription>Manage and track all your scheduled and past webinars.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Host</TableHead>
                <TableHead>Registrations</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {webinars.map((webinar) => (
                <TableRow key={webinar.id}>
                  <TableCell className="font-medium">{webinar.title}</TableCell>
                  <TableCell>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Calendar className="mr-2 h-4 w-4" />
                      {webinar.date}
                    </div>
                  </TableCell>
                  <TableCell>{webinar.host}</TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                      {webinar.registrations}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={webinar.status === "Live" ? "destructive" : webinar.status === "Upcoming" ? "default" : "secondary"}>
                      {webinar.status}
                    </Badge>
                  </TableCell>
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
