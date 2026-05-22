import {
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  Button,
  Input,
  Textarea,
  Label,
  Separator,
} from '@/components/zoruui';
import Link from 'next/link';

import { LandingHeader } from '@/components/landing/landing-header';

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />
      <div className="py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
            <Link href="/" className="text-primary hover:underline">
                &larr; Back to Home
            </Link>
        </div>
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle className="text-3xl font-bold font-headline">Contact Us</ZoruCardTitle>
            <p className="text-muted-foreground">We'd love to hear from you. Please fill out the form below and we'll get back to you as soon as possible.</p>
          </ZoruCardHeader>
          <ZoruCardContent className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" placeholder="Your Name" />
            </div>
             <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="your@email.com" />
            </div>
             <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea id="message" placeholder="How can we help you?" className="min-h-[150px]" />
            </div>
            <Button className="w-full">Send Message</Button>
            <Separator className="my-6" />
            <div className="text-center text-muted-foreground space-y-2">
                <h3 className="font-semibold text-lg text-foreground">Our Information</h3>
                <p>Email: <a href="mailto:info@sabnode.in" className="text-primary">info@sabnode.in</a></p>
                <p>Address: D829 sector 5 malviya nagar jaipur 302017</p>
            </div>
          </ZoruCardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}
