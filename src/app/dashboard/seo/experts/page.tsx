'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, MapPin, Star } from 'lucide-react';

const EXPERTS = [
    {
        id: 1,
        name: "Sarah Jenkins",
        title: "Technical SEO Architect",
        location: "London, UK",
        rating: 4.9,
        reviews: 124,
        badges: ["E-commerce", "SaaS", "Next.js"],
        image: "https://i.pravatar.cc/150?u=sarah",
        rate: "$150/hr"
    },
    {
        id: 2,
        name: "David Chen",
        title: "Local SEO Specialist",
        location: "Toronto, CA",
        rating: 4.8,
        reviews: 89,
        badges: ["Local Business", "GMB", "Schema"],
        image: "https://i.pravatar.cc/150?u=david",
        rate: "$95/hr"
    },
    {
        id: 3,
        name: "Elena Rodriguez",
        title: "Content Marketing Strategist",
        location: "Madrid, ES",
        rating: 5.0,
        reviews: 212,
        badges: ["Content Strategy", "Link Building", "Spanish SEO"],
        image: "https://i.pravatar.cc/150?u=elena",
        rate: "$120/hr"
    }
];

export default function ExpertsDirectoryPage() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Hire a Vetted Expert</h1>
                <p className="text-muted-foreground mt-2">
                    Need help fixing those Critical Issues? Match with a pro who knows this platform.
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {EXPERTS.map((expert) => (
                    <Card key={expert.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                        <CardHeader className="flex flex-row gap-4 items-start">
                            <img src={expert.image} alt={expert.name} className="w-16 h-16 rounded-full object-cover" />
                            <div>
                                <CardTitle className="text-lg">{expert.name}</CardTitle>
                                <CardDescription>{expert.title}</CardDescription>
                                <div className="flex items-center gap-1 text-sm text-yellow-500 mt-1">
                                    <Star className="w-4 h-4 fill-current" />
                                    <span className="font-medium text-foreground">{expert.rating}</span>
                                    <span className="text-muted-foreground">({expert.reviews})</span>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-2 mb-4">
                                {expert.badges.map(b => (
                                    <Badge key={b} variant="secondary" className="text-xs">{b}</Badge>
                                ))}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <MapPin className="w-4 h-4" />
                                {expert.location}
                            </div>
                        </CardContent>
                        <CardFooter className="bg-muted/50 flex justify-between items-center py-3">
                            <span className="font-bold">{expert.rate}</span>
                            <Button size="sm">Hire Now</Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    );
}
