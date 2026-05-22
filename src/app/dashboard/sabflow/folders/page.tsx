"use client";

import React, { useState } from "react";
import {
  LuFolder,
  LuFolderOpen,
  LuSearch,
  LuPlus,
  LuSettings,
  LuChevronRight,
  LuChevronDown,
  LuHardDrive,
  LuActivity,
  LuFileText,
  LuClock,
  LuSettings
} from "react-icons/lu";
import { cn } from "@/lib/utils";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FolderNode = {
  id: string;
  name: string;
  color: string;
  flowsCount: number;
  lastUpdated: string;
  children?: FolderNode[];
};

const mockFolders: FolderNode[] = [
  {
    id: "f1",
    name: "Customer Onboarding",
    color: "#f59e0b",
    flowsCount: 12,
    lastUpdated: "2 hours ago",
    children: [
      {
        id: "f1-1",
        name: "Welcome Emails",
        color: "#f59e0b",
        flowsCount: 3,
        lastUpdated: "1 day ago",
      },
      {
        id: "f1-2",
        name: "Trial Conversion",
        color: "#f59e0b",
        flowsCount: 5,
        lastUpdated: "3 hours ago",
      }
    ]
  },
  {
    id: "f2",
    name: "Internal Operations",
    color: "#3b82f6",
    flowsCount: 8,
    lastUpdated: "5 hours ago",
    children: [
      {
        id: "f2-1",
        name: "HR Automations",
        color: "#3b82f6",
        flowsCount: 4,
        lastUpdated: "2 days ago",
        children: [
          {
            id: "f2-1-1",
            name: "PTO Approvals",
            color: "#3b82f6",
            flowsCount: 2,
            lastUpdated: "4 days ago",
          }
        ]
      },
      {
        id: "f2-2",
        name: "IT Tickets",
        color: "#3b82f6",
        flowsCount: 4,
        lastUpdated: "5 hours ago",
      }
    ]
  },
  {
    id: "f3",
    name: "Marketing Campaigns",
    color: "#10b981",
    flowsCount: 24,
    lastUpdated: "1 hour ago",
  },
  {
    id: "f4",
    name: "E-commerce Sync",
    color: "#8b5cf6",
    flowsCount: 7,
    lastUpdated: "12 mins ago",
  }
];

export default function FoldersPage() {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    "f1": true,
    "f2": true,
    "f2-1": false,
  });

  const toggleExpand = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const renderFolderRows = (nodes: FolderNode[], level = 0): React.ReactNode[] => {
    let rows: React.ReactNode[] = [];
    
    nodes.forEach(node => {
      const isExpanded = expanded[node.id];
      const hasChildren = node.children && node.children.length > 0;
      
      rows.push(
        <TableRow key={node.id} className="group hover:bg-muted/50 transition-colors">
          <TableCell className="w-[300px]">
            <div 
              className="flex items-center gap-2"
              style={{ paddingLeft: `${level * 24}px` }}
            >
              <button 
                className={cn(
                  "p-0.5 rounded-md hover:bg-muted text-muted-foreground",
                  !hasChildren && "invisible"
                )}
                onClick={() => toggleExpand(node.id)}
              >
                {isExpanded ? <LuChevronDown className="h-4 w-4" /> : <LuChevronRight className="h-4 w-4" />}
              </button>
              
              <div 
                className="flex h-8 w-8 items-center justify-center rounded-md shrink-0"
                style={{ backgroundColor: `${node.color}1a`, color: node.color }}
              >
                {isExpanded && hasChildren ? <LuFolderOpen className="h-4 w-4" /> : <LuFolder className="h-4 w-4" />}
              </div>
              <span className="font-medium truncate text-[14px]">
                {node.name}
              </span>
            </div>
          </TableCell>
          <TableCell>
            <Badge variant="secondary" className="font-normal text-[12px]">
              {node.flowsCount} {node.flowsCount === 1 ? 'flow' : 'flows'}
            </Badge>
          </TableCell>
          <TableCell className="text-muted-foreground text-[13px]">
            {node.lastUpdated}
          </TableCell>
          <TableCell className="text-right">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
              <LuSettings className="h-4 w-4" />
            </Button>
          </TableCell>
        </TableRow>
      );

      if (isExpanded && hasChildren) {
        rows = rows.concat(renderFolderRows(node.children!, level + 1));
      }
    });

    return rows;
  };

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-8 max-w-[1400px] mx-auto w-full h-full animate-in fade-in duration-500">
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Folders & Organization</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your SabFlow automations with nested folders and tags.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2">
            <LuFolderOpen className="h-4 w-4" />
            Expand All
          </Button>
          <Button variant="default" className="gap-2">
            <LuPlus className="h-4 w-4" />
            New Folder
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="interactive" className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Folders</CardTitle>
            <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
              <LuFolder className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">14</div>
            <p className="text-xs text-muted-foreground mt-1">+2 from last month</p>
          </CardContent>
        </Card>

        <Card variant="interactive" className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Flows</CardTitle>
            <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <LuActivity className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">51</div>
            <p className="text-xs text-muted-foreground mt-1">Spread across 4 root folders</p>
          </CardContent>
        </Card>

        <Card variant="interactive" className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Storage Used</CardTitle>
            <div className="h-8 w-8 rounded-full bg-violet-500/10 flex items-center justify-center text-violet-500">
              <LuHardDrive className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1.2 GB</div>
            <p className="text-xs text-muted-foreground mt-1">Of 10 GB limit</p>
          </CardContent>
        </Card>

        <Card variant="interactive" className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recent Activity</CardTitle>
            <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
              <LuClock className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12 mins</div>
            <p className="text-xs text-muted-foreground mt-1">Last flow update</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Data Section */}
      <Card className="flex flex-col shadow-md border-border/40">
        <div className="p-4 border-b border-border/40 flex flex-col sm:flex-row justify-between items-center gap-4 bg-muted/20">
          <div className="relative w-full sm:w-72">
            <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search folders..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="px-3 py-1 text-xs">
              Sort by: Last Updated
            </Badge>
          </div>
        </div>
        
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[300px]">Folder Name</TableHead>
              <TableHead>Contents</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {renderFolderRows(mockFolders)}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
