
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function TermsAndConditionsPage() {
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
            <CardTitle className="text-3xl font-bold font-headline">Terms and Conditions</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm sm:prose-base lg:prose-lg xl:prose-xl dark:prose-invert max-w-none space-y-4 text-foreground/90">
            <p><strong>Last Updated:</strong> {new Date().toLocaleDateString()}</p>
            
            <h2 className="text-xl font-semibold">1. Agreement to Terms</h2>
            <p>By using Wachat (the "Service"), you agree to be bound by these Terms and Conditions. If you do not agree, do not use the Service.</p>

            <h2 className="text-xl font-semibold">2. Description of Service</h2>
            <p>Wachat provides a platform to interact with the WhatsApp Business API, allowing users to manage message templates, send broadcast messages, and engage with contacts.</p>

            <h2 className="text-xl font-semibold">3. User Responsibilities</h2>
            <p>You are responsible for all activity that occurs under your account. You agree to comply with all applicable laws and regulations in connection with your use of the Service, including the <a href="https://www.whatsapp.com/legal/business-policy/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">WhatsApp Business Policy</a> and <a href="https://developers.facebook.com/terms/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Meta Platform Terms</a>.</p>
            <p>You are responsible for obtaining consent from your contacts to send them messages via WhatsApp. You shall not use the Service for any unlawful or prohibited purpose.</p>

            <h2 className="text-xl font-semibold">4. Intellectual Property</h2>
            <p>The Service and its original content, features, and functionality are and will remain the exclusive property of Wachat and its licensors.</p>

            <h2 className="text-xl font-semibold">5. Termination</h2>
            <p>We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.</p>
            
            <h2 className="text-xl font-semibold">6. Limitation of Liability</h2>
            <p>In no event shall Wachat, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.</p>

            <h2 className="text-xl font-semibold">7. Governing Law</h2>
            <p>These Terms shall be governed and construed in accordance with the laws of [Your Jurisdiction], without regard to its conflict of law provisions.</p>

            <h2 className="text-xl font-semibold">8. Changes</h2>
            <p>We reserve the right, at our sole discretion, to modify or replace these Terms at any time. We will provide notice of any changes by posting the new Terms on this page.</p>

            <h2 className="text-xl font-semibold">Contact Us</h2>
            <p>If you have any questions about these Terms, please contact us at: [Your Contact Email]</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
