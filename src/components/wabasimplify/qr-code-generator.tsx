
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Download, QrCode, Link, Type, Mail, Phone, MessageSquare, Wifi, Upload } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '../ui/separator';
import { BulkCreateQrDialog } from './bulk-qr-create-dialog';

type QrDataType = 'url' | 'text' | 'email' | 'phone' | 'sms' | 'wifi';

export function QrCodeGenerator() {
    const [activeTab, setActiveTab] = useState<QrDataType>('url');
    const [formData, setFormData] = useState({
        url: 'https://wachat.com',
        text: 'Hello, World!',
        email: '',
        emailSubject: '',
        emailBody: '',
        phone: '',
        sms: '',
        smsMessage: '',
        wifiSsid: '',
        wifiPassword: '',
        wifiEncryption: 'WPA',
    });

    const [qrConfig, setQrConfig] = useState({
        color: '000000',
        bgColor: 'FFFFFF',
        eccLevel: 'L', // L, M, Q, H
        size: 250,
    });

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSelectChange = (name: string, value: string) => {
         setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setQrConfig(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleColorChange = (name: 'color' | 'bgColor', value: string) => {
        setQrConfig(prev => ({...prev, [name]: value.substring(1)}));
    }

    const qrDataString = useMemo(() => {
        switch (activeTab) {
            case 'url':
                return formData.url;
            case 'text':
                return formData.text;
            case 'email':
                return `mailto:${formData.email}?subject=${encodeURIComponent(formData.emailSubject)}&body=${encodeURIComponent(formData.emailBody)}`;
            case 'phone':
                return `tel:${formData.phone}`;
            case 'sms':
                return `smsto:${formData.sms}:${encodeURIComponent(formData.smsMessage)}`;
            case 'wifi':
                return `WIFI:T:${formData.wifiEncryption};S:${formData.wifiSsid};P:${formData.wifiPassword};;`;
            default:
                return '';
        }
    }, [activeTab, formData]);

    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${qrConfig.size}x${qrConfig.size}&data=${encodeURIComponent(qrDataString)}&color=${qrConfig.color}&bgcolor=${qrConfig.bgColor}&ecc=${qrConfig.eccLevel}`;

    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = qrApiUrl;
        link.download = `qrcode-${activeTab}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const renderInputFields = () => {
        switch (activeTab) {
            case 'url': return <div className="space-y-2"><Label htmlFor="url">URL</Label><Input id="url" name="url" value={formData.url} onChange={handleFormChange} placeholder="https://example.com" /></div>;
            case 'text': return <div className="space-y-2"><Label htmlFor="text">Text</Label><Textarea id="text" name="text" value={formData.text} onChange={handleFormChange} placeholder="Enter any text" /></div>;
            case 'email': return <div className="space-y-4"><div className="space-y-2"><Label htmlFor="email">Email Address</Label><Input id="email" name="email" type="email" value={formData.email} onChange={handleFormChange} placeholder="recipient@example.com" /></div><div className="space-y-2"><Label htmlFor="emailSubject">Subject</Label><Input id="emailSubject" name="emailSubject" value={formData.emailSubject} onChange={handleFormChange} placeholder="Email Subject" /></div><div className="space-y-2"><Label htmlFor="emailBody">Body</Label><Textarea id="emailBody" name="emailBody" value={formData.emailBody} onChange={handleFormChange} placeholder="Email Body" /></div></div>;
            case 'phone': return <div className="space-y-2"><Label htmlFor="phone">Phone Number</Label><Input id="phone" name="phone" type="tel" value={formData.phone} onChange={handleFormChange} placeholder="+15551234567" /></div>;
            case 'sms': return <div className="space-y-4"><div className="space-y-2"><Label htmlFor="sms">Phone Number</Label><Input id="sms" name="sms" type="tel" value={formData.sms} onChange={handleFormChange} placeholder="+15551234567" /></div><div className="space-y-2"><Label htmlFor="smsMessage">Message</Label><Textarea id="smsMessage" name="smsMessage" value={formData.smsMessage} onChange={handleFormChange} placeholder="Your SMS message" /></div></div>;
            case 'wifi': return <div className="space-y-4"><div className="space-y-2"><Label htmlFor="wifiSsid">Network Name (SSID)</Label><Input id="wifiSsid" name="wifiSsid" value={formData.wifiSsid} onChange={handleFormChange} placeholder="My Home WiFi" /></div><div className="space-y-2"><Label htmlFor="wifiPassword">Password</Label><Input id="wifiPassword" name="wifiPassword" type="password" value={formData.wifiPassword} onChange={handleFormChange} /></div><div className="space-y-2"><Label htmlFor="wifiEncryption">Encryption</Label><Select name="wifiEncryption" value={formData.wifiEncryption} onValueChange={(val) => handleSelectChange('wifiEncryption', val)}><SelectTrigger id="wifiEncryption"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="WPA">WPA/WPA2</SelectItem><SelectItem value="WEP">WEP</SelectItem><SelectItem value="nopass">None</SelectItem></SelectContent></Select></div></div>;
            default: return null;
        }
    }

    return (
        <Card className="card-gradient card-gradient-green">
            <CardHeader>
                <CardTitle>Generate a QR Code</CardTitle>
                <CardDescription>Select a content type and enter your data to create a scannable QR code.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid md:grid-cols-2 gap-8 items-start">
                    <div className="space-y-4">
                        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as QrDataType)} className="w-full">
                            <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 h-auto">
                                <TabsTrigger value="url"><Link className="h-5 w-5 mx-auto"/>URL</TabsTrigger>
                                <TabsTrigger value="text"><Type className="h-5 w-5 mx-auto"/>Text</TabsTrigger>
                                <TabsTrigger value="email"><Mail className="h-5 w-5 mx-auto"/>Email</TabsTrigger>
                                <TabsTrigger value="phone"><Phone className="h-5 w-5 mx-auto"/>Phone</TabsTrigger>
                                <TabsTrigger value="sms"><MessageSquare className="h-5 w-5 mx-auto"/>SMS</TabsTrigger>
                                <TabsTrigger value="wifi"><Wifi className="h-5 w-5 mx-auto"/>Wi-Fi</TabsTrigger>
                            </TabsList>
                            <TabsContent value={activeTab} className="mt-4">{renderInputFields()}</TabsContent>
                        </Tabs>
                         <Separator />
                         <div className="space-y-4">
                            <h3 className="font-medium text-lg">Customization</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1"><Label htmlFor="color" className="text-sm">Dot Color</Label><Input id="color" type="color" value={`#${qrConfig.color}`} onChange={(e) => handleColorChange('color', e.target.value)} /></div>
                                <div className="space-y-1"><Label htmlFor="bgColor" className="text-sm">Background Color</Label><Input id="bgColor" type="color" value={`#${qrConfig.bgColor}`} onChange={(e) => handleColorChange('bgColor', e.target.value)} /></div>
                                <div className="space-y-1"><Label htmlFor="size" className="text-sm">Size (px)</Label><Input id="size" name="size" type="number" min="50" max="1000" value={qrConfig.size} onChange={handleConfigChange} /></div>
                                <div className="space-y-1"><Label htmlFor="eccLevel" className="text-sm">Error Correction</Label><Select name="eccLevel" value={qrConfig.eccLevel} onValueChange={(val) => setQrConfig(p => ({...p, eccLevel: val}))}><SelectTrigger id="eccLevel"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="L">Low (L)</SelectItem><SelectItem value="M">Medium (M)</SelectItem><SelectItem value="Q">Quartile (Q)</SelectItem><SelectItem value="H">High (H)</SelectItem></SelectContent></Select></div>
                            </div>
                         </div>
                    </div>
                    <div className="flex flex-col items-center justify-center space-y-4">
                        <div className="p-4 bg-white rounded-lg aspect-square w-full max-w-xs mx-auto">
                            {qrDataString.trim() ? (
                                <Image src={qrApiUrl} alt="Generated QR Code" width={250} height={250} data-ai-hint="qr code" />
                            ) : (
                                <div className="flex flex-col items-center justify-center text-muted-foreground text-center gap-2 h-full">
                                    <QrCode className="h-16 w-16" />
                                    <p>Enter data to generate a QR code</p>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2 w-full max-w-xs">
                             <Button onClick={handleDownload} disabled={!qrDataString.trim()} className="w-full">
                                <Download className="mr-2 h-4 w-4" /> Download PNG
                            </Button>
                            <BulkCreateQrDialog />
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
