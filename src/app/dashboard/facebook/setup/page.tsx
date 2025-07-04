
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Wrench } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Facebook Marketing Setup | SabNode',
};

export default function MarketingApiSetupPage() {
  return (
    <div className="flex flex-col gap-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
            <Wrench className="h-8 w-8"/>
            Facebook Marketing Setup
        </h1>
        <p className="text-muted-foreground mt-2">
            Connecting your Facebook Page and Ad Account is easy with our guided setup.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Guided Setup Process</CardTitle>
          <CardDescription>
            We use Facebook's secure Embedded Signup to connect your accounts in just a few clicks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-3 pl-5 text-sm">
            <li>Navigate to the main Facebook Manager page in your dashboard.</li>
            <li>Click the "Connect with Facebook" button.</li>
            <li>A secure pop-up window from Facebook will open.</li>
            <li>Follow the on-screen instructions to select the Facebook Page and Ad Account you wish to use for your campaigns.</li>
            <li>Grant the necessary permissions for SabNode to manage ads on your behalf.</li>
          </ol>
           <p className="text-sm mt-4 text-muted-foreground">
             That's it! Your accounts will be securely connected, and you'll be able to create ads directly from the platform.
           </p>
        </CardContent>
      </Card>
      
       <div className="flex justify-center">
            <Button asChild>
                <Link href="/dashboard/facebook">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Go to Facebook Manager
                </Link>
            </Button>
       </div>
    </div>
  );
}
