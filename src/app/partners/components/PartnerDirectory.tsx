"use client";

import React, { useState } from 'react';
import { Search, ExternalLink, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const partnersData = [
  { id: 1, name: 'Acme Digital', type: 'Agency', region: 'North America', description: 'Full-service digital transformation agency specializing in SabNode integrations.', url: '#' },
  { id: 2, name: 'CloudSync', type: 'Technology', region: 'Global', description: 'Real-time data synchronization platform for CRM and ERP systems.', url: '#' },
  { id: 3, name: 'Nexus Consult', type: 'Referral', region: 'Europe', description: 'B2B sales and operations consulting firm.', url: '#' },
  { id: 4, name: 'DevFlow', type: 'Technology', region: 'Global', description: 'Workflow automation tools for modern developer teams.', url: '#' },
  { id: 5, name: 'Stellar Integrations', type: 'Agency', region: 'Asia Pacific', description: 'Enterprise software integration experts.', url: '#' },
  { id: 6, name: 'Growth Partners', type: 'Referral', region: 'North America', description: 'Strategic advisors for high-growth SaaS startups.', url: '#' }
];

export function PartnerDirectory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string | null>(null);

  const filteredPartners = partnersData.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType ? p.type === filterType : true;
    return matchesSearch && matchesType;
  });

  return (
    <div className="mt-16 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Partner Directory</h2>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
          <Input 
            placeholder="Search partners..." 
            className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
          {['Agency', 'Technology', 'Referral'].map(type => (
            <button
              key={type}
              onClick={() => setFilterType(filterType === type ? null : type)}
              className={`px-3 py-1.5 text-xs rounded-full border whitespace-nowrap transition-colors ${
                filterType === type 
                  ? 'border-white bg-white text-black font-medium' 
                  : 'border-white/20 text-white/70 hover:bg-white/10'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {filteredPartners.length > 0 ? filteredPartners.map(partner => (
          <div key={partner.id} className="p-5 border border-white/10 rounded-lg bg-[#050505] hover:bg-white/5 transition-colors group flex flex-col h-full">
            <div className="flex justify-between items-start mb-3">
              <h4 className="font-bold text-base text-white">{partner.name}</h4>
              <Badge variant="outline" className="border-white/20 text-white/70 text-[10px] font-normal uppercase tracking-wider">
                {partner.type}
              </Badge>
            </div>
            <p className="text-sm text-white/50 font-sans leading-relaxed flex-1">{partner.description}</p>
            <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
              <span className="text-xs text-white/40 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {partner.region}
              </span>
              <a href={partner.url} className="text-white/60 hover:text-white transition-colors flex items-center gap-1 text-xs">
                View Profile <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )) : (
          <div className="col-span-full py-12 text-center border border-dashed border-white/10 rounded-lg text-white/50">
            No partners found matching your criteria.
          </div>
        )}
      </div>
    </div>
  );
}
