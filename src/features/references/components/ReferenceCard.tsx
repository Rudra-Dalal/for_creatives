'use client';

import React, { useState } from 'react';
import type { Reference } from '../types';
import { Badge } from '@/components/ui/badge';
import { Globe, FileText, ArrowUpRight } from 'lucide-react';
import Image from 'next/image';

interface ReferenceCardProps {
  reference: Reference;
  isSelected?: boolean;
  onClick: () => void;
}

export function ReferenceCard({
  reference,
  isSelected = false,
  onClick,
}: ReferenceCardProps) {
  const [imageError, setImageError] = useState(false);
  const hasThumbnail = reference.thumbnail_url && !imageError;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`group relative flex flex-col overflow-hidden rounded-lg border bg-surface transition-all duration-200 cursor-pointer select-none text-left focus:outline-none focus:ring-1 focus:ring-accent ${
        isSelected
          ? 'border-accent shadow-floating ring-1 ring-accent'
          : 'border-border hover:border-border-strong hover:bg-surface-hover shadow-subtle'
      }`}
    >
      {/* Visual Thumbnail Area */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-subtle">
        {hasThumbnail ? (
          <Image
            src={reference.thumbnail_url}
            alt={reference.title || 'Reference thumbnail'}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            onError={() => setImageError(true)}
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center bg-surface-hover/30">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface border border-border text-muted-foreground/70 mb-2">
              <Globe className="h-4 w-4" />
            </div>
            <span className="font-mono text-xs text-muted-foreground/80 max-w-[85%] truncate">
              {reference.source_domain || 'Web Reference'}
            </span>
          </div>
        )}

        {/* Floating Domain Pill */}
        <div className="absolute top-2.5 left-2.5 z-10">
          <span className="inline-flex items-center gap-1 rounded bg-black/60 px-2 py-0.5 font-mono text-[10px] font-medium text-foreground backdrop-blur-sm border border-white/10">
            {reference.source_domain || 'web'}
          </span>
        </div>

        {/* Hover Action Overlay */}
        <div className="absolute top-2.5 right-2.5 z-10 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <a
            href={reference.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex h-6 w-6 items-center justify-center rounded bg-black/60 text-white backdrop-blur-sm hover:bg-black transition-colors"
            title="Open source link"
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Card Details */}
      <div className="flex flex-1 flex-col justify-between p-3.5 space-y-2.5">
        <div>
          <h4 className="font-display text-sm font-medium leading-snug text-foreground group-hover:text-accent transition-colors line-clamp-2">
            {reference.title}
          </h4>

          {reference.note && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground leading-relaxed flex items-start gap-1">
              <FileText className="h-3 w-3 shrink-0 mt-0.5 text-muted-foreground/60" />
              <span>{reference.note}</span>
            </p>
          )}
        </div>

        {/* Tags */}
        {reference.tags && reference.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {reference.tags.slice(0, 3).map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="text-[10px] py-0 px-1.5 font-normal text-muted-foreground"
              >
                #{tag}
              </Badge>
            ))}
            {reference.tags.length > 3 && (
              <span className="text-[10px] text-muted-foreground/60 self-center">
                +{reference.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
