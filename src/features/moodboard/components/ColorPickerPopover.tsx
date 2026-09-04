'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Pipette, X, Plus, ChevronDown, Check } from 'lucide-react';
import {
  hsvToRgb,
  rgbToHsv,
  rgbToHex,
  hexToHsv,
  normalizeHex,
  DEFAULT_PRESET_COLORS,
  type HSV,
} from '../utils/colorUtils';

interface ColorPickerPopoverProps {
  initialHex: string;
  initialLabel?: string;
  documentColors?: string[];
  onChange?: (hex: string, label: string) => void;
  onClose: () => void;
  anchorPosition?: { top: number; left: number };
  isCreateMode?: boolean;
  onConfirm?: (hex: string, label: string) => void;
  confirmLabel?: string;
}

export function ColorPickerPopover({
  initialHex,
  initialLabel = '',
  documentColors = [],
  onChange,
  onClose,
  anchorPosition,
  isCreateMode = false,
  onConfirm,
  confirmLabel,
}: ColorPickerPopoverProps) {
  const [hsv, setHsv] = useState<HSV>(() => hexToHsv(initialHex));
  const [alpha, setAlpha] = useState(1);
  const [hexInput, setHexInput] = useState(() => normalizeHex(initialHex));
  const [labelInput, setLabelInput] = useState(initialLabel);
  const [colorModel, setColorModel] = useState<'HEX' | 'RGB'>('HEX');
  const [isEyedropperActive, setIsEyedropperActive] = useState(false);

  // User-saved custom palette stored in localStorage
  const [savedColors, setSavedColors] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('creative_user_palette');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const satValBoxRef = useRef<HTMLDivElement>(null);
  const hueSliderRef = useRef<HTMLDivElement>(null);
  const alphaSliderRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Compute current hex from HSV
  const currentRgb = hsvToRgb(hsv.h, hsv.s, hsv.v, alpha);
  const currentSolidHex = rgbToHex(currentRgb.r, currentRgb.g, currentRgb.b);

  // Synchronize external changes
  useEffect(() => {
    const nextHsv = hexToHsv(initialHex);
    setHsv(nextHsv);
    setHexInput(normalizeHex(initialHex));
    setLabelInput(initialLabel);
  }, [initialHex, initialLabel]);

  // Notify parent on color changes
  const notifyChange = useCallback(
    (newHex: string, newLabel: string) => {
      onChange?.(newHex, newLabel);
    },
    [onChange]
  );

  // Handle updates from HSV
  const updateFromHsv = useCallback(
    (nextHsv: HSV, nextAlpha = alpha) => {
      setHsv(nextHsv);
      const rgb = hsvToRgb(nextHsv.h, nextHsv.s, nextHsv.v, nextAlpha);
      const nextHex = rgbToHex(rgb.r, rgb.g, rgb.b);
      setHexInput(nextHex);
      notifyChange(nextHex, labelInput);
    },
    [alpha, labelInput, notifyChange]
  );

  // 1. Saturation / Value Box Drag Handling
  const handleSatValPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const box = satValBoxRef.current;
    if (!box) return;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const rect = box.getBoundingClientRect();
      const clientX = Math.max(rect.left, Math.min(rect.right, moveEvent.clientX));
      const clientY = Math.max(rect.top, Math.min(rect.bottom, moveEvent.clientY));

      const s = Math.round(((clientX - rect.left) / rect.width) * 100);
      const v = Math.round((1 - (clientY - rect.top) / rect.height) * 100);

      updateFromHsv({ ...hsv, s, v });
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    // Initial click trigger
    handlePointerMove(e.nativeEvent);
  };

  // 2. Hue Slider Drag Handling
  const handleHuePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const slider = hueSliderRef.current;
    if (!slider) return;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const rect = slider.getBoundingClientRect();
      const clientX = Math.max(rect.left, Math.min(rect.right, moveEvent.clientX));
      const h = Math.round(((clientX - rect.left) / rect.width) * 360);
      updateFromHsv({ ...hsv, h: Math.min(360, Math.max(0, h)) });
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    handlePointerMove(e.nativeEvent);
  };

  // 3. Alpha Slider Drag Handling
  const handleAlphaPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const slider = alphaSliderRef.current;
    if (!slider) return;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const rect = slider.getBoundingClientRect();
      const clientX = Math.max(rect.left, Math.min(rect.right, moveEvent.clientX));
      const newAlpha = Math.round(((clientX - rect.left) / rect.width) * 100) / 100;
      setAlpha(newAlpha);
      updateFromHsv(hsv, newAlpha);
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    handlePointerMove(e.nativeEvent);
  };

  // 4. Eyedropper Tool
  const handleEyedropper = async () => {
    if (typeof window !== 'undefined' && 'EyeDropper' in window) {
      try {
        setIsEyedropperActive(true);
        type WindowWithEyeDropper = Window & {
          EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> };
        };
        const EyeDropperConstructor = (window as unknown as WindowWithEyeDropper).EyeDropper;
        const eyeDropper = new EyeDropperConstructor();
        const result = await eyeDropper.open();
        if (result?.sRGBHex) {
          const pickedHex = normalizeHex(result.sRGBHex);
          const nextHsv = hexToHsv(pickedHex);
          setHsv(nextHsv);
          setHexInput(pickedHex);
          notifyChange(pickedHex, labelInput);
        }
      } catch {
        // User cancelled or pressed escape
      } finally {
        setIsEyedropperActive(false);
      }
    } else {
      // Fallback message for browsers without EyeDropper API
      alert('The Eyedropper tool is supported in Chrome, Edge, and Opera browsers.');
    }
  };

  // 5. Direct Hex Input Change
  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setHexInput(val);
    const normalized = normalizeHex(val);
    if (/^#[0-9A-F]{6}$/i.test(normalized)) {
      const nextHsv = hexToHsv(normalized);
      setHsv(nextHsv);
      notifyChange(normalized, labelInput);
    }
  };

  // 6. Direct RGB Input Change
  const handleRgbChange = (channel: 'r' | 'g' | 'b', val: number) => {
    const nextRgb = {
      ...currentRgb,
      [channel]: Math.max(0, Math.min(255, isNaN(val) ? 0 : val)),
    };
    const nextHsv = rgbToHsv(nextRgb.r, nextRgb.g, nextRgb.b, alpha);
    const nextHex = rgbToHex(nextRgb.r, nextRgb.g, nextRgb.b);
    setHsv(nextHsv);
    setHexInput(nextHex);
    notifyChange(nextHex, labelInput);
  };

  // 7. Swatch Label Change
  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLabelInput(val);
    notifyChange(currentSolidHex, val);
  };

  // 8. Select Preset Color
  const handleSelectColor = (hex: string) => {
    const normalized = normalizeHex(hex);
    const nextHsv = hexToHsv(normalized);
    setHsv(nextHsv);
    setHexInput(normalized);
    notifyChange(normalized, labelInput);
  };

  // 9. Save Current Color to User Palette
  const handleAddCurrentToSaved = () => {
    if (!savedColors.includes(currentSolidHex)) {
      const updated = [currentSolidHex, ...savedColors].slice(0, 16);
      setSavedColors(updated);
      try {
        localStorage.setItem('creative_user_palette', JSON.stringify(updated));
      } catch {
        // Ignored
      }
    }
  };

  // Merge Document Colors + Saved Colors + Fallback Presets without duplicates
  const allPaletteColors = React.useMemo(() => {
    const combined = Array.from(
      new Set([...documentColors, ...savedColors, ...DEFAULT_PRESET_COLORS])
    ).filter((c) => /^#[0-9A-Fa-f]{6}$/.test(c));
    return combined.slice(0, 24);
  }, [documentColors, savedColors]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Calculate position with viewport boundaries
  const style: React.CSSProperties = React.useMemo(() => {
    if (!anchorPosition) {
      return { top: '80px', left: '80px' };
    }
    const popoverWidth = 268;
    const popoverHeight = 440;
    const padding = 16;

    let left = anchorPosition.left;
    let top = anchorPosition.top;

    if (typeof window !== 'undefined') {
      if (left + popoverWidth > window.innerWidth - padding) {
        left = Math.max(padding, window.innerWidth - popoverWidth - padding);
      }
      if (top + popoverHeight > window.innerHeight - padding) {
        top = Math.max(padding, window.innerHeight - popoverHeight - padding);
      }
    }

    return {
      left: `${Math.round(left)}px`,
      top: `${Math.round(top)}px`,
    };
  }, [anchorPosition]);

  return (
    <div
      ref={popoverRef}
      style={style}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      className="absolute z-50 w-[268px] rounded-xl border border-border bg-surface shadow-2xl backdrop-blur-md p-3.5 flex flex-col gap-3 animate-in fade-in-50 zoom-in-95 text-foreground"
    >
      {/* 1. Header: Mode, Live Swatch Indicator, and Close */}
      <div className="flex items-center justify-between pb-1 border-b border-border text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <span>{isCreateMode ? 'New Color Swatch' : 'Solid'}</span>
          {!isCreateMode && <ChevronDown className="h-3 w-3 opacity-60" />}
        </div>

        <div className="flex items-center gap-2">
          {/* Live Swatch Preview */}
          <div
            className="h-4 w-4 rounded-full border border-border-strong shadow-sm"
            style={{ backgroundColor: currentSolidHex }}
            title={currentSolidHex}
          />

          <button
            type="button"
            onClick={onClose}
            className="flex h-5 w-5 items-center justify-center rounded hover:bg-surface-hover text-muted-foreground hover:text-foreground transition-colors"
            title="Close (Esc)"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 2. 2D Saturation / Value Gradient Box */}
      <div
        ref={satValBoxRef}
        onPointerDown={handleSatValPointerDown}
        className="relative h-[150px] w-full rounded-lg overflow-hidden cursor-crosshair border border-border/80"
        style={{
          backgroundColor: `hsl(${hsv.h}, 100%, 50%)`,
        }}
      >
        {/* Horizontal White Gradient (Saturation 0 -> 100) */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to right, #ffffff, transparent)',
          }}
        />

        {/* Vertical Black Gradient (Value 100 -> 0) */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom, transparent, #000000)',
          }}
        />

        {/* Draggable Circle Handle */}
        <div
          className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md pointer-events-none ring-1 ring-black/40"
          style={{
            left: `${hsv.s}%`,
            top: `${100 - hsv.v}%`,
            backgroundColor: currentSolidHex,
          }}
        />
      </div>

      {/* 3. Eyedropper Tool & Sliders */}
      <div className="flex items-center gap-2.5">
        {/* Eyedropper Button */}
        <button
          type="button"
          onClick={handleEyedropper}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border transition-colors ${
            isEyedropperActive
              ? 'bg-accent text-accent-foreground border-accent'
              : 'bg-surface-subtle text-muted-foreground hover:bg-surface-hover hover:text-foreground'
          }`}
          title="Pick color from screen (Eyedropper)"
        >
          <Pipette className="h-4 w-4" />
        </button>

        {/* Hue & Alpha Sliders Column */}
        <div className="flex-1 flex flex-col gap-2">
          {/* Hue Rainbow Slider */}
          <div
            ref={hueSliderRef}
            onPointerDown={handleHuePointerDown}
            className="relative h-3 w-full rounded-full cursor-pointer border border-border/60"
            style={{
              background:
                'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
            }}
          >
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-4 w-4 rounded-full border-2 border-white bg-surface shadow-md pointer-events-none ring-1 ring-black/30"
              style={{
                left: `${(hsv.h / 360) * 100}%`,
              }}
            />
          </div>

          {/* Alpha / Opacity Slider */}
          <div
            ref={alphaSliderRef}
            onPointerDown={handleAlphaPointerDown}
            className="relative h-3 w-full rounded-full cursor-pointer border border-border/60 overflow-hidden"
            style={{
              backgroundImage:
                'linear-gradient(45deg, #262622 25%, transparent 25%), linear-gradient(-45deg, #262622 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #262622 75%), linear-gradient(-45deg, transparent 75%, #262622 75%)',
              backgroundSize: '8px 8px',
              backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to right, transparent, ${currentSolidHex})`,
              }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-4 w-4 rounded-full border-2 border-white bg-surface shadow-md pointer-events-none ring-1 ring-black/30"
              style={{
                left: `${alpha * 100}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* 4. Color Model Switcher & Value Inputs */}
      <div className="flex items-center gap-2 pt-0.5">
        {/* Model Selector Toggle */}
        <button
          type="button"
          onClick={() => setColorModel((prev) => (prev === 'HEX' ? 'RGB' : 'HEX'))}
          className="flex items-center gap-0.5 text-[11px] font-mono uppercase text-muted-foreground hover:text-foreground px-1.5 py-1 rounded bg-surface-subtle border border-border"
          title="Click to toggle HEX / RGB"
        >
          <span>{colorModel}</span>
          <ChevronDown className="h-2.5 w-2.5 opacity-50" />
        </button>

        {colorModel === 'HEX' ? (
          <div className="flex-1 flex items-center">
            <input
              type="text"
              value={hexInput}
              onChange={handleHexInputChange}
              placeholder="#D97706"
              maxLength={7}
              className="w-full rounded bg-surface-subtle px-2 py-1 font-mono text-xs text-foreground border border-border outline-none focus:border-accent select-text selection:bg-accent selection:text-white"
            />
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-3 gap-1">
            {(['r', 'g', 'b'] as const).map((ch) => (
              <input
                key={ch}
                type="number"
                min={0}
                max={255}
                value={currentRgb[ch]}
                onChange={(e) => handleRgbChange(ch, parseInt(e.target.value, 10))}
                className="w-full rounded bg-surface-subtle px-1 py-1 font-mono text-[11px] text-center text-foreground border border-border outline-none focus:border-accent select-text selection:bg-accent selection:text-white"
                title={ch.toUpperCase()}
              />
            ))}
          </div>
        )}

        {/* Opacity percentage input */}
        <div className="w-14 flex items-center">
          <input
            type="text"
            value={`${Math.round(alpha * 100)}%`}
            onChange={(e) => {
              const val = parseInt(e.target.value.replace('%', ''), 10);
              if (!isNaN(val)) {
                const norm = Math.max(0, Math.min(100, val)) / 100;
                setAlpha(norm);
                updateFromHsv(hsv, norm);
              }
            }}
            className="w-full rounded bg-surface-subtle px-1.5 py-1 font-mono text-xs text-center text-foreground border border-border outline-none focus:border-accent select-text selection:bg-accent selection:text-white"
            title="Opacity"
          />
        </div>
      </div>

      {/* Swatch Label Input */}
      <div className="flex flex-col gap-1">
        <input
          type="text"
          value={labelInput}
          onChange={handleLabelChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && isCreateMode && onConfirm) {
              e.preventDefault();
              onConfirm(currentSolidHex, labelInput.trim() || currentSolidHex);
              onClose();
            }
          }}
          placeholder="Color name (e.g. Primary Amber)"
          className="w-full rounded bg-surface-subtle px-2 py-1 text-xs text-foreground border border-border outline-none focus:border-accent placeholder-muted-foreground/60 select-text selection:bg-accent selection:text-white"
        />
      </div>

      {/* 5. Document & Saved Colors Palette */}
      <div className="pt-2 border-t border-border flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">Document colors</span>
          <button
            type="button"
            onClick={handleAddCurrentToSaved}
            className="flex items-center gap-1 text-[10px] text-accent hover:underline"
            title="Save current color to palette"
          >
            <Plus className="h-3 w-3" />
            <span>Save</span>
          </button>
        </div>

        {/* Swatch Chips Grid */}
        <div className="grid grid-cols-8 gap-1.5 max-h-[84px] overflow-y-auto pr-0.5">
          {allPaletteColors.map((color) => {
            const isSelected = color.toUpperCase() === currentSolidHex.toUpperCase();
            return (
              <button
                key={color}
                type="button"
                onClick={() => handleSelectColor(color)}
                className={`relative h-5 w-5 rounded transition-transform hover:scale-110 border ${
                  isSelected ? 'border-accent ring-1 ring-accent' : 'border-border/60 hover:border-border-strong'
                }`}
                style={{ backgroundColor: color }}
                title={color}
              >
                {isSelected && (
                  <Check className="absolute inset-0 m-auto h-3 w-3 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 6. Action Button for Create Mode */}
      {isCreateMode && onConfirm && (
        <div className="pt-2 border-t border-border">
          <button
            type="button"
            onClick={() => {
              onConfirm(currentSolidHex, labelInput.trim() || currentSolidHex);
              onClose();
            }}
            className="w-full h-8 rounded-lg bg-accent text-white hover:bg-accent-hover text-xs font-medium flex items-center justify-center gap-1.5 transition-colors shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{confirmLabel || 'Add Swatch to Moodboard'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
