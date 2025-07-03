
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function PrivacyPolicyPage() {
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
            <CardTitle className="text-3xl font-bold font-headline">Privacy Policy for SabNode</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm sm:prose-base lg:prose-lg xl:prose-xl dark:prose-invert max-w-none space-y-4 text-foreground/90">
            <p><strong>Last Updated:</strong> {new Date().toLocaleDateString()}</p>
            
            <h2 className="text-xl font-semibold">Introduction</h2>
            <p>Welcome to SabNode ("we," "our," "us"). We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our application, which integrates with the WhatsApp Business API via the Meta Platform.</p>

            <h2 className="text-xl font-semibold">Information We Collect</h2>
            <p>We may collect information about you in a variety of ways. The information we may collect via the Application depends on the content and materials you use, and includes:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Personal Data:</strong> Personally identifiable information, such as your name, email address, and telephone number, that you voluntarily give to us when you register with the Application.</li>
              <li><strong>Business Data:</strong> Information related to your WhatsApp Business Account (WABA), including your WABA ID, phone numbers associated with your account, message templates, and API access tokens.</li>
              <li><strong>Message Data:</strong> When you send and receive messages through our service, we process message content, contact information of your recipients (phone numbers), and metadata (timestamps, message status). This data is processed on your behalf as per your instructions.</li>
              <li><strong>Usage Data:</strong> Information our servers automatically collect when you access the Application, such as your IP address, your browser type, your operating system, your access times, and the pages you have viewed directly before and after accessing the Application.</li>
            </ul>

            <h2 className="text-xl font-semibold">Use of Your Information</h2>
            <p>Having accurate information about you permits us to provide you with a smooth, efficient, and customized experience. Specifically, we may use information collected about you via the Application to:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Create and manage your account.</li>
              <li>Provide the services you request, such as sending broadcast messages and managing templates.</li>
              <li>Increase the efficiency and operation of the Application.</li>
              <li>Monitor and analyze usage and trends to improve your experience with the Application.</li>
              <li>Notify you of updates to the Application.</li>
              <li>Comply with legal and regulatory requirements.</li>
            </ul>

            <h2 className="text-xl font-semibold">Data from Meta Platforms</h2>
            <p>Our service uses the WhatsApp Business API, provided by Meta. By using our service, you agree to Meta's terms and policies. We handle data received from the Meta Platform in accordance with the <a href="https://developers.facebook.com/terms/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Meta Platform Terms</a> and <a href="https://www.whatsapp.com/legal/business-policy/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">WhatsApp Business Policy</a>.</p>

            <h2 className="text-xl font-semibold">Contact Us</h2>
            <p>If you have questions or comments about this Privacy Policy, please contact us at: [Your Contact Email]</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
