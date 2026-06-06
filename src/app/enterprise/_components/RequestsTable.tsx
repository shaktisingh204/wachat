'use client';

import * as React from 'react';
import { InquiryRecord } from '../types';
import { Input } from '@/components/sabcrm/20ui';
import { Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

export function RequestsTable({ requests, isLoading }: { requests: InquiryRecord[], isLoading: boolean }) {
  const [filter, setFilter] = React.useState('');
  const [sortField, setSortField] = React.useState<keyof InquiryRecord>('createdAt');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const handleSort = (field: keyof InquiryRecord) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const filtered = React.useMemo(() => {
    return requests.filter(r => 
      r.organization.toLowerCase().includes(filter.toLowerCase()) ||
      r.email.toLowerCase().includes(filter.toLowerCase())
    ).sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [requests, filter, sortField, sortDir]);

  const SortIcon = ({ field }: { field: keyof InquiryRecord }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40 inline" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3 ml-1 inline" /> : <ArrowDown className="h-3 w-3 ml-1 inline" />;
  };

  if (!mounted) return null; // Prevent hydration mismatch on dates if rendered immediately

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-white/50" />
        <Input 
          placeholder="Filter by organization or email..." 
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="bg-zinc-900 border-white/20 text-white placeholder:text-white/30 rounded-none max-w-sm h-9 text-xs"
        />
      </div>

      <div className="border border-white/20 bg-black overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-white/5 border-b border-white/20">
            <tr>
              <th className="p-3 font-semibold cursor-pointer hover:bg-white/10" onClick={() => handleSort('organization')}>
                Organization <SortIcon field="organization" />
              </th>
              <th className="p-3 font-semibold cursor-pointer hover:bg-white/10" onClick={() => handleSort('email')}>
                Email <SortIcon field="email" />
              </th>
              <th className="p-3 font-semibold cursor-pointer hover:bg-white/10" onClick={() => handleSort('volume')}>
                Volume <SortIcon field="volume" />
              </th>
              <th className="p-3 font-semibold cursor-pointer hover:bg-white/10" onClick={() => handleSort('status')}>
                Status <SortIcon field="status" />
              </th>
              <th className="p-3 font-semibold cursor-pointer hover:bg-white/10" onClick={() => handleSort('createdAt')}>
                Date <SortIcon field="createdAt" />
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              // Skeleton loading
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-b border-white/10">
                  <td className="p-3"><div className="h-3 w-24 bg-white/10 animate-pulse rounded" /></td>
                  <td className="p-3"><div className="h-3 w-32 bg-white/10 animate-pulse rounded" /></td>
                  <td className="p-3"><div className="h-3 w-16 bg-white/10 animate-pulse rounded" /></td>
                  <td className="p-3"><div className="h-3 w-16 bg-white/10 animate-pulse rounded" /></td>
                  <td className="p-3"><div className="h-3 w-20 bg-white/10 animate-pulse rounded" /></td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-white/40">No inquiries found.</td>
              </tr>
            ) : (
              filtered.map(req => (
                <tr key={req.id} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                  <td className="p-3 font-medium">{req.organization}</td>
                  <td className="p-3 text-white/70">{req.email}</td>
                  <td className="p-3 text-white/70">{req.volume}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold ${
                      req.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                      req.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                      req.status === 'error' ? 'bg-red-500/20 text-red-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {req.status}
                    </span>
                  </td>
                  <td className="p-3 text-white/50">{new Date(req.createdAt).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
