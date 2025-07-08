
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function AboutUsPage() {
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
            <CardTitle className="text-3xl font-bold font-headline">About SabNode</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm sm:prose-base lg:prose-lg xl:prose-xl dark:prose-invert max-w-none space-y-4 text-foreground/90">
            <p>Welcome to SabNode, your all-in-one solution for business communication and marketing automation. Our mission is to empower businesses of all sizes to connect with their customers in a more meaningful and efficient way.</p>
            <p>Founded on the principle of simplifying complexity, SabNode provides a powerful suite of tools that integrate seamlessly with platforms like WhatsApp and Meta, allowing you to manage campaigns, automate conversations, and engage customers without the technical overhead.</p>
            <h2 className="text-xl font-semibold">Our Vision</h2>
            <p>We believe that technology should be an enabler, not a barrier. Our vision is to build a platform that is not only powerful and scalable but also intuitive and accessible to everyone, from small business owners to enterprise marketing teams.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
