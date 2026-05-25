'use client';

import * as React from 'react';
import { Card, ZoruCardContent, Label, Input, Textarea, Select, ZoruSelectTrigger, ZoruSelectValue, ZoruSelectContent, ZoruSelectItem } from '@/components/zoruui';

type RoadmapStatus = 'draft' | 'active' | 'completed' | 'archived';

interface BasicInfoFormProps {
  title: string;
  setTitle: (val: string) => void;
  description: string;
  setDescription: (val: string) => void;
  status: RoadmapStatus;
  setStatus: (val: RoadmapStatus) => void;
  startDate: string;
  setStartDate: (val: string) => void;
  endDate: string;
  setEndDate: (val: string) => void;
  handleFieldChange: (field: string, value: string) => void;
  error: string | null;
}

export default function BasicInfoForm({
  title, setTitle,
  description, setDescription,
  status, setStatus,
  startDate, setStartDate,
  endDate, setEndDate,
  handleFieldChange,
  error
}: BasicInfoFormProps) {
  return (
    <Card>
      <ZoruCardContent className="flex flex-col gap-4 pt-5">
        <div className="flex flex-col gap-1.5">
          <Label required>Title</Label>
          <Input
            placeholder="e.g. Q3 Product Launch"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              handleFieldChange('title', e.target.value);
            }}
            invalid={error !== null && !title.trim()}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Description</Label>
          <Textarea
            placeholder="What is this roadmap about?"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              handleFieldChange('description', e.target.value);
            }}
            rows={3}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => {
            setStatus(v as RoadmapStatus);
            handleFieldChange('status', v);
          }}>
            <ZoruSelectTrigger>
              <ZoruSelectValue />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              <ZoruSelectItem value="draft">Draft</ZoruSelectItem>
              <ZoruSelectItem value="active">Active</ZoruSelectItem>
              <ZoruSelectItem value="completed">Completed</ZoruSelectItem>
              <ZoruSelectItem value="archived">Archived</ZoruSelectItem>
            </ZoruSelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                handleFieldChange('startDate', e.target.value);
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>End Date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                handleFieldChange('endDate', e.target.value);
              }}
            />
          </div>
        </div>
      </ZoruCardContent>
    </Card>
  );
}
