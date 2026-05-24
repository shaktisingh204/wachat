'use client';

import {
  Card,
  ZoruCardTitle,
  ZoruCardDescription,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardFooter,
  Badge,
  Button,
  Avatar,
  ZoruAvatarImage,
  ZoruAvatarFallback,
} from '@/components/zoruui';
import { Star, CheckCircle2, Briefcase, MapPin } from 'lucide-react';

const MOCK_EXPERTS = [
  {
    id: "1",
    name: "Sarah Jenkins",
    title: "Technical SEO Specialist",
    rating: 4.9,
    reviews: 124,
    rate: "$85/hr",
    location: "New York, USA",
    avatar: "https://i.pravatar.cc/150?u=sarah",
    skills: ["Core Web Vitals", "Next.js", "Site Architecture", "Schema Markup"],
    description: "Specializing in technical SEO for modern JavaScript frameworks. I can help you fix those tricky hydration and rendering issues impacting your search visibility.",
    verified: true,
  },
  {
    id: "2",
    name: "Marcus Thorne",
    title: "Content Strategist & SEO",
    rating: 4.8,
    reviews: 89,
    rate: "$65/hr",
    location: "London, UK",
    avatar: "https://i.pravatar.cc/150?u=marcus",
    skills: ["Keyword Research", "Content Audits", "Link Building", "Copywriting"],
    description: "I help brands scale their organic traffic through data-driven content strategies and high-quality editorial planning.",
    verified: true,
  },
  {
    id: "3",
    name: "Elena Rodriguez",
    title: "E-commerce SEO Expert",
    rating: 5.0,
    reviews: 210,
    rate: "$95/hr",
    location: "Remote",
    avatar: "https://i.pravatar.cc/150?u=elena",
    skills: ["Shopify SEO", "Product Optimization", "Conversion Rate", "Technical SEO"],
    description: "Driven e-commerce specialist with a proven track record of increasing organic revenue for online stores.",
    verified: true,
  },
  {
    id: "4",
    name: "David Chen",
    title: "Local SEO Consultant",
    rating: 4.7,
    reviews: 56,
    rate: "$50/hr",
    location: "Toronto, CA",
    avatar: "https://i.pravatar.cc/150?u=david",
    skills: ["Google Business Profile", "Citation Building", "Local Pack", "Review Management"],
    description: "Helping brick-and-mortar businesses dominate their local search results and drive more foot traffic.",
    verified: false,
  }
];

export default function ExpertsDirectoryPage() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl text-zoru-ink">Hire a Vetted Expert</h1>
                <p className="text-zoru-ink-muted mt-2">
                    Need help fixing those Critical Issues? Match with a pro who knows this platform.
                </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-2">
                {MOCK_EXPERTS.map(expert => (
                    <Card key={expert.id} className="flex flex-col">
                        <ZoruCardHeader className="flex flex-row items-start gap-4 pb-4">
                            <Avatar className="h-16 w-16 border">
                                <ZoruAvatarImage src={expert.avatar} alt={expert.name} />
                                <ZoruAvatarFallback>{expert.name.substring(0, 2)}</ZoruAvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <ZoruCardTitle className="flex items-center gap-1.5 text-lg">
                                            {expert.name}
                                            {expert.verified && (
                                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                            )}
                                        </ZoruCardTitle>
                                        <p className="text-sm text-zoru-ink-muted">{expert.title}</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-semibold text-zoru-ink">{expert.rate}</div>
                                    </div>
                                </div>
                                
                                <div className="mt-2 flex items-center gap-3 text-sm text-zoru-ink-muted">
                                    <div className="flex items-center gap-1">
                                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                                        <span className="font-medium text-zoru-ink">{expert.rating}</span>
                                        <span>({expert.reviews})</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <MapPin className="h-3.5 w-3.5" />
                                        <span>{expert.location}</span>
                                    </div>
                                </div>
                            </div>
                        </ZoruCardHeader>
                        <ZoruCardContent className="flex-1 pb-4">
                            <ZoruCardDescription className="line-clamp-3 text-sm text-zoru-ink-muted">
                                {expert.description}
                            </ZoruCardDescription>
                            <div className="mt-4 flex flex-wrap gap-2">
                                {expert.skills.map(skill => (
                                    <Badge key={skill} variant="secondary">
                                        {skill}
                                    </Badge>
                                ))}
                            </div>
                        </ZoruCardContent>
                        <ZoruCardFooter className="pt-0">
                            <Button variant="outline" className="w-full gap-2">
                                <Briefcase className="h-4 w-4" />
                                Contact Expert
                            </Button>
                        </ZoruCardFooter>
                    </Card>
                ))}
            </div>
        </div>
    );
}
