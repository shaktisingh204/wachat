"use client";

import React, { useState } from 'react';
import { Search, ExternalLink, MapPin, Building2 } from 'lucide-react';
import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  Input,
  SegmentedControl,
  type SegmentedItem,
  Card,
  CardBody,
  CardFooter,
  Badge,
  Button,
  EmptyState,
} from '@/components/sabcrm/20ui';

const partnersData = [
  { id: 1, name: 'Acme Digital', type: 'Agency', region: 'North America', description: 'Full-service digital transformation agency specializing in SabNode integrations.', url: '#' },
  { id: 2, name: 'CloudSync', type: 'Technology', region: 'Global', description: 'Real-time data synchronization platform for CRM and ERP systems.', url: '#' },
  { id: 3, name: 'Nexus Consult', type: 'Referral', region: 'Europe', description: 'B2B sales and operations consulting firm.', url: '#' },
  { id: 4, name: 'DevFlow', type: 'Technology', region: 'Global', description: 'Workflow automation tools for modern developer teams.', url: '#' },
  { id: 5, name: 'Stellar Integrations', type: 'Agency', region: 'Asia Pacific', description: 'Enterprise software integration experts.', url: '#' },
  { id: 6, name: 'Growth Partners', type: 'Referral', region: 'North America', description: 'Strategic advisors for high-growth SaaS startups.', url: '#' }
];

type PartnerFilter = 'all' | 'Agency' | 'Technology' | 'Referral';

const FILTER_ITEMS: ReadonlyArray<SegmentedItem<PartnerFilter>> = [
  { value: 'all', label: 'All' },
  { value: 'Agency', label: 'Agency' },
  { value: 'Technology', label: 'Technology' },
  { value: 'Referral', label: 'Referral' },
];

export function PartnerDirectory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<PartnerFilter>('all');

  const filteredPartners = partnersData.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' ? true : p.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="20ui mt-16 space-y-6">
      <PageHeader bordered={false} compact>
        <PageHeaderHeading>
          <PageTitle>Partner Directory</PageTitle>
          <PageDescription>
            Browse agencies, technology partners, and referral specialists working with SabNode.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Input
            iconLeft={Search}
            placeholder="Search partners..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search partners"
          />
        </div>
        <SegmentedControl<PartnerFilter>
          items={FILTER_ITEMS}
          value={filterType}
          onChange={setFilterType}
          size="sm"
          aria-label="Filter partners by type"
        />
      </div>

      {filteredPartners.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredPartners.map(partner => (
            <Card key={partner.id} variant="interactive" className="flex h-full flex-col">
              <CardBody className="flex-1">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h3 className="text-base font-semibold text-[var(--st-text)]">{partner.name}</h3>
                  <Badge tone="neutral" kind="outline">{partner.type}</Badge>
                </div>
                <p className="text-sm leading-relaxed text-[var(--st-text-secondary)]">{partner.description}</p>
              </CardBody>
              <CardFooter className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-xs text-[var(--st-text-tertiary)]">
                  <MapPin className="h-3 w-3" aria-hidden="true" /> {partner.region}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  iconRight={ExternalLink}
                  onClick={() => { if (partner.url && partner.url !== '#') window.open(partner.url, '_blank', 'noopener,noreferrer'); }}
                >
                  View Profile
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Building2}
          title="No partners found"
          description="No partners match your search or selected type. Try a different keyword or filter."
        />
      )}
    </div>
  );
}
