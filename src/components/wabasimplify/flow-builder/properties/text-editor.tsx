
'use client';

import { Textarea } from '@/components/ui/textarea';

interface EditorProps {
  node: any;
  onUpdate: (data: any) => void;
}

export function TextEditor({ node, onUpdate }: EditorProps) {
  return (
    <Textarea
      id="text-content"
      placeholder="Enter your message here..."
      value={node.data.text || ''}
      onChange={(e) => onUpdate({ ...node.data, text: e.target.value })}
      className="h-32"
    />
  );
}
