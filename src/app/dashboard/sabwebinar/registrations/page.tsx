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
import { Users, Mail, CheckCircle2, Download } from "lucide-react";

export default function RegistrationsPage() {
  const registrations = [
    {
      id: "reg_1",
      name: "Alice Johnson",
      email: "alice@example.com",
      webinar: "Q3 Product Launch Event",
      status: "Confirmed",
      date: "Oct 01, 2026",
    },
    {
      id: "reg_2",
      name: "Bob Williams",
      email: "bob.w@acme.inc",
      webinar: "Mastering React 19 Features",
      status: "Waitlisted",
      date: "Oct 02, 2026",
    },
    {
      id: "reg_3",
      name: "Charlie Brown",
      email: "charlie@snoopy.com",
      webinar: "Enterprise Sales Strategy",
      status: "Attended",
      date: "Sep 25, 2026",
    },
    {
      id: "reg_4",
      name: "Diana Prince",
      email: "diana@themyscira.gov",
      webinar: "Q3 Product Launch Event",
      status: "Confirmed",
      date: "Oct 03, 2026",
    },
  ];

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Registrations</h2>
        <div className="flex items-center space-x-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Registrations</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2,500</div>
            <p className="text-xs text-muted-foreground">
              Across all active webinars
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Registrations</CardTitle>
          <CardDescription>View and manage attendee registrations across all webinars.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Attendee Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Webinar</TableHead>
                <TableHead>Registration Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registrations.map((reg) => (
                <TableRow key={reg.id}>
                  <TableCell className="font-medium">{reg.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Mail className="mr-2 h-4 w-4" />
                      {reg.email}
                    </div>
                  </TableCell>
                  <TableCell>{reg.webinar}</TableCell>
                  <TableCell>{reg.date}</TableCell>
                  <TableCell>
                    <Badge variant={
                      reg.status === "Confirmed" ? "default" :
                      reg.status === "Attended" ? "secondary" : "outline"
                    }>
                      {reg.status === "Attended" && <CheckCircle2 className="mr-1 h-3 w-3" />}
                      {reg.status}
                    </Badge>
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
