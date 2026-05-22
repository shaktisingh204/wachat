'use client';

import {
  Badge,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
  Button,
  Dialog,
  ZoruDialogContent,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogDescription,
} from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';
import { Languages, Edit, FilePlus2, ShoppingCart, View, FileText } from 'lucide-react';

import React, { useState } from 'react';

import type { WithId } from 'mongodb';
import type { Template } from '@/lib/definitions';
import { cn } from '@/lib/utils';

interface TemplateCardProps {
  template: WithId<Template>;
  gradientClass?: string;
}

export const TemplateCard = React.memo(function TemplateCard({ template, gradientClass = 'card-gradient-green' }: TemplateCardProps) {
  const router = useRouter();
  const [isViewOpen, setIsViewOpen] = useState(false);

  const getStatusVariant = (status: string) => {
    if (!status) return 'secondary';
    status = status.toLowerCase();
    if (status === 'approved') return 'default';
    if (status === 'pending' || status === 'in_review') return 'secondary';
    return 'destructive';
  };

  const getQualityVariant = (quality?: string) => {
    if (!quality) return 'secondary';
    quality = quality.toLowerCase();
    if (quality === 'green') return 'default';
    if (quality === 'yellow') return 'secondary';
    return 'destructive';
  };

  const handleAction = (action: 'edit' | 'clone') => {
    localStorage.setItem('templateToAction', JSON.stringify(template));
    router.push(`/wachat/templates/create?action=${action}`);
  };

  const renderComponentContent = (component: any) => {
    if (component.type === 'CAROUSEL' && Array.isArray(component.cards)) {
      return `Contains ${component.cards.length} card(s).`;
    }
    if (component.text) return component.text;
    if (component.format) return `Format: ${component.format}`;
    if (component.type === 'CATALOG_MESSAGE_ACTION') {
      return `Catalog ID: ${component.catalogId}\nSections: ${component.sections?.length || 0}`;
    }
    if (component.buttons && Array.isArray(component.buttons)) {
      return (
        <ul className="list-disc pl-5 space-y-1">
          {component.buttons.map((button: any, index: number) => (
            <li key={index}>
              <strong>{button.text}</strong> ({button.type.replace(/_/g, ' ')})
              {button.url && <span className="block text-xs text-muted-foreground">{button.url}</span>}
              {button.phone_number && <span className="block text-xs text-muted-foreground">Call: {button.phone_number}</span>}
            </li>
          ))}
        </ul>
      );
    }
    return "No text content";
  };

  const isMarketingCarousel = template.type === 'MARKETING_CAROUSEL';
  const isProductCarousel = template.type === 'CATALOG_MESSAGE';

  return (
    <>
      <ZoruCard className={cn("flex flex-col transition-transform hover:-translate-y-1", gradientClass)}>
        <ZoruCardHeader>
          <div className="flex items-start justify-between gap-2">
            <ZoruCardTitle className="text-lg font-headline break-all">{template.name}</ZoruCardTitle>
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              {isProductCarousel ? (
                <ZoruBadge variant="secondary" className="capitalize">
                  <ShoppingCart className="mr-2 h-3 w-3" />
                  Product Catalog
                </ZoruBadge>
              ) : isMarketingCarousel ? (
                <ZoruBadge variant="secondary" className="capitalize">
                  <View className="mr-2 h-3 w-3" />
                  Marketing Carousel
                </ZoruBadge>
              ) : null}

              <ZoruBadge variant={getStatusVariant(template.status)} className="capitalize">
                {template.status?.replace(/_/g, ' ') || 'Unknown'}
              </ZoruBadge>
              {template.qualityScore && template.qualityScore !== 'UNKNOWN' && (
                <ZoruBadge variant={getQualityVariant(template.qualityScore)} className="capitalize">
                  Quality: {template.qualityScore.toLowerCase()}
                </ZoruBadge>
              )}
            </div>
            {(template as any).rejectedReason && (template.status?.toUpperCase() === 'REJECTED' || template.status?.toUpperCase() === 'DISABLED') && (
              <p className="text-xs text-destructive mt-1">Reason: {(template as any).rejectedReason}</p>
            )}
          </div>
          <ZoruCardDescription className="flex items-center pt-2 text-xs">
            {isProductCarousel ? (
              <ShoppingCart className="h-4 w-4 mr-2" />
            ) : isMarketingCarousel ? (
              <View className="h-4 w-4 mr-2" />
            ) : (
              <FileText className="h-4 w-4 mr-2" />
            )}

            {isProductCarousel ? 'Interactive Product Message' : isMarketingCarousel ? 'Marketing Carousel' : `Category: ${template.category}`}
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="flex-grow">
          <p className="text-sm text-foreground/80 line-clamp-4">{template.body || template.components?.find(c => c.type === 'BODY')?.text}</p>
        </ZoruCardContent>
        <ZoruCardFooter className="flex justify-end gap-2 mt-auto">
          <ZoruButton variant="ghost" onClick={() => setIsViewOpen(true)}>View</ZoruButton>
          <ZoruButton variant="outline" onClick={() => handleAction('clone')}>
            <FilePlus2 className="mr-2 h-4 w-4" />
            Clone
          </ZoruButton>
          <ZoruButton variant="secondary" onClick={() => handleAction('edit')}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </ZoruButton>
        </ZoruCardFooter>
      </ZoruCard>

      <ZoruDialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <ZoruDialogContent className="sm:max-w-2xl">
          <ZoruDialogHeader>
            <ZoruDialogTitle>{template.name}</ZoruDialogTitle>
            <ZoruDialogDescription>
              Category: {template.category} | {isProductCarousel ? `Type: ${template.type}` : `Language: ${template.language}`} | Status: <span className="capitalize">{template.status?.replace(/_/g, ' ') || 'Unknown'}</span>
              {!isProductCarousel && !isMarketingCarousel && template.qualityScore && template.qualityScore !== 'UNKNOWN' && (
                <> | Quality: <span className="capitalize">{template.qualityScore.toLowerCase()}</span></>
              )}
              {(template as any).rejectedReason && (
                <><br /><span className="text-destructive">Rejection reason: {(template as any).rejectedReason}</span></>
              )}
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="mt-4 space-y-4 max-h-[60vh] overflow-y-auto pr-4">
            {(Array.isArray(template.components) && template.components.length > 0) ? (
              template.components.map((component, index) => (
                <div key={index} className="space-y-2">
                  <h4 className="font-semibold text-primary">{component.type}</h4>
                  <div className="p-4 rounded-md bg-muted/50 text-sm whitespace-pre-wrap font-mono">
                    {renderComponentContent(component)}
                  </div>
                </div>
              ))
            ) : (
              <div className="space-y-2">
                <h4 className="font-semibold text-primary">BODY</h4>
                <div className="p-4 rounded-md bg-muted/50 text-sm whitespace-pre-wrap font-mono">
                  {template.body}
                </div>
              </div>
            )}
          </div>
        </ZoruDialogContent>
      </ZoruDialog>
    </>
  );
});
