
'use client';

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';

interface EditorProps {
  node: any;
  onUpdate: (data: any) => void;
}

export function ImageEditor({ node, onUpdate }: EditorProps) {
    const [mediaSource, setMediaSource] = useState(node.data.imageBase64 ? 'upload' : 'url');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                onUpdate({ ...node.data, imageBase64: reader.result as string, imageUrl: '' });
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="space-y-4">
             <RadioGroup value={mediaSource} onValueChange={(v) => setMediaSource(v as any)} className="flex gap-4">
                <div className="flex items-center space-x-2"><RadioGroupItem value="url" id="img-url" /><Label htmlFor="img-url">From URL</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="upload" id="img-upload" /><Label htmlFor="img-upload">Upload</Label></div>
            </RadioGroup>
            {mediaSource === 'url' ? (
                <div className="space-y-2">
                    <Label htmlFor="image-url">Image URL</Label>
                    <Input id="image-url" placeholder="https://example.com/image.png" value={node.data.imageUrl || ''} onChange={(e) => onUpdate({ ...node.data, imageUrl: e.target.value, imageBase64: null })} />
                </div>
            ) : (
                 <div className="space-y-2">
                    <Label htmlFor="image-file">Upload Image</Label>
                    <Input id="image-file" type="file" accept="image/*" onChange={handleFileChange} />
                </div>
            )}
            <div className="space-y-2">
                <Label htmlFor="image-caption">Caption (Optional)</Label>
                <Textarea id="image-caption" placeholder="A caption for your image..." value={node.data.caption || ''} onChange={(e) => onUpdate({ ...node.data, caption: e.target.value })} />
            </div>
        </div>
    );
}
