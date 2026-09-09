'use client';

import React from 'react';
import { DIRECTION_CATEGORIES } from '../types';
import type { DirectionCategory } from '../types';

const CATEGORY_LABELS: Record<DirectionCategory, string> = {
  typography: 'Typography',
  color: 'Color',
  photography: 'Photography',
  motion: 'Motion',
  materials: 'Materials',
  other: 'Other',
};

interface CategorySelectorProps {
  value: DirectionCategory | null;
  onChange: (value: DirectionCategory | null) => void;
  disabled?: boolean;
}

export function CategorySelector({
  value,
  onChange,
  disabled = false,
}: CategorySelectorProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-foreground">
        Category <span className="text-muted-foreground font-normal">(optional)</span>
      </label>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Direction note category">
        {DIRECTION_CATEGORIES.map((cat) => {
          const isSelected = value === cat;
          return (
            <button
              key={cat}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => onChange(isSelected ? null : cat)}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                isSelected
                  ? 'bg-accent/15 border-accent/50 text-accent font-medium'
                  : 'bg-surface-subtle border-border text-muted-foreground hover:text-foreground hover:border-border-subtle'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
