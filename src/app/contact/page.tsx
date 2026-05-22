import {
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  Button,
  Input,
  Textarea,
  Label,
} from '@/components/zoruui';
import Link from 'next/link';

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-black text-white font-mono flex flex-col md:flex-row">
      <div className="w-full md:w-64 border-r border-white/20 p-6 flex flex-col gap-4 bg-black">
        <Link href="/" className="hover:underline text-sm uppercase tracking-widest text-white/70">
          &larr; Back to Home
        </Link>
        <div className="mt-8">
          <h3 className="text-xs font-bold uppercase tracking-widest text-white/50 mb-4">Endpoints</h3>
          <ul className="space-y-2 text-sm">
            <li className="font-bold border-l-2 border-white pl-3 text-white">POST /contact</li>
          </ul>
        </div>
      </div>

      <div className="flex-1 p-8 lg:p-12 overflow-y-auto border-r border-white/20 bg-black">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3 mb-6">
            <span className="bg-white text-black px-2 py-1 text-xs font-bold rounded-sm uppercase tracking-widest">Post</span>
            <h1 className="text-3xl font-bold tracking-tight">/v1/contact</h1>
          </div>
          
          <p className="text-white/70 mb-8 leading-relaxed">
            Send a message to our team. Use this endpoint to submit inquiries, feedback, or support requests. We typically respond within 24 hours.
          </p>

          <div className="mb-12">
            <h2 className="text-xl font-bold mb-4 border-b border-white/20 pb-2">Request Body Schema</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-12 gap-4 border border-white/20 p-4 rounded-md bg-white/5">
                <div className="col-span-3 font-semibold text-sm">name</div>
                <div className="col-span-2 text-xs text-white/50">string</div>
                <div className="col-span-7 text-sm text-white/70">Your full name. Required.</div>
              </div>
              <div className="grid grid-cols-12 gap-4 border border-white/20 p-4 rounded-md bg-white/5">
                <div className="col-span-3 font-semibold text-sm">email</div>
                <div className="col-span-2 text-xs text-white/50">string (email)</div>
                <div className="col-span-7 text-sm text-white/70">Your email address for us to respond to. Required.</div>
              </div>
              <div className="grid grid-cols-12 gap-4 border border-white/20 p-4 rounded-md bg-white/5">
                <div className="col-span-3 font-semibold text-sm">message</div>
                <div className="col-span-2 text-xs text-white/50">string</div>
                <div className="col-span-7 text-sm text-white/70">The content of your inquiry. Required. Minimum 10 characters.</div>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold mb-4 border-b border-white/20 pb-2">Company Information</h2>
             <div className="space-y-2 text-sm text-white/70">
                <p><strong className="text-white">Email:</strong> info@sabnode.in</p>
                <p><strong className="text-white">Address:</strong> D829 sector 5 malviya nagar jaipur 302017</p>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full lg:w-[400px] xl:w-[500px] bg-zinc-950 border-l border-white/20 p-6 flex flex-col md:h-screen md:overflow-y-auto">
        <div className="mb-8">
          <h3 className="text-sm font-bold uppercase tracking-widest text-white/50 mb-3">Example Request</h3>
          <div className="bg-black border border-white/20 rounded-md p-4 text-xs font-mono text-white/80 overflow-x-auto">
<pre>{`curl -X POST https://api.sabnode.in/v1/contact \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Jane Doe",
    "email": "jane@example.com",
    "message": "I would like to learn more..."
  }'`}</pre>
          </div>
        </div>

        <div className="flex-1">
          <Card className="bg-black border-white/20 text-white rounded-none shadow-none">
            <ZoruCardHeader className="border-b border-white/20 pb-4">
              <ZoruCardTitle className="text-lg font-bold">Try it out</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent className="pt-6 space-y-5">
              <div className="space-y-2">
                  <Label htmlFor="name" className="text-white">name <span className="text-white/50">*</span></Label>
                  <Input id="name" placeholder="string" className="bg-zinc-900 border-white/20 text-white placeholder:text-white/30 rounded-none focus-visible:ring-1 focus-visible:ring-white" />
              </div>
               <div className="space-y-2">
                  <Label htmlFor="email" className="text-white">email <span className="text-white/50">*</span></Label>
                  <Input id="email" type="email" placeholder="string ($email)" className="bg-zinc-900 border-white/20 text-white placeholder:text-white/30 rounded-none focus-visible:ring-1 focus-visible:ring-white" />
              </div>
               <div className="space-y-2">
                  <Label htmlFor="message" className="text-white">message <span className="text-white/50">*</span></Label>
                  <Textarea id="message" placeholder="string" className="bg-zinc-900 border-white/20 text-white placeholder:text-white/30 rounded-none min-h-[120px] focus-visible:ring-1 focus-visible:ring-white" />
              </div>
              <Button className="w-full bg-white text-black hover:bg-zinc-200 rounded-none font-bold uppercase tracking-widest mt-4">
                Execute
              </Button>
            </ZoruCardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
