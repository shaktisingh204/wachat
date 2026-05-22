import { Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle, ZoruCardDescription, ZoruCardFooter, Button } from '@/components/zoruui';
import Link from 'next/link';
import Image from 'next/image';
import { LandingHeader } from '@/components/landing/landing-header';

const blogPosts = [
    { title: 'Mastering WhatsApp Campaigns: A 2024 Guide', date: 'June 15, 2024', description: 'Unlock the full potential of your WhatsApp marketing with these essential tips and strategies.', image: 'https://placehold.co/600x400.png', aiHint: 'marketing analytics' },
    { title: 'Why No-Code Automation is a Game-Changer', date: 'June 1, 2024', description: 'Discover how our Flow Builder can save you time and increase your operational efficiency without writing a single line of code.', image: 'https://placehold.co/600x400.png', aiHint: 'business automation' },
    { title: 'The Future is Conversational: Building with Meta Flows', date: 'May 20, 2024', description: 'A deep dive into creating rich, interactive experiences inside WhatsApp using Meta Flows.', image: 'https://placehold.co/600x400.png', aiHint: 'user interface' },
]

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingHeader active="resources" />
      <div className="py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold font-headline">The SabNode Blog</h1>
            <p className="mt-4 text-lg text-muted-foreground">Insights, tips, and updates from the team building the future of communication.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {blogPosts.map(post => (
                <Card key={post.title} className="flex flex-col">
                    <ZoruCardHeader className="p-0">
                        <div className="relative aspect-video">
                            <Image src={post.image} alt={post.title} layout="fill" objectFit="cover" className="rounded-t-lg" data-ai-hint={post.aiHint} />
                        </div>
                        <div className="p-4">
                             <p className="text-sm text-muted-foreground">{post.date}</p>
                            <ZoruCardTitle className="text-lg mt-1">{post.title}</ZoruCardTitle>
                        </div>
                    </ZoruCardHeader>
                    <ZoruCardContent className="flex-grow p-4 pt-0">
                        <p className="text-muted-foreground text-sm">{post.description}</p>
                    </ZoruCardContent>
                    <ZoruCardFooter className="p-4">
                        <Button variant="outline" asChild>
                            <Link href="#">Read More</Link>
                        </Button>
                    </ZoruCardFooter>
                </Card>
            ))}
        </div>
      </div>
      </div>
    </div>
  );
}
