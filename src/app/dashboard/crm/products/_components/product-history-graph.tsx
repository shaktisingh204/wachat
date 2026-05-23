'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/zoruui';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const mockHistoryData = [
  { month: 'Jan', price: 120, stock: 45 },
  { month: 'Feb', price: 120, stock: 30 },
  { month: 'Mar', price: 115, stock: 60 },
  { month: 'Apr', price: 115, stock: 50 },
  { month: 'May', price: 125, stock: 20 },
  { month: 'Jun', price: 125, stock: 80 },
];

export function ProductHistoryGraph() {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-lg">Price & Stock History</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={mockHistoryData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" axisLine={false} tickLine={false} />
            <YAxis yAxisId="left" orientation="left" stroke="#8884d8" axisLine={false} tickLine={false} />
            <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" axisLine={false} tickLine={false} />
            <Tooltip />
            <Line yAxisId="left" type="monotone" dataKey="price" stroke="#8884d8" name="Price ($)" strokeWidth={2} />
            <Line yAxisId="right" type="monotone" dataKey="stock" stroke="#82ca9d" name="Stock" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
