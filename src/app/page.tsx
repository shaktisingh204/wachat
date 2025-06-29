
import { Button } from '@/components/ui/button';
import { WachatLogo } from '@/components/wabasimplify/logo';
import Link from 'next/link';
import { getSession } from '@/app/actions';
import { redirect } from 'next/navigation';
import { Send, GitBranch, MessageSquare, Bot, ArrowRight, Star, ChevronDown, Quote } from 'lucide-react';
import Image from 'next/image';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';


const features = [
  {
    icon: <Send className="h-8 w-8 text-primary" />,
    title: 'Campaign Management',
    description: 'Launch targeted broadcast campaigns to thousands of contacts with detailed, real-time analytics and delivery reports.',
  },
  {
    icon: <GitBranch className="h-8 w-8 text-primary" />,
    title: 'No-Code Flow Builder',
    description: 'Design powerful, automated conversational flows with our intuitive drag-and-drop builder. No coding required.',
  },
  {
    icon: <MessageSquare className="h-8 w-8 text-primary" />,
    title: 'Unified Live Chat',
    description: 'Engage with your customers in real-time through a multi-agent live chat interface, complete with translation tools.',
  },
  {
    icon: <Bot className="h-8 w-8 text-primary" />,
    title: 'AI-Powered Replies',
    description: 'Leverage AI to handle common queries, provide instant support, and translate messages automatically.',
  },
];

const steps = [
  {
    title: 'Connect Your Account',
    description: 'Securely connect your WhatsApp Business Account using our guided setup process in minutes.',
  },
  {
    title: 'Create & Configure',
    description: 'Design message templates, build automated conversational flows, and upload your contact lists.',
  },
  {
    title: 'Launch & Engage',
    description: 'Start your broadcast campaigns and watch your customer engagement grow with our powerful tools.',
  },
];

const testimonials = [
    {
        name: 'Maria Garcia',
        title: 'Marketing Manager, Bloom Co.',
        avatar: 'https://placehold.co/100x100.png',
        text: 'Wachat has revolutionized our customer outreach. The flow builder is incredibly intuitive, and we saw a 200% increase in engagement on our first campaign!',
        aiHint: 'woman portrait',
    },
    {
        name: 'David Chen',
        title: 'Support Lead, TechGear Inc.',
        avatar: 'https://placehold.co/100x100.png',
        text: "The unified live chat and AI auto-replies have cut our support response times in half. It's an essential tool for our team.",
        aiHint: 'man portrait',
    },
    {
        name: 'Aisha Ahmed',
        title: 'Founder, The Artisan Box',
        avatar: 'https://placehold.co/100x100.png',
        text: "As a small business, Wachat gave us the power of a full marketing team. Sending templates and managing contacts has never been easier.",
        aiHint: 'woman face',
    }
]

const faqs = [
    {
        question: 'Is Wachat an official WhatsApp product?',
        answer: 'No, Wachat is an independent application that uses the official WhatsApp Business API provided by Meta. We provide a user-friendly interface to access the powerful features of the API.'
    },
    {
        question: 'What do I need to get started?',
        answer: "You'll need a WhatsApp Business Account (WABA) and a phone number that is not currently being used by a personal WhatsApp account. Our embedded signup process will guide you through connecting your account."
    },
    {
        question: 'Can I use my existing WhatsApp number?',
        answer: "You cannot use a number that is currently active on the consumer WhatsApp app. You'll need to use a new number or migrate your existing business number to the WhatsApp Business API, which is a process we can help guide you through."
    },
    {
        question: 'Is there a free trial?',
        answer: 'Yes, you can sign up for free to explore the platform. Meta may have its own charges for sending messages, which are separate from our platform fees. Please refer to Meta\'s documentation for their latest pricing.'
    }
]

