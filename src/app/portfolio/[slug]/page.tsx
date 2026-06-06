import React from "react";
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getSiteBySlug } from '@/app/actions/portfolio.actions';
import { Canvas } from '@/components/zoruui-domain/website-builder/canvas';
import { LayoutGrid, Star } from 'lucide-react';
import { connectToDatabase } from '@/lib/mongodb';
import type { WebsitePage } from '@/lib/definitions';
import { Avatar, AvatarFallback } from '@/components/sabcrm/20ui/compat';
import { Card, CardContent } from '@/components/sabcrm/20ui/compat';

export const dynamic = 'force-dynamic';


export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const params = await props.params;
    const site = await getSiteBySlug(params.slug);
    
    if (!site) {
        return {
            title: 'Portfolio Not Found',
            description: 'The requested portfolio could not be found.'
        };
    }

    return {
        title: `${site.name} | Portfolio`,
        description: `Explore the portfolio and work of ${site.name}.`,
        openGraph: {
            title: `${site.name} | Portfolio`,
            description: `Explore the portfolio and work of ${site.name}.`,
            url: `https://sabnode.com/portfolio/${site.slug}`,
            siteName: 'SabNode',
            type: 'website',
            images: [
                {
                    url: 'https://sabnode.com/og-image.jpg', // Placeholder OG image
                    width: 1200,
                    height: 630,
                    alt: `${site.name} Portfolio`,
                }
            ],
            locale: 'en_US',
        },
        twitter: {
            card: 'summary_large_image',
            title: `${site.name} | Portfolio`,
            description: `Explore the portfolio and work of ${site.name}.`,
            images: ['https://sabnode.com/og-image.jpg'],
        }
    };
}

const MOCK_TESTIMONIALS = [
    {
        id: 1,
        client: 'Sarah Jenkins',
        company: 'TechCorp',
        content: 'Working with this team was incredible. The attention to detail and fast delivery exceeded our expectations.',
        rating: 5,
        avatar: 'SJ'
    },
    {
        id: 2,
        client: 'Michael Chen',
        company: 'Startup Inc',
        content: 'Our conversion rates doubled after the redesign. They truly understand both aesthetics and business goals.',
        rating: 5,
        avatar: 'MC'
    },
    {
        id: 3,
        client: 'Emily Rodriguez',
        company: 'Creative Agency',
        content: 'Highly professional and responsive. They turned our vague ideas into a polished, functional product.',
        rating: 4,
        avatar: 'ER'
    }
];

function TestimonialSection() {
    return (
        <section className="py-24 bg-muted/30">
            <div className="container mx-auto px-4 md:px-6">
                <div className="flex flex-col items-center justify-center space-y-4 text-center">
                    <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl">Client Testimonials</h2>
                    <p className="max-w-[700px] text-muted-foreground md:text-xl/relaxed">
                        Don't just take our word for it. Here's what our clients have to say about our work.
                    </p>
                </div>
                <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3 lg:gap-8 mt-12">
                    {MOCK_TESTIMONIALS.map((t) => (
                        <Card key={t.id} className="bg-background border-none shadow-sm">
                            <CardContent className="p-6">
                                <div className="flex items-center space-x-1 mb-4">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <Star key={i} className={`w-4 h-4 ${i < t.rating ? 'fill-primary text-primary' : 'text-muted'}`} />
                                    ))}
                                </div>
                                <p className="text-muted-foreground mb-6 line-clamp-4">"{t.content}"</p>
                                <div className="flex items-center space-x-4">
                                    <Avatar>
                                        <AvatarFallback>{t.avatar}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="text-sm font-semibold">{t.client}</p>
                                        <p className="text-xs text-muted-foreground">{t.company}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </section>
    );
}

async function WebsiteHomePageContent(props: { params: Promise<{ slug: string }> }) {
    const params = await props.params;
    if (!params.slug) {
        notFound();
    }

    const site = await getSiteBySlug(params.slug);

    if (!site) {
        notFound();
    }

    const { db } = await connectToDatabase();
    const homepage = await db.collection<WebsitePage>('website_pages').findOne({ siteId: site._id, isHomepage: true });

    const homepageLayout = homepage?.layout || [];

    return (
        <main className="min-h-screen flex flex-col">
            <div className="flex-grow">
                {homepageLayout.length > 0 ? (
                    <Canvas
                        layout={homepageLayout}
                        products={[]}
                        shopSlug={site.slug}
                        isEditable={false}
                    />
                ) : (
                    <div className="text-center py-24 text-muted-foreground">
                        <LayoutGrid className="mx-auto h-12 w-12 text-muted-foreground/50"/>
                        <h1 className="mt-4 text-2xl font-semibold">{site.name}</h1>
                        <p className="mt-2 text-sm">This site is under construction. Come back soon!</p>
                    </div>
                )}
            </div>
            
            <TestimonialSection />
        </main>
    );
}


export default function WebsiteHomePage(props: { params: Promise<{ slug: string }> }) {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <WebsiteHomePageContent params={params} />
    </React.Suspense>
  );
}
