
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function CareersPage() {
  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
            <Link href="/" className="text-primary hover:underline">
                &larr; Back to Home
            </Link>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold font-headline">Careers at SabNode</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm sm:prose-base lg:prose-lg xl:prose-xl dark:prose-invert max-w-none space-y-4 text-foreground/90">
            <p>Join our passionate team and help us build the future of business communication. We're always looking for talented individuals who are excited about solving complex problems and making a real impact.</p>
            <h2 className="text-xl font-semibold">Current Openings</h2>
            <p>We do not have any open positions at the moment, but we are always interested in hearing from talented individuals. Please check back later or send your resume to careers@sabnode.com.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
