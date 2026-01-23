
'use client';

import { useActionState, useEffect, useRef, useState, useMemo } from 'react';
import { useFormStatus } from 'react-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoaderCircle, QrCode, Link as LinkIcon, Text, Mail, Phone, Wifi } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createQrCode } from '@/app/actions/qr-code.actions';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { QrCodeDialog } from './qr-code-dialog';
import type { User, Tag, WithId } from '@/lib/definitions';
import { MultiSelectCombobox } from './multi-select-combobox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Slider } from '../ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { SketchPicker } from 'react-color';

const initialState = {
  success: false,
  qrCodeUrl: null,
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="lg">
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
      Generate QR Code
    </Button>
  );
}

const dataTypes = [
    { value: 'url', label: 'URL', icon: LinkIcon },
    { value: 'text', label: 'Text', icon: Text },
    { value: 'email', label: 'Email', icon: Mail },
    { value: 'phone', label: 'Phone', icon: Phone },
    { value: 'sms', label: 'SMS', icon: MessageSquare },
    { value: 'wifi', label: 'WiFi Network', icon: Wifi },
];

export function QrCodeGenerator({ user }: { user: Omit<User, 'password'> & { _id: string, tags?: Tag[] } }) {
  const [state, formAction] = useActionState(createQrCode, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [dataType, setDataType] = useState('url');
  const [tagIds, setTagIds] = useState<string[]>([]);

  // Config State
  const [dotColor, setDotColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#FFFFFF');
  const [eccLevel, setEccLevel] = useState('L');
  const [logoDataUri, setLogoDataUri] = useState<string | undefined>(undefined);

  // Popover State
  const [dotColorOpen, setDotColorOpen] = useState(false);
  const [bgColorOpen, setBgColorOpen] = useState(false);
  
  const [generatedData, setGeneratedData] = useState<{dataString: string, config: any, logoDataUri?: string} | null>(null);

  useEffect(() => {
    if (state.success && state.qrCodeUrl) {
      toast({ title: 'Success!', description: 'QR Code generated and saved.' });
      setGeneratedData({ 
          dataString: state.dataString || '', 
          config: state.config || {},
          logoDataUri: state.logoDataUri
      });
      formRef.current?.reset();
      setTagIds([]);
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state]);

  const tagOptions = (user.tags || []).map(tag => ({
    value: tag._id,
    label: tag.name,
    color: tag.color,
  }));

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            setLogoDataUri(reader.result as string);
        };
        reader.readAsDataURL(file);
    }
  };
  
  const renderDataFields = () => {
    switch (dataType) {
        case 'text': return <Input name="text" placeholder="Enter text" required />;
        case 'email': return <><Input name="email" type="email" placeholder="Email address" required className="mb-2"/><Input name="emailSubject" placeholder="Subject (optional)" className="mb-2"/><Input name="emailBody" placeholder="Body (optional)"/></>;
        case 'phone': return <Input name="phone" type="tel" placeholder="Phone number" required />;
        case 'sms': return <><Input name="sms" placeholder="Phone number" required className="mb-2"/><Input name="smsMessage" placeholder="Message (optional)"/></>;
        case 'wifi': return <><Input name="wifiSsid" placeholder="Network Name (SSID)" required className="mb-2"/><Input name="wifiPassword" placeholder="Password" required className="mb-2"/><Select name="wifiEncryption"><SelectTrigger><SelectValue placeholder="Encryption Type"/></SelectTrigger><SelectContent><SelectItem value="WPA">WPA/WPA2</SelectItem><SelectItem value="WEP">WEP</SelectItem><SelectItem value="nopass">None</SelectItem></SelectContent></Select></>;
        case 'url': default: return <Input name="url" type="url" placeholder="https://example.com" required />;
    }
  }

  return (
    <>
      <QrCodeDialog
        open={!!generatedData}
        onOpenChange={(open) => !open && setGeneratedData(null)}
        dataString={generatedData?.dataString || null}
        config={generatedData?.config}
        logoDataUri={generatedData?.logoDataUri}
      />
       <form action={formAction} ref={formRef} className="space-y-6">
        <input type="hidden" name="dataType" value={dataType} />
        <input type="hidden" name="tagIds" value={tagIds.join(',')} />
        <input type="hidden" name="config" value={JSON.stringify({ color: dotColor.replace('#',''), bgColor: bgColor.replace('#',''), eccLevel })} />
        <input type="hidden" name="logoDataUri" value={logoDataUri || ''} />

        <Card>
            <CardHeader>
                <CardTitle>QR Code Generator</CardTitle>
                <CardDescription>Create a custom QR code for your business.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" name="name" placeholder="e.g., My Website QR Code" required/>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="type">Data Type</Label>
                    <Select name="type_select" value={dataType} onValueChange={setDataType}>
                        <SelectTrigger id="type">
                            <SelectValue placeholder="Select type..." />
                        </SelectTrigger>
                        <SelectContent>
                            {dataTypes.map(type => (
                                <SelectItem key={type.value} value={type.value}>
                                    <span className="flex items-center"><type.icon className="mr-2 h-4 w-4"/> {type.label}</span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Data</Label>
                    {renderDataFields()}
                </div>
                <div className="space-y-2">
                    <Label>Tags (Optional)</Label>
                     <MultiSelectCombobox options={tagOptions} selected={tagIds} onSelectionChange={setTagIds} placeholder="Select tags..."/>
                </div>
                <Accordion type="single" collapsible>
                    <AccordionItem value="item-1">
                        <AccordionTrigger>Customization Options</AccordionTrigger>
                        <AccordionContent className="pt-4 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Dot Color</Label>
                                    <Popover open={dotColorOpen} onOpenChange={setDotColorOpen}>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="w-full justify-start">
                                                <div className="w-5 h-5 rounded-sm border mr-2" style={{ backgroundColor: dotColor }}/>
                                                {dotColor}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="p-0 border-0" side="right" align="start">
                                            <SketchPicker color={dotColor} onChangeComplete={color => setDotColor(color.hex)} />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="space-y-2">
                                    <Label>Background Color</Label>
                                     <Popover open={bgColorOpen} onOpenChange={setBgColorOpen}>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="w-full justify-start">
                                                <div className="w-5 h-5 rounded-sm border mr-2" style={{ backgroundColor: bgColor }}/>
                                                {bgColor}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="p-0 border-0" side="right" align="start">
                                            <SketchPicker color={bgColor} onChangeComplete={color => setBgColor(color.hex)} />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Error Correction Level</Label>
                                <Select value={eccLevel} onValueChange={setEccLevel}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="L">Low (7%)</SelectItem>
                                        <SelectItem value="M">Medium (15%)</SelectItem>
                                        <SelectItem value="Q">Quartile (25%)</SelectItem>
                                        <SelectItem value="H">High (30%)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="logo">Logo (Optional)</Label>
                                <Input id="logo" type="file" accept="image/png, image/jpeg, image/svg+xml" onChange={handleLogoUpload} />
                                <p className="text-xs text-muted-foreground">Best results with a square image. Max 50KB.</p>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </CardContent>
            <CardFooter>
                <SubmitButton/>
            </CardFooter>
        </Card>
      </form>
    </>
  );
}