export default async function HomePage() {
  const session = await getSession();

  if (session?.user) {
    redirect('/dashboard');
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center">
          <div className="mr-4 flex">
            <Link href="/" className="mr-6 flex items-center space-x-2">
              <WachatLogo className="h-8 w-auto" />
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-end space-x-2">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Sign Up</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-20 md:py-32">
          <div className="container flex flex-col items-center text-center gap-12">
            <div className="space-y-6 max-w-3xl">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-headline tracking-tighter">
                Streamline Your WhatsApp Business API Experience
              </h1>
              <p className="mx-auto text-lg text-muted-foreground">
                Manage campaigns, automate conversations, and engage customers effortlessly with Wachat. The all-in-one platform for your WhatsApp marketing and support needs.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" asChild>
                  <Link href="/signup">Get Started for Free <ArrowRight className="ml-2 h-5 w-5" /></Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="#features">Learn More <ChevronDown className="ml-2 h-5 w-5"/></Link>
                </Button>
              </div>
            </div>
            <div className="relative p-2 bg-muted rounded-xl w-full max-w-4xl shadow-2xl">
              <Image
                src="https://placehold.co/1200x675.png"
                alt="Wachat dashboard preview"
                width={1200}
                height={675}
                className="rounded-lg ring-1 ring-border w-full h-auto"
                data-ai-hint="app dashboard"
              />
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 bg-muted">
          <div className="container">
            <div className="text-center space-y-4 mb-16">
              <h2 className="text-3xl md:text-4xl font-bold font-headline">Powerful Tools for Growth</h2>
              <p className="max-w-2xl mx-auto text-lg text-muted-foreground">
                Everything you need to scale your customer communication on WhatsApp.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {features.map((feature, index) => (
                <Card key={index} className="text-center hover:shadow-lg hover:-translate-y-2 transition-transform duration-300 w-full flex flex-col">
                  <CardHeader className="items-center">
                    <div className="p-4 bg-primary/10 rounded-full">
                        {feature.icon}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 flex-grow">
                    <h3 className="text-xl font-semibold">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-20">
          <div className="container">
            <div className="text-center space-y-4 mb-16">
              <h2 className="text-3xl md:text-4xl font-bold font-headline">Get Started in 3 Easy Steps</h2>
              <p className="max-w-2xl mx-auto text-lg text-muted-foreground">
                Connecting your business to Wachat is simple and secure.
              </p>
            </div>
            <div className="relative grid grid-cols-1 md:grid-cols-3 gap-y-12 md:gap-x-8">
              {steps.map((step, index) => (
                <div key={index} className="relative flex flex-col items-center text-center space-y-4 px-4">
                   <div className="z-10 h-16 w-16 flex items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-2xl border-8 border-background">
                    {index + 1}
                   </div>
                  <h3 className="text-xl font-semibold mt-2">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-20 bg-muted">
            <div className="container">
                <div className="text-center space-y-4 mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold font-headline">Loved by Businesses Worldwide</h2>
                    <p className="max-w-2xl mx-auto text-lg text-muted-foreground">
                        Don't just take our word for it. Here's what our customers have to say.
                    </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {testimonials.map((testimonial, index) => (
                        <Card key={index} className="flex flex-col">
                            <CardHeader>
                                <Quote className="h-8 w-8 text-primary/30"/>
                            </CardHeader>
                            <CardContent className="flex-grow">
                                <p className="italic text-foreground/90">"{testimonial.text}"</p>
                            </CardContent>
                            <CardFooter className="flex items-center gap-4 mt-4">
                                <Avatar>
                                    <AvatarImage src={testimonial.avatar} alt={testimonial.name} data-ai-hint={testimonial.aiHint}/>
                                    <AvatarFallback>{testimonial.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-semibold">{testimonial.name}</p>
                                    <p className="text-sm text-muted-foreground">{testimonial.title}</p>
                                </div>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            </div>
        </section>

        {/* FAQ Section */}
        <section className="py-20">
            <div className="container max-w-3xl mx-auto">
                 <div className="text-center space-y-4 mb-12">
                    <h2 className="text-3xl md:text-4xl font-bold font-headline">Frequently Asked Questions</h2>
                </div>
                <Accordion type="single" collapsible className="w-full">
                    {faqs.map((faq, index) => (
                        <AccordionItem value={`item-${index}`} key={index}>
                            <AccordionTrigger className="text-lg text-left">{faq.question}</AccordionTrigger>
                            <AccordionContent className="text-base text-muted-foreground">
                                {faq.answer}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </div>
        </section>
        
        {/* Final CTA Section */}
        <section className="py-20">
            <div className="container">
                <div className="relative overflow-hidden bg-primary text-primary-foreground rounded-lg p-8 md:p-16 text-center space-y-6">
                     <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-white/10 rounded-full"></div>
                     <div className="absolute -top-10 -left-10 w-32 h-32 bg-white/10 rounded-full"></div>
                     <h2 className="text-3xl md:text-4xl font-bold font-headline relative z-10">Ready to Supercharge Your WhatsApp?</h2>
                     <p className="max-w-xl mx-auto text-lg text-primary-foreground/80 relative z-10">
                        Join hundreds of businesses growing with Wachat. Create your account and launch your first campaign in minutes.
                    </p>
                    <Button size="lg" variant="secondary" asChild className="relative z-10">
                        <Link href="/signup">Sign Up Now <ArrowRight className="ml-2 h-5 w-5" /></Link>
                    </Button>
                </div>
            </div>
        </section>


      </main>

      {/* Footer */}
      <footer className="border-t">
        <div className="container py-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">&copy; {new Date().getFullYear()} Wachat. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/terms-and-conditions" className="text-sm text-muted-foreground hover:text-primary">
              Terms & Conditions
            </Link>
            <Link href="/privacy-policy" className="text-sm text-muted-foreground hover:text-primary">
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
