'use client';

/**
 * Recharts client wrappers used by the Batch 7 finance report pages.
 *
 * Each component takes a plain-object data array (no Mongo / Date types)
 * so it can be safely passed from a Server Component.
 */

import * as React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';

const PALETTE = ['#5b8def', '#7ec77d', '#f0a26b', '#d97cc4', '#f0d36b', '#6bccd6', '#b7a3e0'];

const fmtINR = (n: number): string =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const tooltipStyle = {
  backgroundColor: 'hsl(var(--zoru-surface))',
  border: '1px solid hsl(var(--zoru-line))',
  borderRadius: 8,
  fontSize: 12,
};

/** Monthly trend line — used by Income + Expense pages. */
export function MonthlyTrendLine({
  data,
  color = '#5b8def',
  label,
}: {
  data: Array<{ period: string; total: number }>;
  color?: string;
  label: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--zoru-line))" />
        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
        <Tooltip contentStyle={tooltipStyle} formatter={((v: number) => fmtINR(v)) as never} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="total" name={label} stroke={color} strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="forecast" name="Forecast" stroke={color} strokeDasharray="5 5" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Category breakdown pie. */
export function CategoryPie({
  data,
  label,
}: {
  data: Array<{ category: string; total: number }>;
  label: string;
}) {
  const top = data.slice(0, 7);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={top} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={90} label={false}>
          {top.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={((v: number, n: unknown) => [fmtINR(v), String(n)]) as never}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/** Profit & Loss stacked bar with revenue / cogs / expense / profit-line. */
export function ProfitLossStackedBar({
  data,
}: {
  data: Array<{ period: string; revenue: number; cogs: number; expense: number; profit: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--zoru-line))" />
        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
        <Tooltip contentStyle={tooltipStyle} formatter={((v: number) => fmtINR(v)) as never} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="revenue" name="Revenue" stackId="a" fill="#7ec77d" />
        <Bar dataKey="cogs" name="COGS" stackId="b" fill="#f0a26b" />
        <Bar dataKey="expense" name="Expenses" stackId="b" fill="#d97cc4" />
        <Bar dataKey="profit" name="Profit" fill="#5b8def" />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Tax: monthly bar — collected vs paid. */
export function TaxBar({
  data,
}: {
  data: Array<{ period: string; collected: number; paid: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--zoru-line))" />
        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
        <Tooltip contentStyle={tooltipStyle} formatter={((v: number) => fmtINR(v)) as never} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="collected" name="Tax collected" fill="#7ec77d" />
        <Bar dataKey="paid" name="Tax paid" fill="#d97cc4" />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Invoice aging: stacked bar of buckets per client. */
export function AgingStackedBar({
  data,
}: {
  data: Array<{ clientName: string; current: number; d31to60: number; d61to90: number; over90: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--zoru-line))" />
        <XAxis dataKey="clientName" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} interval={0} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
        <Tooltip contentStyle={tooltipStyle} formatter={((v: number) => fmtINR(v)) as never} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="current" name="0–30" stackId="a" fill="#7ec77d" />
        <Bar dataKey="d31to60" name="31–60" stackId="a" fill="#f0d36b" />
        <Bar dataKey="d61to90" name="61–90" stackId="a" fill="#f0a26b" />
        <Bar dataKey="over90" name="90+" stackId="a" fill="#d97cc4" />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Payment: MTD received vs target line. */
export function PaymentMtdLine({
  data,
}: {
  data: Array<{ period: string; received: number; target: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--zoru-line))" />
        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
        <Tooltip contentStyle={tooltipStyle} formatter={((v: number) => fmtINR(v)) as never} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="received" name="Received" stroke="#7ec77d" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="target" name="Daily target" stroke="#d97cc4" strokeDasharray="4 4" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Payment: bar of payment methods. */
export function PaymentMethodBar({
  data,
}: {
  data: Array<{ method: string; total: number; count: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--zoru-line))" />
        <XAxis dataKey="method" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
        <Tooltip contentStyle={tooltipStyle} formatter={((v: number) => fmtINR(v)) as never} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="total" name="Total" fill="#5b8def" />
      </BarChart>
    </ResponsiveContainer>
  );
}
