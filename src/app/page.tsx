
import { Button } from '@/components/ui/button';
import { WachatLogo } from '@/components/wabasimplify/logo';
import Link from 'next/link';
import { Send, GitBranch, MessageSquare, Bot, ArrowRight, Star, ChevronDown, Quote, Play, ArrowRightLeft, ToggleRight, ServerCog, Megaphone, Check, AtSign, Zap, MessageCircle, ShoppingBag, Pencil } from 'lucide-react';
import Image from 'next/image';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue } from '@/components/ui/select';


const features = [
  {
    icon: <Send className="h-8 w-8 text-primary" />,
    title: 'Campaign Management',
    description: 'Launch targeted broadcast campaigns with detailed, real-time analytics and delivery reports.',
    gradient: 'card-gradient-green',
  },
  {
    icon: <GitBranch className="h-8 w-8 text-primary" />,
    title: 'No-Code Flow Builder',
    description: 'Design powerful, automated conversational flows with our intuitive drag-and-drop builder.',
    gradient: 'card-gradient-blue',
  },
  {
    icon: <MessageSquare className="h-8 w-8 text-primary" />,
    title: 'Unified Live Chat',
    description: 'Engage with your customers in real-time through a multi-agent live chat interface.',
    gradient: 'card-gradient-purple',
  },
  {
    icon: <Bot className="h-8 w-8 text-primary" />,
    title: 'AI-Powered Replies',
    description: 'Leverage AI to handle common queries, provide instant support, and translate messages automatically.',
    gradient: 'card-gradient-orange',
  },
  {
    icon: <ServerCog className="h-8 w-8 text-primary" />,
    title: 'Interactive Flows',
    description: 'Build rich, native forms and UI screens that open directly inside WhatsApp, boosting conversion rates.',
    gradient: 'card-gradient-blue',
  },
  {
    icon: <Megaphone className="h-8 w-8 text-primary" />,
    title: 'WhatsApp Ads',
    description: 'Create and manage "Click to WhatsApp" ad campaigns directly from the dashboard to drive new leads.',
    gradient: 'card-gradient-green',
  }
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

const FlowNode = ({ icon, title, position, delay, children }: { icon: React.ReactNode, title: string, position: string, delay: string, children?: React.ReactNode }) => (
    <Card className={cn("absolute w-40 animate-fade-in-up", position)} style={{ animationDelay: delay }}>
        <CardHeader className="flex flex-row items-center gap-3 p-3">
            {icon}
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </CardHeader>
        {children && <CardContent className="p-3 pt-0">{children}</CardContent>}
    </Card>
);

export default async function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 items-center">
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
        <section className="py-16 md:py-24">
          <div className="container mx-auto grid justify-items-center text-center gap-8">
            <div className="space-y-4 max-w-3xl">
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
            <div className="relative p-2 bg-muted rounded-xl w-full max-w-6xl shadow-2xl">
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
        <section id="features" className="py-16 bg-muted">
          <div className="container mx-auto">
            <div className="text-center space-y-4 mb-12">
              <h2 className="text-3xl md:text-4xl font-bold font-headline">Powerful Tools for Growth</h2>
              <p className="max-w-2xl mx-auto text-lg text-muted-foreground">
                Everything you need to scale your customer communication on WhatsApp.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <Card key={index} className={cn("text-center hover:shadow-lg hover:-translate-y-2 transition-transform duration-300 flex flex-col card-gradient", feature.gradient)}>
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

        {/* Visual Automation Section */}
        <section id="visual-automation" className="py-16 md:py-24 bg-background overflow-hidden">
          <div className="container mx-auto">
            <div className="text-center space-y-4 mb-16">
              <h2 className="text-3xl md:text-4xl font-bold font-headline">Visual Automation at Your Fingertips</h2>
              <p className="max-w-3xl mx-auto text-lg text-muted-foreground">
                Craft powerful conversational journeys with our two distinct visual builders, designed for every business need.
              </p>
            </div>

            <div className="flex flex-col gap-24 items-center">
              
              {/* Flow Builder UI Mockup */}
              <div className="space-y-4 w-full">
                <h3 className="text-2xl font-semibold text-center">No-Code Flow Builder</h3>
                <p className="text-muted-foreground text-center max-w-md mx-auto">Visually map out complex conversation logic with branching, conditions, and API calls. Perfect for support bots and drip campaigns.</p>
                <div className="relative p-6 border rounded-xl bg-card shadow-lg h-[400px] lg:h-[450px] overflow-hidden group">
                    <FlowNode icon={<Play className="h-5 w-5 text-muted-foreground" />} title="Start Flow" position="top-40 left-6" delay="0.1s" />
                    <FlowNode icon={<MessageSquare className="h-5 w-5 text-muted-foreground" />} title="Welcome Message" position="top-40 left-52" delay="0.3s" />
                    <FlowNode icon={<ToggleRight className="h-5 w-5 text-muted-foreground" />} title="Main Menu" position="top-40 left-[27rem]" delay="0.5s">
                        <div className="space-y-1 text-xs text-center text-muted-foreground">
                            <div className="bg-background rounded-sm py-1 border">Check Balance</div>
                            <div className="bg-background rounded-sm py-1 border">Talk to Agent</div>
                        </div>
                    </FlowNode>
                    <FlowNode icon={<ArrowRightLeft className="h-5 w-5 text-muted-foreground" />} title="Check Balance API" position="top-20 left-[46rem]" delay="0.7s" />
                    <FlowNode icon={<MessageSquare className="h-5 w-5 text-muted-foreground" />} title="Connect to Agent" position="bottom-20 left-[46rem]" delay="0.9s" />

                    <svg className="absolute top-0 left-0 w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M184 190 L 208 190" stroke="hsl(var(--border))" strokeWidth="2" className="animate-draw" style={{ animationDelay: '0.2s' }}/>
                        <path d="M368 190 L 432 190" stroke="hsl(var(--border))" strokeWidth="2" className="animate-draw" style={{ animationDelay: '0.4s' }}/>
                        <path d="M592 185 C 664 185, 664 110, 736 110" stroke="hsl(var(--border))" strokeWidth="2" className="animate-draw" style={{ animationDelay: '0.6s' }}/>
                        <path d="M592 235 C 664 235, 664 340, 736 340" stroke="hsl(var(--border))" strokeWidth="2" className="animate-draw" style={{ animationDelay: '0.8s' }}/>
                    </svg>
                </div>
              </div>

              {/* Declarative Flow UI Builder Mockup */}
              <div className="space-y-4 w-full">
                <h3 className="text-2xl font-semibold text-center">Declarative Flow UI Builder</h3>
                <p className="text-muted-foreground text-center max-w-md mx-auto">Build rich, native forms and multi-step experiences that open directly inside WhatsApp for higher conversion rates.</p>
                <div className="relative mt-8">
                    <div className="relative p-6 border rounded-xl bg-card shadow-lg h-[450px] flex justify-center items-center w-full max-w-sm mx-auto">
                        <div className="absolute -top-8 -left-12 w-24 h-24 bg-primary/10 rounded-full -z-10 animate-fade-in-up"></div>
                        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-accent/10 rounded-full -z-10 animate-fade-in-up" style={{ animationDelay: '0.2s' }}></div>
                        
                        <Card className="absolute top-12 -left-28 bg-card p-3 rounded-lg shadow-lg animate-fade-in-up w-48 text-left" style={{ animationDelay: '0.4s' }}>
                            <p className="text-xs font-semibold">"This is incredible!"</p>
                            <p className="text-xs text-muted-foreground">- Mark T.</p>
                        </Card>
                        
                        <Card className="absolute bottom-16 -right-32 bg-card p-3 rounded-lg shadow-lg animate-fade-in-up w-52 text-left" style={{ animationDelay: '0.6s' }}>
                            <div className="flex items-center gap-1">
                                {[...Array(5)].map((_, i) => <Star key={i} className="h-3 w-3 text-yellow-400 fill-yellow-400" />)}
                            </div>
                            <p className="text-xs font-semibold mt-1">Saved us hours of work.</p>
                        </Card>

                        {/* Phone Mockup */}
                        <div className="w-64 h-[420px] bg-gray-800 rounded-3xl p-2 shadow-2xl z-10">
                            <div className="h-full bg-white rounded-2xl flex flex-col relative overflow-hidden">
                                <div className="flex-1 p-3 space-y-2 overflow-y-auto">
                                    <div className="p-2 bg-gray-200 rounded-lg text-xs max-w-[80%]">Welcome! Tap below to book an appointment.</div>
                                    <div className="flex justify-end">
                                        <div className="p-2 bg-blue-500 text-white rounded-lg text-xs max-w-[80%]">Book Now</div>
                                    </div>
                                </div>
                                {/* The animated flow part */}
                                <div className="absolute inset-0 bg-black/30 flex flex-col justify-end">
                                    <div className="bg-background rounded-t-xl h-full flex flex-col animate-slide-in-up">
                                        <div className="p-2 border-b text-center font-semibold text-sm flex-shrink-0">Book Appointment</div>
                                        <div className="flex-1 p-3 space-y-3 overflow-auto">
                                            <div className="animate-fade-in-up" style={{animationDelay: '0.2s'}}><Label className="text-xs">Your Name</Label><Input className="h-8 text-xs" placeholder="John Doe"/></div>
                                            <div className="animate-fade-in-up" style={{animationDelay: '0.4s'}}><Label className="text-xs">Select Service</Label><Select><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Choose a service..."/></SelectTrigger></Select></div>
                                            <div className="animate-fade-in-up" style={{animationDelay: '0.6s'}}><Label className="text-xs">Preferred Date</Label><Input type="date" className="h-8 text-xs"/></div>
                                        </div>
                                        <div className="p-3 border-t flex-shrink-0"><Button className="w-full h-9 bg-primary hover:bg-primary/90 text-primary-foreground text-sm animate-fade-in-up" style={{animationDelay: '0.8s'}}>Confirm Booking</Button></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Live Action Section */}
        <section className="py-16 md:py-24 bg-muted">
          <div className="container mx-auto">
             <div className="text-center space-y-4 mb-16">
              <h2 className="text-3xl md:text-4xl font-bold font-headline">See It All In Action</h2>
              <p className="max-w-3xl mx-auto text-lg text-muted-foreground">
                From the first touchpoint to the final sale, see how Wachat streamlines your entire customer conversation in one seamless flow.
              </p>
            </div>

            <div className="relative flex justify-center">
              {/* Doodles */}
              <Zap className="h-8 w-8 text-yellow-400 absolute top-0 -left-4 animate-fade-in-up" style={{animationDelay: '0.5s'}} />
              <AtSign className="h-6 w-6 text-red-400 absolute top-16 -right-8 animate-fade-in-up" style={{animationDelay: '0.7s'}}/>
              <Pencil className="h-7 w-7 text-blue-400 absolute bottom-24 -left-12 animate-fade-in-up" style={{animationDelay: '0.9s'}}/>
              <ShoppingBag className="h-9 w-9 text-green-500 absolute bottom-8 -right-4 animate-fade-in-up" style={{animationDelay: '1.1s'}}/>
              <MessageCircle className="h-5 w-5 text-purple-400 absolute top-3/4 left-0 animate-fade-in-up" style={{animationDelay: '1.3s'}}/>
              <Check className="h-8 w-8 text-green-500 absolute top-8 right-0 animate-fade-in-up" style={{animationDelay: '1.5s'}}/>

              {/* Phone Mockup */}
              <div className="w-full max-w-sm bg-slate-800 rounded-[2.5rem] p-3 shadow-2xl z-10">
                <div className="h-[700px] bg-[#E5DDD5] rounded-[2rem] flex flex-col relative overflow-hidden [background-image:url('https://placehold.co/400x800.png')] bg-center bg-cover" data-ai-hint="chat background">
                   <div className="absolute inset-0 bg-black/5"></div>
                   {/* Header */}
                   <div className="bg-[#008069] text-white p-3 flex items-center gap-3 flex-shrink-0 z-10 shadow-md">
                      <Avatar><AvatarFallback>A</AvatarFallback></Avatar>
                      <div className="flex-1"><p className="font-semibold">Acme Inc.</p><p className="text-xs opacity-80">tap here for contact info</p></div>
                   </div>
                   {/* Chat */}
                   <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                      <div className="flex justify-start"><div className="bg-white rounded-lg p-2 text-sm max-w-xs shadow">Hi, I'm interested in your products.</div></div>
                      <div className="flex justify-end"><div className="bg-[#DCF8C6] rounded-lg p-2 text-sm max-w-xs shadow">Thanks for your message! This is an auto-reply.</div></div>
                      <div className="flex justify-end"><div className="bg-[#DCF8C6] rounded-lg p-2 text-sm max-w-xs shadow">You can find our latest offers here: [link] (Canned Reply)</div></div>
                      <div className="flex justify-end"><div className="bg-[#DCF8C6] rounded-lg p-2 text-sm max-w-xs shadow">It looks like you're asking about pricing. Our standard plan is $49/mo. (Flow Builder Reply)</div></div>
                      <div className="flex justify-end">
                        <div className="bg-[#DCF8C6] rounded-lg p-2 text-sm max-w-xs shadow space-y-2">
                          <p>Ready to order? Open our interactive order form to get started!</p>
                          <Button className="w-full bg-white text-green-600 hover:bg-white/90 shadow-none border-t border-black/10 rounded-t-none -m-2 mt-2">🛒 Start Your Order</Button>
                        </div>
                      </div>
                   </div>
                   {/* Meta Flow Overlay */}
                   <div className="absolute inset-0 bg-black/40 flex flex-col justify-end z-20">
                      <div className="bg-slate-100 h-[90%] rounded-t-2xl flex flex-col">
                        <div className="p-3 border-b text-center font-semibold">Order Products</div>
                        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                          <p className="font-semibold">Summer Collection</p>
                          <div className="flex gap-3 border rounded-lg p-3 bg-white">
                            <Image src="https://placehold.co/80x80.png" alt="product" width={80} height={80} className="rounded-md" data-ai-hint="shirt product"/>
                            <div><p className="font-medium">Cool T-Shirt</p><p className="text-sm text-muted-foreground">$25.00</p><Button size="sm" variant="outline" className="mt-1 h-7">Add</Button></div>
                          </div>
                          <div className="flex gap-3 border rounded-lg p-3 bg-white">
                             <Image src="https://placehold.co/80x80.png" alt="product" width={80} height={80} className="rounded-md" data-ai-hint="sunglasses product"/>
                            <div><p className="font-medium">Sunglasses</p><p className="text-sm text-muted-foreground">$40.00</p><Button size="sm" variant="outline" className="mt-1 h-7">Add</Button></div>
                          </div>
                        </div>
                        <div className="p-3 border-t bg-white"><Button className="w-full bg-primary">View Cart (2)</Button></div>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-16">
            <div className="container mx-auto">
                <div className="text-center space-y-4 mb-12">
                    <h2 className="text-3xl md:text-4xl font-bold font-headline">Loved by Businesses Worldwide</h2>
                    <p className="max-w-2xl mx-auto text-lg text-muted-foreground">
                        Don't just take our word for it. Here's what our customers have to say.
                    </p>
                </div>
                <div className="flex flex-wrap justify-center gap-6">
                    {testimonials.map((testimonial, index) => (
                        <Card key={index} className="w-full max-w-sm flex flex-col card-gradient card-gradient-blue">
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
        <section className="py-16 bg-muted">
            <div className="container max-w-3xl mx-auto">
                 <div className="text-center space-y-4 mb-10">
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
        <section className="py-16">
            <div className="container mx-auto">
                <div className="relative overflow-hidden bg-primary text-primary-foreground rounded-lg p-8 md:p-12 text-center space-y-4">
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
        <div className="container mx-auto py-6 flex flex-col sm:flex-row justify-between items-center gap-4">
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
