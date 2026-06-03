"use client";

import React, { useState } from 'react';
import { 
  Card, CardHeader, CardTitle, CardDescription, CardContent,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Button, Badge, Input
} from '@/components/zoruui';
import { Database, Plus, RefreshCw, FileText, UploadCloud, Link2, Search, Trash2, Edit } from 'lucide-react';

const mockDatasets = [
  { id: '1', name: 'Q1 Sales Data', source: 'csv_upload', rows: 14500, status: 'active', lastRefresh: '2026-05-20T10:30:00Z' },
  { id: '2', name: 'CRM Accounts', source: 'mongo_collection', rows: 3200, status: 'active', lastRefresh: '2026-06-01T08:15:00Z' },
  { id: '3', name: 'Zendesk Tickets', source: 'rest_api', rows: 890, status: 'syncing', lastRefresh: '2026-06-03T09:00:00Z' },
  { id: '4', name: 'Legacy Customers', source: 'csv_upload', rows: 54200, status: 'archived', lastRefresh: '2025-12-01T11:20:00Z' },
];

export default function DatasetsPage() {
  const [search, setSearch] = useState('');

  const getSourceIcon = (source: string) => {
    switch(source) {
      case 'csv_upload': return <UploadCloud className="w-4 h-4 mr-2 text-blue-500" />;
      case 'mongo_collection': return <Database className="w-4 h-4 mr-2 text-green-500" />;
      case 'rest_api': return <Link2 className="w-4 h-4 mr-2 text-purple-500" />;
      default: return <FileText className="w-4 h-4 mr-2 text-gray-500" />;
    }
  };

  const getSourceLabel = (source: string) => {
    switch(source) {
      case 'csv_upload': return 'CSV Upload';
      case 'mongo_collection': return 'Mongo Collection';
      case 'rest_api': return 'REST API';
      default: return source;
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'active': return <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">Active</Badge>;
      case 'syncing': return <Badge variant="outline" className="border-blue-500/30 text-blue-600">Syncing...</Badge>;
      case 'archived': return <Badge variant="secondary">Archived</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const filtered = mockDatasets.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zoru-ink">Datasets</h2>
          <p className="text-muted-foreground text-zoru-ink/60">
            Manage data sources and sync external records for BI analysis.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Sync All
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Dataset
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Data Sources</CardTitle>
              <CardDescription>
                A list of all tabular data pointers available to SabBI.
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search datasets..."
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
                <TableHead>Name</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Rows</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Refresh</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((dataset) => (
                <TableRow key={dataset.id}>
                  <TableCell className="font-medium">{dataset.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      {getSourceIcon(dataset.source)}
                      {getSourceLabel(dataset.source)}
                    </div>
                  </TableCell>
                  <TableCell>{dataset.rows.toLocaleString()}</TableCell>
                  <TableCell>{getStatusBadge(dataset.status)}</TableCell>
                  <TableCell>{new Date(dataset.lastRefresh).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-zoru-ink/60 hover:text-zoru-ink">
                      <Edit className="h-4 w-4" />
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
                    No datasets found.
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
