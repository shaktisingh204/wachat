
'use client';

import { useState, useEffect, useRef } from 'react';
import type { FlowNode, FlowEdge } from '@/app/actions';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface TestFlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

type ChatMessage = {
  id: string;
  sender: 'bot' | 'user';
  content: string | React.ReactNode;
};

export function TestFlowDialog({ open, onOpenChange, nodes, edges }: TestFlowDialogProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [variables, setVariables] = useState<Record<string, any>>({});
  const [isWaitingForInput, setIsWaitingForInput] = useState(false);
  const [userInput, setUserInput] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const addMessage = (sender: 'bot' | 'user', content: string | React.ReactNode) => {
    setMessages(prev => [...prev, { id: `msg-${Date.now()}-${Math.random()}`, sender, content }]);
  };

  const findAndExecuteNextNode = useCallback((sourceNodeId: string, sourceHandleId: string) => {
    const edge = edges.find(e => e.source === sourceNodeId && e.sourceHandle === sourceHandleId);
    if (edge) {
      setTimeout(() => executeFlow(edge.target), 500);
    } else {
      setTimeout(() => addMessage('bot', 'Flow ended.'), 500);
      setIsWaitingForInput(false);
    }
  }, [edges]);


  const executeFlow = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) {
      addMessage('bot', 'Flow ended or node not found.');
      setIsWaitingForInput(false);
      return;
    }

    setCurrentNodeId(nodeId);

    switch (node.type) {
      case 'start':
        findAndExecuteNextNode(nodeId, 'output-main');
        break;
      
      case 'text':
        addMessage('bot', node.data.text || '[No text content]');
        findAndExecuteNextNode(nodeId, 'output-main');
        break;
      
      case 'input':
        addMessage('bot', node.data.text || 'Please provide your input:');
        setIsWaitingForInput(true);
        break;
      
      default:
        addMessage('bot', `[Executing ${node.type} node: ${node.data.label}]`);
        findAndExecuteNextNode(nodeId, 'output-main');
        break;
    }
  }, [nodes, findAndExecuteNextNode]);

  const handleUserInput = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || !isWaitingForInput) return;
    
    addMessage('user', userInput);
    
    const currentNode = nodes.find(n => n.id === currentNodeId);
    if (currentNode && currentNode.type === 'input') {
      if (currentNode.data.variableToSave) {
        setVariables(prev => ({ ...prev, [currentNode.data.variableToSave]: userInput }));
      }
      setIsWaitingForInput(false);
      setUserInput('');
      findAndExecuteNextNode(currentNode.id, 'output-main');
    }
  };

  useEffect(() => {
    if (open) {
      setMessages([]);
      setVariables({});
      setIsWaitingForInput(false);
      setUserInput('');
      const startNode = nodes.find(n => n.type === 'start');
      if (startNode) {
        addMessage('bot', 'Starting flow test...');
        setTimeout(() => executeFlow(startNode.id), 500);
      } else {
        addMessage('bot', 'Error: No "Start" node found in the flow.');
      }
    }
  }, [open, nodes, edges, executeFlow]);

  useEffect(() => {
    if(scrollAreaRef.current) {
        scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Test Flow</DialogTitle>
          <DialogDescription>
            Simulate a conversation to test your flow's logic.
          </DialogDescription>
        </DialogHeader>
        <div className="h-[60vh] flex flex-col">
          <ScrollArea className="flex-1 p-4 border rounded-md" ref={scrollAreaRef}>
            <div className="space-y-4">
              {messages.map(msg => (
                <div key={msg.id} className={`flex items-end gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.sender === 'bot' && <Avatar className="h-8 w-8"><AvatarFallback>B</AvatarFallback></Avatar>}
                  <div className={`max-w-xs rounded-lg p-3 text-sm break-words ${msg.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <form onSubmit={handleUserInput} className="mt-4 flex gap-2">
            <Input 
              value={userInput}
              onChange={e => setUserInput(e.target.value)}
              placeholder="Type your message..."
              disabled={!isWaitingForInput}
              autoComplete="off"
            />
            <Button type="submit" disabled={!isWaitingForInput}>Send</Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
