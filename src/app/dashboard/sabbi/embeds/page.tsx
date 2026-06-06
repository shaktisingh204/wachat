"use client";

import React, { useState } from 'react';
import { 
  Card, CardHeader, CardTitle, CardDescription, CardContent,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Button, Badge, Input, Switch, Label
} from '@/components/sabcrm/20ui/compat';
import { LayoutDashboard, Plus, Search, Code, ExternalLink, Copy, Settings, Trash2 } from 'lucide-react';

const mockEmbeds = [
  { id: '1', name: 'Sales Overview Portal', type: 'dashboard', status: 'active', views: 1240, created: '2026-05-10T11:00:00Z' },
  { id: '2', name: 'Public Churn Stats', type: 'chart', status: 'active', views: 8900, created: '2026-05-15T09:30:00Z' },
  { id: '3', name: 'Internal HR Report', type: 'dashboard', status: 'inactive', views: 56, created: '2026-05-20T14:15:00Z' },
];

export default function EmbedsPage() {
  const [search, setSearch] = useState('');

  const getStatusColor = (status: string) => {
    return status === 'active' ? 'bg-emerald-500' : 'bg-gray-300';
  };

  const filtered = mockEmbeds.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[var(--st-text)]">Embeds & Sharing</h2>
          <p className="text-muted-foreground text-[var(--st-text)]/60">
            Publish charts and dashboards externally or embed them in other platforms.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Embed
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Views</CardTitle>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">10,196</div>
            <p className="text-xs text-muted-foreground">
              +14% from last month
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Embeds</CardTitle>
            <Code className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2</div>
            <p className="text-xs text-muted-foreground">
              Across 3 domains
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium text-emerald-600 mb-1">All secure</div>
            <p className="text-xs text-muted-foreground">
              Using JWT domain restriction
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Embed Links</CardTitle>
              <CardDescription>
                Manage public links and iframe code snippets.
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search embeds..."
                  className="w-64 pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Embed Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Total Views</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((embed) => (
                <TableRow key={embed.id}>
                  <TableCell className="font-medium">{embed.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {embed.type === 'dashboard' ? <LayoutDashboard className="w-3 h-3 mr-1" /> : <Code className="w-3 h-3 mr-1" />}
                      {embed.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(embed.status)}`} />
                      <span className="capitalize text-sm">{embed.status}</span>
                    </div>
                  </TableCell>
                  <TableCell>{embed.views.toLocaleString()}</TableCell>
                  <TableCell>{new Date(embed.created).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-[var(--st-text)]/60 hover:text-[var(--st-text)]">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-[var(--st-text)]/60 hover:text-[var(--st-text)]">
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500/60 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No embeds found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
