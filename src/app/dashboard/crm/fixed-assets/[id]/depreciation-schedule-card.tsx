'use client';

import { Card, ZoruCardHeader, ZoruCardTitle, ZoruCardContent } from '@/components/sabcrm/20ui/compat';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function DepreciationScheduleCard({ asset }: { asset: any }) {
  if (!asset.cost || !asset.purchaseDate || !asset.usefulLifeMonths) {
    return (
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Depreciation schedule</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <p className="text-[13px] text-zoru-ink-muted">Incomplete data to calculate schedule. Ensure cost, purchase date, and useful life are set.</p>
        </ZoruCardContent>
      </Card>
    );
  }

  const cost = asset.cost;
  const residual = asset.residualValue || 0;
  const life = asset.usefulLifeMonths;
  const purchaseDate = new Date(asset.purchaseDate);

  const data = [];
  const years = Math.ceil(life / 12);
  const method = asset.depreciationMethod;

  if (method === 'slm' || !method) {
    const yearlyDepreciation = ((cost - residual) / life) * 12;
    for (let i = 0; i <= years; i++) {
      const yearDate = new Date(purchaseDate);
      yearDate.setFullYear(yearDate.getFullYear() + i);
      const val = Math.max(residual, cost - (yearlyDepreciation * i));
      data.push({
        year: yearDate.getFullYear(),
        value: val
      });
    }
  } else if (method === 'wdv') {
    const rate = 1 - Math.pow(residual / cost, 1 / (life / 12));
    let currentVal = cost;
    for (let i = 0; i <= years; i++) {
      const yearDate = new Date(purchaseDate);
      yearDate.setFullYear(yearDate.getFullYear() + i);
      data.push({
        year: yearDate.getFullYear(),
        value: currentVal
      });
      currentVal = Math.max(residual, currentVal * (1 - rate));
    }
  }

  return (
    <Card>
      <ZoruCardHeader>
        <ZoruCardTitle>Depreciation schedule</ZoruCardTitle>
      </ZoruCardHeader>
      <ZoruCardContent>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} 
                tickFormatter={(val) => new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short' }).format(val)} 
              />
              <Tooltip 
                formatter={(value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: asset.currency || 'INR', maximumFractionDigits: 0 }).format(value)}
                labelStyle={{ color: '#111827' }}
              />
              <Area type="monotone" dataKey="value" stroke="#3b82f6" fillOpacity={1} fill="url(#colorValue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ZoruCardContent>
    </Card>
  );
}
