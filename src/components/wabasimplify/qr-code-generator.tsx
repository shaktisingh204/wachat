
'use client';

import { useState, useMemo, useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SketchPicker } from 'react-color';
import QRCode from 'react-qr-code';
import { QrCode, Link as LinkIcon, Edit, Download, LoaderCircle, Save } from 'lucide-react';
import type { WithId, User, ShortUrl, QrCode as QrCodeType } from '@/lib/definitions';
import { getShortUrls, createShortUrl } from '@/app/actions/url-shortener.actions';
import { saveQrCode } from '@/app/actions/qr-code.actions';
import { useToast } from '@/hooks/use-toast';
import { QrCodeDialog } from './qr-code-dialog';

const initialState = {
  message: null,
  error: null,
};

const ColorPicker = ({ label, color, onChange, isOpen, onOpenChange }: { label: string, color: string, onChange: (color: string) => void, isOpen: boolean, onOpenChange: (open: boolean) => void }) => {
  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <div className="space-y-2">
          <Label>{label}</Label>
          <div className="w-full h-10 rounded-md border border-input flex items-center px-3 cursor-pointer">
            <div className="w-6 h-6 rounded-sm border" style={{ backgroundColor: `#${color}` }}></div>
            <span className="ml-2 text-sm">#{color}</span>
          </div>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <SketchPicker color={`#${color}`} onChangeComplete={(c) => onChange(c.hex.replace('#', ''))} />
      </PopoverContent>
    </Popover>
  );
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save QR Code
    </Button>
  );
}

export function QrCodeGenerator({ user }: { user: WithId<User> }) {
  const [state, formAction] = useActionState(saveQrCode, initialState);
  const { toast } = useToast();
  const [dataType, setDataType] = useState<QrCodeType['dataType']>('url');
  const [data, setData] = useState<any>({});
  const [config, setConfig] = useState({
    color: '000000',
    bgColor: 'FFFFFF',
    eccLevel: 'L',
    size: 256,
  });
  const [name, setName] = useState('');
  const [shortUrlId, setShortUrlId] = useState<string | null>(null);
  const [logoDataUri, setLogoDataUri] = useState<string | null>(null);
  const [openPicker, setOpenPicker] = useState<'dot' | 'bg' | null>(null);
  const [showQrCode, setShowQrCode] = useState(false);

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Success', description: 'QR Code saved.' });
    }
    if (state?.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast]);

  const handleConfigChange = (key: keyof typeof config, value: string | number) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleDataChange = (key: string, value: string) => {
    setData((prev: any) => ({ ...prev, [key]: value }));
  };

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

  const renderDataFields = () => {
    switch(dataType) {
        case 'url': return <div className="space-y-2"><Label>URL</Label><Input placeholder="https://example.com" value={data.url || ''} onChange={(e) => handleDataChange('url', e.target.value)} required /></div>;
        case 'text': return <div className="space-y-2"><Label>Text</Label><Textarea placeholder="Enter your text" value={data.text || ''} onChange={(e) => handleDataChange('text', e.target.value)} required /></div>;
        case 'email': return <div className="space-y-4"><div className="space-y-2"><Label>Email Address</Label><Input type="email" value={data.email || ''} onChange={(e) => handleDataChange('email', e.target.value)} /></div><div className="space-y-2"><Label>Subject</Label><Input value={data.emailSubject || ''} onChange={(e) => handleDataChange('emailSubject', e.target.value)} /></div><div className="space-y-2"><Label>Body</Label><Textarea value={data.emailBody || ''} onChange={(e) => handleDataChange('emailBody', e.target.value)} /></div></div>;
        case 'phone': return <div className="space-y-2"><Label>Phone Number</Label><Input type="tel" value={data.phone || ''} onChange={(e) => handleDataChange('phone', e.target.value)} /></div>;
        case 'sms': return <div className="space-y-4"><div className="space-y-2"><Label>Phone Number</Label><Input type="tel" value={data.sms || ''} onChange={(e) => handleDataChange('sms', e.target.value)} /></div><div className="space-y-2"><Label>Message</Label><Textarea value={data.smsMessage || ''} onChange={(e) => handleDataChange('smsMessage', e.target.value)} /></div></div>;
        case 'wifi': return <div className="space-y-4"><div className="space-y-2"><Label>Network Name (SSID)</Label><Input value={data.wifiSsid || ''} onChange={(e) => handleDataChange('wifiSsid', e.target.value)} /></div><div className="space-y-2"><Label>Password</Label><Input type="password" value={data.wifiPassword || ''} onChange={(e) => handleDataChange('wifiPassword', e.target.value)} /></div><div className="space-y-2"><Label>Encryption</Label><Select defaultValue="WPA" onValueChange={(val) => handleDataChange('wifiEncryption', val)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="WPA">WPA/WPA2</SelectItem><SelectItem value="WEP">WEP</SelectItem><SelectItem value="nopass">None</SelectItem></SelectContent></Select></div></div>;
        default: return null;
    }
  }

  return (
    <div className="grid lg:grid-cols-3 gap-8 items-start">
        <QrCodeDialog open={showQrCode} onOpenChange={setShowQrCode} dataString={dataString} config={config} logoDataUri={logoDataUri}/>
      <form action={formAction} className="lg:col-span-2 space-y-6">
        <input type="hidden" name="dataType" value={dataType} />
        <input type="hidden" name="data" value={JSON.stringify(data)} />
        <input type="hidden" name="config" value={JSON.stringify(config)} />
        <input type="hidden" name="shortUrlId" value={shortUrlId || ''} />
        <input type="hidden" name="logoDataUri" value={logoDataUri || ''} />
        
        <Card className="card-gradient card-gradient-orange">
          <CardHeader>
            <CardTitle>QR Code Generator</CardTitle>
            <CardDescription>Create a custom QR code for your business.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., My Website Link" required />
            </div>
            <div className="space-y-2">
              <Label>Data Type</Label>
              <Select value={dataType} onValueChange={(val) => setDataType(val as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="url">URL</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="phone">Phone Number</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="wifi">WiFi Network</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {renderDataFields()}
          </CardContent>
          <CardFooter>
            <SubmitButton />
          </CardFooter>
        </Card>
      </form>
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Customize</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
              <ColorPicker
                label="Dot Color"
                color={config.color}
                onChange={(c) => handleConfigChange('color', c)}
                isOpen={openPicker === 'dot'}
                onOpenChange={(open) => setOpenPicker(open ? 'dot' : null)}
              />
              <ColorPicker
                label="Background Color"
                color={config.bgColor}
                onChange={(c) => handleConfigChange('bgColor', c)}
                isOpen={openPicker === 'bg'}
                onOpenChange={(open) => setOpenPicker(open ? 'bg' : null)}
              />
          </div>
           <div className="space-y-2">
              <Label>Error Correction</Label>
              <Select value={config.eccLevel} onValueChange={(val) => handleConfigChange('eccLevel', val)}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                      <SelectItem value="L">Low (L)</SelectItem>
                      <SelectItem value="M">Medium (M)</SelectItem>
                      <SelectItem value="Q">Quartile (Q)</SelectItem>
                      <SelectItem value="H">High (H)</SelectItem>
                  </SelectContent>
              </Select>
          </div>
           <div className="space-y-2">
              <Label htmlFor="logo">Logo</Label>
              <Input id="logo" name="logo" type="file" accept="image/*" onChange={handleLogoUpload} />
          </div>
          <Button onClick={() => setShowQrCode(true)} variant="secondary" className="w-full">Preview & Download</Button>
        </CardContent>
      </Card>
    </div>
  );
}
