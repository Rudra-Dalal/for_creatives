import React from 'react';
import { cn } from '@/lib/utils/cn';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center p-12 max-w-sm mx-auto',
        className
      )}
    >
      {icon && (
        <div className="mb-4 text-muted-foreground/60 flex items-center justify-center">
          {icon}
        </div>
      )}
      <h3 className="text-base font-medium text-foreground tracking-tight">{title}</h3>
      {description && (
        <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
