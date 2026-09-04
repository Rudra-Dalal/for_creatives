'use client';

import React, { useState, useEffect } from 'react';
import { HexColorPicker } from 'react-colorful';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Palette, Check } from 'lucide-react';

const PRESET_SWATCHES = [
  { hex: '#D97706', label: 'Primary Amber' },
  { hex: '#B45309', label: 'Dark Amber' },
  { hex: '#C2410C', label: 'Terracotta' },
  { hex: '#B91C1C', label: 'Crimson' },
  { hex: '#3F4A3C', label: 'Forest Olive' },
  { hex: '#1E3A5F', label: 'Deep Indigo' },
  { hex: '#8C8A82', label: 'Muted Sand' },
  { hex: '#E6E4DF', label: 'Warm White' },
  { hex: '#2A2A26', label: 'Surface Border' },
  { hex: '#181816', label: 'Charcoal Black' },
];

interface ColorSwatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialHex?: string;
  initialLabel?: string;
  onConfirm: (hex: string, label: string) => void;
  title?: string;
  confirmLabel?: string;
}

export function ColorSwatchDialog({
  open,
  onOpenChange,
  initialHex = '#D97706',
  initialLabel = '',
  onConfirm,
  title = 'Add Color Swatch',
  confirmLabel = 'Place Swatch',
}: ColorSwatchDialogProps) {
  const [hex, setHex] = useState(initialHex);
  const [label, setLabel] = useState(initialLabel);

  useEffect(() => {
    if (open) {
      setHex(initialHex);
      setLabel(initialLabel);
    }
  }, [open, initialHex, initialLabel]);

  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.trim();
    if (!val.startsWith('#') && val.length > 0) {
      val = `#${val}`;
    }
    setHex(val);
  };

  const handleConfirm = () => {
    const validHex = /^#[0-9A-Fa-f]{6}$/i.test(hex) ? hex.toUpperCase() : initialHex;
    onConfirm(validHex, label.trim());
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[340px] bg-[#181816] border-[#2A2A26] p-5 text-foreground shadow-2xl">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
            <Palette className="h-4 w-4 text-accent" />
            <span>{title}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* react-colorful Picker */}
          <div className="flex justify-center [&_.react-colorful]:w-full [&_.react-colorful]:h-[170px] [&_.react-colorful]:rounded-lg">
            <HexColorPicker
              color={hex.startsWith('#') && hex.length === 7 ? hex : '#D97706'}
              onChange={(newHex) => setHex(newHex.toUpperCase())}
            />
          </div>

          {/* Quick Preset Swatches */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Presets
            </span>
            <div className="grid grid-cols-5 gap-1.5">
              {PRESET_SWATCHES.map((preset) => (
                <button
                  key={preset.hex}
                  type="button"
                  onClick={() => {
                    setHex(preset.hex);
                    if (!label || PRESET_SWATCHES.some((p) => p.label === label)) {
                      setLabel(preset.label);
                    }
                  }}
                  className="group relative h-6 w-full rounded border border-border/80 transition-all hover:scale-105"
                  style={{ backgroundColor: preset.hex }}
                  title={`${preset.label} (${preset.hex})`}
                >
                  {hex.toUpperCase() === preset.hex.toUpperCase() && (
                    <Check className="mx-auto h-3 w-3 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Hex & Label Inputs */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div
                className="h-8 w-8 shrink-0 rounded-md border border-border/80 shadow-sm"
                style={{ backgroundColor: hex }}
              />
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={hex}
                  onChange={handleHexInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="#D97706"
                  maxLength={7}
                  className="w-full rounded-md bg-[#121211] border border-border px-2.5 py-1.5 font-mono text-xs text-foreground focus:border-accent focus:outline-none"
                />
              </div>
            </div>

            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Swatch label (e.g. Primary Accent)"
              className="w-full rounded-md bg-[#121211] border border-border px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
            />
          </div>
        </div>

        <DialogFooter className="pt-2 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            className="h-8 bg-accent text-accent-foreground hover:bg-accent/90 text-xs font-medium px-4"
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
