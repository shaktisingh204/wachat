

'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Route } from 'lucide-react';
import type { Metadata } from 'next';

const roadMapPhases = [
  { 
    phase: 'MVP', 
    title: 'Minimum Viable Product', 
    milestones: ['Embedded signup for easy onboarding', 'List connected user assets (pages, ad accounts)', 'Basic campaign creation'],
    status: 'Completed' 
  },
  { 
    phase: 'Phase 2', 
    title: 'Insights & Management', 
    milestones: ['Advanced campaign performance insights', 'Audience management tools', 'Sync leads from Lead Ads'],
    status: 'In Progress' 
  },
  { 
    phase: 'Phase 3', 
    title: 'Automation & Optimization', 
    milestones: ['Dynamic Creative Optimization (DCO) support', 'Automated rules for budget and bidding', 'A/B testing for creatives and copy'],
    status: 'Planned' 
  },
  { 
    phase: 'Phase 4', 
    title: 'Scale & Enterprise', 
    milestones: ['Multi-user dashboards with role-based access', 'Advanced billing and performance reports', 'Full support for catalog-based ads'],
    status: 'Planned' 
  },
];

export default function AdsRoadmapPage() {
  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto">
        <div>
            <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                <Route className="h-8 w-8"/>
                Facebook Integration Roadmap
            </h1>
            <p className="text-muted-foreground mt-2">
                Our long-term plan for integrating deeply with the Meta Marketing API.
            </p>
        </div>

        <div className="space-y-8">
            {roadMapPhases.map(phase => (
                <Card key={phase.phase} className="card-gradient card-gradient-green">
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle>{phase.phase}: {phase.title}</CardTitle>
                            <Badge variant={phase.status === 'Completed' ? 'default' : 'secondary'}>{phase.status}</Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-3">
                            {phase.milestones.map((milestone, index) => (
                                <li key={index} className="flex items-start gap-3">
                                    <Check className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
                                    <span>{milestone}</span>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            ))}
        </div>
    </div>
  );
}
