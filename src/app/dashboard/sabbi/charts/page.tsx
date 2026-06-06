"use client";

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardBody, Table, THead, TBody, Tr, Th, Td, Button, Badge, Input } from '@/components/sabcrm/20ui';
import { BarChart2, Plus, LineChart, PieChart, Search, Play, MoreVertical } from 'lucide-react';

const mockCharts = [
  { id: '1', name: 'Monthly Sales Revenue', type: 'bar', dataset: 'Q1 Sales Data', creator: 'John Doe', updated: '2026-06-02T14:20:00Z' },
  { id: '2', name: 'Customer Churn Rate', type: 'line', dataset: 'CRM Accounts', creator: 'Alice Smith', updated: '2026-06-01T09:10:00Z' },
  { id: '3', name: 'Support Ticket Status', type: 'pie', dataset: 'Zendesk Tickets', creator: 'Bob Jones', updated: '2026-05-28T16:45:00Z' },
];

export default function ChartsPage() {
  const [search, setSearch] = useState('');

  const getChartIcon = (type: string) => {
    switch(type) {
      case 'bar': return <BarChart2 className="w-4 h-4 mr-2 text-blue-500" />;
      case 'line': return <LineChart className="w-4 h-4 mr-2 text-green-500" />;
      case 'pie': return <PieChart className="w-4 h-4 mr-2 text-amber-500" />;
      default: return <BarChart2 className="w-4 h-4 mr-2 text-gray-500" />;
    }
  };

  const filtered = mockCharts.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[var(--st-text)]">Charts & Visualisations</h2>
          <p className="text-muted-foreground text-[var(--st-text)]/60">
            Build and manage data visualisations from your datasets.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Chart
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-4">
        {/* Render some mock chart cards to make it look cool */}
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-100 dark:border-blue-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <BarChart2 className="w-4 h-4 mr-2 text-blue-500" />
              Bar Charts
            </CardTitle>
          </CardHeader>
          <CardBody>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground mt-1">Active visualisations</p>
          </CardBody>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-100 dark:border-green-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <LineChart className="w-4 h-4 mr-2 text-green-500" />
              Time Series
            </CardTitle>
          </CardHeader>
          <CardBody>
            <div className="text-2xl font-bold">8</div>
            <p className="text-xs text-muted-foreground mt-1">Active visualisations</p>
          </CardBody>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-100 dark:border-amber-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <PieChart className="w-4 h-4 mr-2 text-amber-500" />
              Composition
            </CardTitle>
          </CardHeader>
          <CardBody>
            <div className="text-2xl font-bold">4</div>
            <p className="text-xs text-muted-foreground mt-1">Active visualisations</p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Saved Charts</CardTitle>
              <CardDescription>
                Your configured ECharts instances powered by SabBI query execution.
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search charts..."
                  className="w-64 pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <Table>
            <THead>
              <Tr>
                <Th>Chart Name</Th>
                <Th>Type</Th>
                <Th>Source Dataset</Th>
                <Th>Created By</Th>
                <Th>Last Updated</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {filtered.map((chart) => (
                <Tr key={chart.id}>
                  <Td className="font-medium">{chart.name}</Td>
                  <Td>
                    <div className="flex items-center capitalize">
                      {getChartIcon(chart.type)}
                      {chart.type}
                    </div>
                  </Td>
                  <Td>
                    <Badge variant="outline">{chart.dataset}</Badge>
                  </Td>
                  <Td>{chart.creator}</Td>
                  <Td>{new Date(chart.updated).toLocaleDateString()}</Td>
                  <Td className="text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500/80 hover:text-blue-600">
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-[var(--st-text)]/60 hover:text-[var(--st-text)]">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </Td>
                </Tr>
              ))}
              {filtered.length === 0 && (
                <Tr>
                  <Td colSpan={6} className="h-24 text-center text-muted-foreground">
                    No charts found.
                  </Td>
                </Tr>
              )}
            </TBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}
