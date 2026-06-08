'use client';

import { Card, CardBody, CardDescription, CardFooter, CardHeader, CardTitle, Button, IconButton, Input, useToast } from '@/components/sabcrm/20ui';
import { useState, useEffect, useActionState } from 'react';
import { handleUpdateUserProfile } from '@/app/actions/index.ts';
import type { User, Tag } from '@/lib/definitions';
import { Tags, Plus, Save, Trash2 } from 'lucide-react';
import { useFormStatus } from 'react-dom';

const updateTagsInitialState: any = { message: null, error: null };

interface TagsSettingsTabProps {
  user: Omit<User, 'password'> & { _id: string; tags?: Tag[] };
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} disabled={pending} iconLeft={Save}>
      Save tags
    </Button>
  );
}

export function TagsSettingsTab({ user }: TagsSettingsTabProps) {
  const { toast } = useToast();
  const [tags, setTags] = useState<Tag[]>([]);
  const [state, formAction] = useActionState(handleUpdateUserProfile, updateTagsInitialState);

  useEffect(() => {
    setTags(JSON.parse(JSON.stringify(user.tags || [])));
  }, [user.tags]);

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Tags saved', description: state.message, tone: 'success' });
    }
    if (state.error) {
      toast({ title: 'Could not save tags', description: state.error, tone: 'danger' });
    }
  }, [state, toast]);

  const handleAddTag = () => {
    setTags((prev) => [
      ...prev,
      { _id: `temp_${Date.now()}`, name: '', color: '#CCCCCC' },
    ]);
  };

  const handleTagChange = (id: string, field: 'name' | 'color', value: string) => {
    setTags((prev) => prev.map((tag) => (tag._id === id ? { ...tag, [field]: value } : tag)));
  };

  const handleRemoveTag = (id: string) => {
    setTags((prev) => prev.filter((tag) => tag._id !== id));
  };

  return (
    <form action={formAction}>
      <input type="hidden" name="name" value={user.name} />
      <input
        type="hidden"
        name="tags"
        value={JSON.stringify(
          tags
            .map((t) => ({ name: t.name, color: t.color }))
            .filter((t) => t.name.trim()),
        )}
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tags className="h-5 w-5" aria-hidden="true" /> Tags
          </CardTitle>
          <CardDescription>
            Create colored tags to organize your short links and QR codes.
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-4">
          {tags.length > 0 ? (
            <div className="grid grid-cols-[1fr,auto,auto] items-center gap-2 px-2 pb-2 border-b border-[var(--st-border)] font-medium text-[11px] uppercase tracking-wider text-[var(--st-text-secondary)]">
              <span>Tag name</span>
              <span className="text-center">Color</span>
              <span className="w-10" aria-hidden="true" />
            </div>
          ) : null}
          <div className="space-y-2">
            {tags.map((tag) => (
              <div key={tag._id} className="grid grid-cols-[1fr,auto,auto] items-center gap-2">
                <Input
                  value={tag.name}
                  onChange={(e) => handleTagChange(tag._id, 'name', e.target.value)}
                  placeholder="e.g. Newsletter, Q3 campaign"
                  aria-label="Tag name"
                />
                <Input
                  type="color"
                  value={tag.color}
                  onChange={(e) => handleTagChange(tag._id, 'color', e.target.value)}
                  className="h-9 w-14 p-1"
                  aria-label="Tag color"
                />
                <IconButton
                  type="button"
                  variant="ghost"
                  icon={Trash2}
                  onClick={() => handleRemoveTag(tag._id)}
                  label="Remove tag"
                />
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" block onClick={handleAddTag} iconLeft={Plus}>
            Add tag
          </Button>
        </CardBody>
        <CardFooter>
          <SaveButton />
        </CardFooter>
      </Card>
    </form>
  );
}
