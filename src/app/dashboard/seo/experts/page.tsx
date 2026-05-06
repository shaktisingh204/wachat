'use client';

import {
    ZoruBadge,
    ZoruButton,
    ZoruCard,
    ZoruCardContent,
    ZoruCardDescription,
    ZoruCardFooter,
    ZoruCardHeader,
    ZoruCardTitle,
} from '@/components/zoruui';
import { MapPin, Star } from 'lucide-react';

const EXPERTS = [
    {
        id: 1,
        name: 'Sarah Jenkins',
        title: 'Technical SEO Architect',
        location: 'London, UK',
        rating: 4.9,
        reviews: 124,
        badges: ['E-commerce', 'SaaS', 'Next.js'],
        image: 'https://i.pravatar.cc/150?u=sarah',
        rate: '$150/hr',
    },
    {
        id: 2,
        name: 'David Chen',
        title: 'Local SEO Specialist',
        location: 'Toronto, CA',
        rating: 4.8,
        reviews: 89,
        badges: ['Local Business', 'GMB', 'Schema'],
        image: 'https://i.pravatar.cc/150?u=david',
        rate: '$95/hr',
    },
    {
        id: 3,
        name: 'Elena Rodriguez',
        title: 'Content Marketing Strategist',
        location: 'Madrid, ES',
        rating: 5.0,
        reviews: 212,
        badges: ['Content Strategy', 'Link Building', 'Spanish SEO'],
        image: 'https://i.pravatar.cc/150?u=elena',
        rate: '$120/hr',
    },
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

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {EXPERTS.map((expert) => (
                    <ZoruCard key={expert.id} className="overflow-hidden transition-shadow hover:shadow-[var(--zoru-shadow-sm)]">
                        <ZoruCardHeader className="flex flex-row items-start gap-4">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={expert.image} alt={expert.name} className="h-16 w-16 rounded-full object-cover" />
                            <div>
                                <ZoruCardTitle className="text-lg">{expert.name}</ZoruCardTitle>
                                <ZoruCardDescription>{expert.title}</ZoruCardDescription>
                                <div className="mt-1 flex items-center gap-1 text-sm text-yellow-500">
                                    <Star className="h-4 w-4 fill-current" />
                                    <span className="text-zoru-ink">{expert.rating}</span>
                                    <span className="text-zoru-ink-muted">({expert.reviews})</span>
                                </div>
                            </div>
                        </ZoruCardHeader>
                        <ZoruCardContent>
                            <div className="mb-4 flex flex-wrap gap-2">
                                {expert.badges.map((b) => (
                                    <ZoruBadge key={b} variant="secondary" className="text-xs">
                                        {b}
                                    </ZoruBadge>
                                ))}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-zoru-ink-muted">
                                <MapPin className="h-4 w-4" />
                                {expert.location}
                            </div>
                        </ZoruCardContent>
                        <ZoruCardFooter className="flex items-center justify-between bg-zoru-surface-2 py-3">
                            <span className="text-zoru-ink">{expert.rate}</span>
                            <ZoruButton size="sm">Hire Now</ZoruButton>
                        </ZoruCardFooter>
                    </ZoruCard>
                ))}
            </div>
        </div>
    );
}
