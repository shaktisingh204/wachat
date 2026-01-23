
'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { HexColorPicker } from 'react-colorful';
import { LoaderCircle, Save, QrCode, Upload, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { saveQrCode } from '@/app/actions/qr-code.actions';
import type { User, Tag } from '@/lib/definitions';
import QRCode from 'react-qr-code';
import { MultiSelectCombobox } from './multi-select-combobox';
import { QrCodeDialog } from './qr-code-dialog';
import Image from 'next/image';

const initialState = {
  message: null,
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save QR Code
    </Button>
  );
}

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
    });
};

export function QrCodeGenerator({ user }: { user: (Omit<User, 'password'> & { _id: string, tags?: Tag[] }) }) {
  const [state, formAction] = useActionState(saveQrCode, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  
  const [name, setName] = useState('');
  const [dataType, setDataType] = useState<string>('url');
  const [data, setData] = useState<any>({});
  const [config, setConfig] = useState({ color: '#000000', bgColor: '#FFFFFF', eccLevel: 'L' });
  const [logo, setLogo] = useState<File | null>(null);
  const [logoDataUri, setLogoDataUri] = useState<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [isFgColorOpen, setIsFgColorOpen] = useState(false);
  const [isBgColorOpen, setIsBgColorOpen] = useState(false);

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success!', description: state.message });
      formRef.current?.reset();
      setName('');
      setData({});
      setLogo(null);
      setLogoDataUri(null);
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast]);

  const handleDataChange = (field: string, value: string) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const handleConfigChange = (field: string, value: string) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoChange = async (file: File | null) => {
    setLogo(file);
    if (file) {
      const uri = await fileToBase64(file);
      setLogoDataUri(uri);
    } else {
      setLogoDataUri(null);
    }
  };

  const dataString = useMemo(() => {
    switch (dataType) {
        case 'url': return data.url || '';
        case 'text': return data.text || '';
        case 'email': return `mailto:${data.email || ''}?subject=${encodeURIComponent(data.emailSubject || '')}&body=${encodeURIComponent(data.emailBody || '')}`;
        case 'phone': return `tel:${data.phone || ''}`;
        case 'sms': return `smsto:${data.sms || ''}:${encodeURIComponent(data.smsMessage || '')}`;
        case 'wifi': return `WIFI:T:${data.wifiEncryption || 'WPA'};S:${data.wifiSsid || ''};P:${data.wifiPassword || ''};;`;
        default: return '';
    }
  }, [dataType, data]);
  
  const tagOptions = (user.tags || []).map(tag => ({ value: tag._id.toString(), label: tag.name, color: tag.color }));

  const renderDataFields = () => {
    switch(dataType) {
      case 'url': return <div className="space-y-2"><Label>URL</Label><Input value={data.url || ''} onChange={e => handleDataChange('url', e.target.value)} placeholder="https://example.com"/></div>;
      case 'text': return <div className="space-y-2"><Label>Text</Label><Textarea value={data.text || ''} onChange={e => handleDataChange('text', e.target.value)} placeholder="Enter any text"/></div>;
      case 'email': return <div className="space-y-4"><div className="space-y-2"><Label>Email Address</Label><Input type="email" value={data.email || ''} onChange={e => handleDataChange('email', e.target.value)} placeholder="recipient@example.com"/></div><div className="space-y-2"><Label>Subject</Label><Input value={data.emailSubject || ''} onChange={e => handleDataChange('emailSubject', e.target.value)}/></div><div className="space-y-2"><Label>Body</Label><Textarea value={data.emailBody || ''} onChange={e => handleDataChange('emailBody', e.target.value)}/></div></div>;
      case 'phone': return <div className="space-y-2"><Label>Phone Number</Label><Input type="tel" value={data.phone || ''} onChange={e => handleDataChange('phone', e.target.value)} /></div>;
      case 'sms': return <div className="space-y-4"><div className="space-y-2"><Label>Phone Number</Label><Input type="tel" value={data.sms || ''} onChange={e => handleDataChange('sms', e.target.value)} /></div><div className="space-y-2"><Label>Message</Label><Textarea value={data.smsMessage || ''} onChange={e => handleDataChange('smsMessage', e.target.value)} /></div></div>;
      case 'wifi': return <div className="space-y-4"><div className="space-y-2"><Label>Network Name (SSID)</Label><Input value={data.wifiSsid || ''} onChange={e => handleDataChange('wifiSsid', e.target.value)} /></div><div className="space-y-2"><Label>Password</Label><Input type="password" value={data.wifiPassword || ''} onChange={e => handleDataChange('wifiPassword', e.target.value)} /></div><div className="space-y-2"><Label>Encryption</Label><Select value={data.wifiEncryption || 'WPA'} onValueChange={v => handleDataChange('wifiEncryption', v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="WPA">WPA/WPA2</SelectItem><SelectItem value="WEP">WEP</SelectItem><SelectItem value="nopass">None</SelectItem></SelectContent></Select></div></div>;
      default: return null;
    }
  };

  return (
    <>
      <QrCodeDialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen} dataString={dataString} config={config} logoDataUri={logoDataUri} />
      <div className="grid lg:grid-cols-3 gap-8 items-start">
        <form action={formAction} ref={formRef} className="lg:col-span-2">
            <input type="hidden" name="data" value={JSON.stringify(data)} />
            <input type="hidden" name="dataType" value={dataType} />
            <input type="hidden" name="config" value={JSON.stringify(config)} />
            <input type="hidden" name="tags" value={selectedTagIds.join(',')} />
            {logoDataUri && <input type="hidden" name="logoDataUri" value={logoDataUri} />}

            <Card className="card-gradient card-gradient-orange">
                 <CardHeader>
                    <CardTitle className="flex items-center gap-3"><QrCode className="h-8 w-8"/>QR Code Maker</CardTitle>
                    <CardDescription>Generate a custom QR code for your business needs.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label>Content Type</Label>
                        <Select value={dataType} onValueChange={setDataType}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="url">URL</SelectItem><SelectItem value="text">Text</SelectItem><SelectItem value="email">Email</SelectItem><SelectItem value="phone">Phone</SelectItem><SelectItem value="sms">SMS</SelectItem><SelectItem value="wifi">Wi-Fi</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {renderDataFields()}

                    <Separator />
                    <Accordion type="multiple">
                        <AccordionItem value="item-1">
                            <AccordionTrigger>Customization</AccordionTrigger>
                            <AccordionContent className="pt-4 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Dot Color</Label>
                                        <Popover open={isFgColorOpen} onOpenChange={setIsFgColorOpen}>
                                            <PopoverTrigger asChild><Button variant="outline" className="w-full justify-start"><div className="w-5 h-5 rounded-sm border mr-2" style={{backgroundColor: config.color}}/>{config.color}</Button></PopoverTrigger>
                                            <PopoverContent className="p-0"><HexColorPicker color={config.color} onChange={val => handleConfigChange('color', val)} /></PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Background Color</Label>
                                        <Popover open={isBgColorOpen} onOpenChange={setIsBgColorOpen}>
                                            <PopoverTrigger asChild><Button variant="outline" className="w-full justify-start"><div className="w-5 h-5 rounded-sm border mr-2" style={{backgroundColor: config.bgColor}}/>{config.bgColor}</Button></PopoverTrigger>
                                            <PopoverContent className="p-0"><HexColorPicker color={config.bgColor} onChange={val => handleConfigChange('bgColor', val)} /></PopoverContent>
                                        </Popover>
                                    </div>
                                </div>
                                 <div className="space-y-2">
                                    <Label>Error Correction Level</Label>
                                    <Select value={config.eccLevel} onValueChange={v => handleConfigChange('eccLevel', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="L">Low (7%)</SelectItem><SelectItem value="M">Medium (15%)</SelectItem><SelectItem value="Q">Quartile (25%)</SelectItem><SelectItem value="H">High (30%)</SelectItem></SelectContent></Select>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-2">
                            <AccordionTrigger>Logo (Optional)</AccordionTrigger>
                            <AccordionContent className="pt-4 space-y-4">
                                <Input type="file" accept="image/png, image/jpeg" onChange={e => handleLogoChange(e.target.files?.[0] || null)} />
                                <p className="text-xs text-muted-foreground">For best results, use a square PNG with a transparent background.</p>
                                {logoDataUri && <Button variant="outline" size="sm" onClick={() => handleLogoChange(null)}>Remove Logo</Button>}
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                    <Separator />
                    <div className="space-y-4">
                         <div className="space-y-2">
                            <Label htmlFor="name">Save As (Name)</Label>
                            <Input id="name" name="name" placeholder="e.g., My Website QR" value={name} onChange={e => setName(e.target.value)} required/>
                        </div>
                        <div className="space-y-2">
                            <Label>Tags (Optional)</Label>
                            <MultiSelectCombobox 
                                options={tagOptions} 
                                selected={selectedTagIds} 
                                onSelectionChange={setSelectedTagIds} 
                                placeholder="Assign tags..."
                            />
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="gap-2">
                    <SubmitButton />
                     <Button type="button" variant="secondary" onClick={() => setIsPreviewDialogOpen(true)} disabled={!dataString}>Preview & Download</Button>
                </CardFooter>
            </form>
        </Card>
        <div className="lg:col-span-1">
            <Card>
                <CardHeader>
                    <CardTitle>Live Preview</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center p-4">
                    {dataString ? (
                        <div className="p-4 bg-white rounded-lg">
                            <QRCode
                                value={dataString}
                                size={200}
                                fgColor={config.color}
                                bgColor={config.bgColor}
                                level={config.eccLevel as any}
                                imageSettings={logoDataUri ? { src: logoDataUri, height: 40, width: 40, excavate: true } : undefined}
                            />
                        </div>
                    ) : (
                        <div className="h-[232px] w-[232px] bg-muted flex items-center justify-center text-muted-foreground text-center text-sm p-4 rounded-lg">
                            Enter some data to generate a preview.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
      </div>
    </>
  );
}

    