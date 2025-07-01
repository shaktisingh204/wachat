
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle,
  Megaphone,
  Settings,
  Link2,
  Rocket,
  Bot,
  BarChart2,
  Database,
  Star,
} from 'lucide-react';

const roadmapPhases = [
  {
    phase: 1,
    title: 'Preparation & Setup',
    icon: Settings,
    description: 'Ensure your Meta Business assets are correctly configured before you start.',
    points: [
      'Meta Business Manager verified',
      'Facebook Page connected',
      'WhatsApp Business Account (WABA) with Cloud API access',
      'Credit card added for ads',
      'Developer App with ads_management, whatsapp_business_messaging, and business_management permissions',
    ],
  },
  {
    phase: 2,
    title: 'Connect Assets',
    icon: Link2,
    description: 'Link your WhatsApp number to your Facebook Page. This is required to show the WhatsApp call-to-action on your ads.',
  },
  {
    phase: 3,
    title: 'Ad Creation: "Click to WhatsApp"',
    icon: Megaphone,
    description: 'Create Facebook or Instagram ads that start a WhatsApp chat using the Meta Marketing API.',
    steps: [
      { title: 'Create Campaign', details: 'Objective: MESSAGES' },
      { title: 'Create Ad Set', details: 'Set targeting, budget, and optimization goal.' },
      { title: 'Create Ad Creative', details: 'Design the ad with a call-to-action to WhatsApp.' },
      { title: 'Create Ad', details: 'Combine the ad set and creative to launch the ad.' },
    ],
  },
  {
    phase: 4,
    title: 'Automate WhatsApp Replies',
    icon: Bot,
    description: 'Set up a webhook using the WhatsApp Cloud API to receive and process incoming messages.',
    points: [
        'Subscribe to "messages", "message_deliveries", and "message_status" webhook fields.',
    ],
  },
  {
    phase: 5,
    title: 'Reply to Ad Leads',
    icon: Rocket,
    description: 'When a customer clicks your ad and sends a message, your webhook receives it, allowing you to send an automated or manual reply.',
  },
   {
    phase: 6,
    title: 'Use Flows / Forms (Optional)',
    icon: Star,
    description: 'Create interactive forms and experiences within WhatsApp to qualify leads and gather information efficiently.',
  },
  {
    phase: 7,
    title: 'Track Performance',
    icon: BarChart2,
    description: 'Use the Meta Insights API to track ad performance (clicks, impressions) and Cloud API webhooks for message delivery and read status.',
  },
  {
    phase: 8,
    title: 'CRM or DB Sync',
    icon: Database,
    description: 'Store lead information (phone number, message, ad ID, etc.) in your database or CRM for follow-up and analysis.',
  },
];

const apiOverview = [
    { func: 'Ad Creation', api: 'Meta Marketing API'},
    { func: 'Ad Tracking', api: 'Insights API'},
    { func: 'WhatsApp Automation', api: 'WhatsApp Cloud API'},
    { func: 'Lead Forms', api: 'WhatsApp Flows API'},
    { func: 'CRM Integration', api: 'Webhooks + DB'},
    { func: 'Re-engagement', api: 'WhatsApp Template Messages'},
]

export default function WhatsAppAdsRoadmapPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
            <Megaphone className="h-8 w-8" />
            WhatsApp Ads Roadmap
        </h1>
        <p className="text-muted-foreground mt-2 max-w-3xl">
          A complete guide to integrating Meta Marketing API and WhatsApp Cloud API for a full ad-to-lead workflow.
        </p>
      </div>

      <div className="space-y-6">
        {roadmapPhases.map((phase) => (
          <Card key={phase.phase}>
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 flex-shrink-0">
                    <phase.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <CardTitle>Phase {phase.phase}: {phase.title}</CardTitle>
                    <CardDescription className="mt-1">{phase.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            {(phase.points || phase.steps) && (
                <CardContent>
                {phase.points && (
                    <ul className="space-y-2">
                        {phase.points.map((point, index) => (
                            <li key={index} className="flex items-start gap-3">
                                <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                                <span>{point}</span>
                            </li>
                        ))}
                    </ul>
                )}
                {phase.steps && (
                     <ol className="list-decimal list-inside space-y-2">
                        {phase.steps.map((step, index) => (
                            <li key={index}>
                                <strong>{step.title}:</strong> <span className="text-muted-foreground">{step.details}</span>
                            </li>
                        ))}
                    </ol>
                )}
                </CardContent>
            )}
          </Card>
        ))}
      </div>

       <Card>
            <CardHeader>
                <CardTitle>Full Stack API Overview</CardTitle>
                <CardDescription>A summary of which APIs are used for each function in the workflow.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="divide-y divide-border">
                    {apiOverview.map((item, index) => (
                        <div key={index} className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-3">
                            <span className="font-semibold">{item.func}</span>
                            <Badge variant="outline">{item.api}</Badge>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    </div>
  );
}
