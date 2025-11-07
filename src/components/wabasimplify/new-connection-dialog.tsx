
'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import Image from 'next/image';

interface NewConnectionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  appCategories: { name: string; apps: { name: string; category: string; logo: string }[] }[];
}

export function NewConnectionDialog({ isOpen, onOpenChange, appCategories }: NewConnectionDialogProps) {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredCategories = appCategories.map(category => ({
        ...category,
        apps: category.apps.filter(app => app.name.toLowerCase().includes(searchTerm.toLowerCase()))
    })).filter(category => category.apps.length > 0);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Create a New Connection</DialogTitle>
            <DialogDescription>
              Search for an app to connect to your SabFlow workflows.
            </DialogDescription>
          </DialogHeader>
          <div className="relative flex-shrink-0">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="Search apps..." 
                className="pl-8" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <ScrollArea className="flex-1 -mx-6 px-2">
            <div className="px-4 space-y-6">
                {filteredCategories.map(category => (
                    <div key={category.name}>
                        <h3 className="text-lg font-semibold mb-3">{category.name}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {category.apps.map(app => (
                                <div key={app.name} className="flex items-center gap-4 p-3 border rounded-lg">
                                     <Image src={app.logo} alt={`${app.name} logo`} width={40} height={40} className="rounded-md"/>
                                     <div className="flex-1">
                                        <p className="font-semibold">{app.name}</p>
                                        <p className="text-sm text-muted-foreground">{app.category}</p>
                                     </div>
                                     <Button variant="outline" size="sm" disabled>Connect</Button>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
          </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
