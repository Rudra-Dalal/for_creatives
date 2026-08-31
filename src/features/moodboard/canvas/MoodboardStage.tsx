'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Stage, Layer, Rect } from 'react-konva';
import type Konva from 'konva';
import type {
  MoodboardItem,
  CanvasViewport,
  TextItemContent,
  ColorItemContent,
  IdeaItemContent,
} from '../types';
import { CanvasReferenceItem } from './CanvasReferenceItem';
import { CanvasImageItem } from './CanvasImageItem';
import { CanvasTextItem } from './CanvasTextItem';
import { CanvasColorItem } from './CanvasColorItem';
import { CanvasIdeaItem } from './CanvasIdeaItem';
import { CanvasTransformer } from './CanvasTransformer';

interface MoodboardStageProps {
  items: MoodboardItem[];
  selectedId: string | null;
  viewport: CanvasViewport;
  onViewportChange: (viewport: CanvasViewport) => void;
  onSelectId: (id: string | null) => void;
  onUpdateItemLocal: (
    id: string,
    updates: Partial<Pick<MoodboardItem, 'x' | 'y' | 'width' | 'height' | 'z_index' | 'content'>>
  ) => void;
  onPersistGeometry: (
    id: string,
    geometry: { x: number; y: number; width: number; height: number; zIndex?: number }
  ) => void;
  onBringToFront: (id: string) => void;
  onUpdateText: (id: string, text: string) => void;
  onUpdateColor: (id: string, hex: string, label?: string) => void;
  onUpdateIdea: (id: string, title: string, notes?: string) => void;
  onDuplicateItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onDropReference: (referenceData: unknown, canvasPosition: { x: number; y: number }) => void;
  onDropFiles: (files: FileList, canvasPosition: { x: number; y: number }) => void;
}

export function MoodboardStage({
  items,
  selectedId,
  viewport,
  onViewportChange,
  onSelectId,
  onUpdateItemLocal,
  onPersistGeometry,
  onBringToFront,
  onUpdateText,
  onUpdateColor,
  onUpdateIdea,
  onDuplicateItem,
  onDeleteItem,
  onDropReference,
  onDropFiles,
}: MoodboardStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);

  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedNode, setSelectedNode] = useState<Konva.Node | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Editing overlays
  const [editingTextItem, setEditingTextItem] = useState<MoodboardItem | null>(null);
  const [editingTextValue, setEditingTextValue] = useState('');

  const [editingColorItem, setEditingColorItem] = useState<MoodboardItem | null>(null);
  const [editingColorHex, setEditingColorHex] = useState('');
  const [editingColorLabel, setEditingColorLabel] = useState('');

  const [editingIdeaItem, setEditingIdeaItem] = useState<MoodboardItem | null>(null);
  const [editingIdeaTitle, setEditingIdeaTitle] = useState('');
  const [editingIdeaNotes, setEditingIdeaNotes] = useState('');

  // Image for subtle dotted background pattern
  const [dotPatternImage, setDotPatternImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const canvas = document.createElement('canvas');
    canvas.width = 28;
    canvas.height = 28;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#121211';
      ctx.fillRect(0, 0, 28, 28);
      ctx.fillStyle = '#262622';
      ctx.beginPath();
      ctx.arc(14, 14, 1.2, 0, Math.PI * 2);
      ctx.fill();

      const img = new Image();
      img.src = canvas.toDataURL();
      img.onload = () => {
        setDotPatternImage(img);
      };
    }
  }, []);

  // Resize observer to fill container
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Update selectedNode when selectedId changes
  useEffect(() => {
    if (!selectedId || !stageRef.current) {
      setSelectedNode(null);
      return;
    }
    const node = stageRef.current.findOne(`#${selectedId}`);
    if (node) {
      setSelectedNode(node);
    } else {
      setSelectedNode(null);
    }
  }, [selectedId, items]);

  // Keyboard shortcut listener (Delete, Escape, Duplicate Cmd+D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        editingTextItem ||
        editingColorItem ||
        editingIdeaItem
      ) {
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        onDeleteItem(selectedId);
        onSelectId(null);
      } else if (e.key === 'Escape') {
        onSelectId(null);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd' && selectedId) {
        e.preventDefault();
        onDuplicateItem(selectedId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedId,
    editingTextItem,
    editingColorItem,
    editingIdeaItem,
    onDeleteItem,
    onDuplicateItem,
    onSelectId,
  ]);

  // Mouse wheel zoom centered on cursor
  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();

    const stage = stageRef.current;
    if (!stage) return;

    const scaleBy = 1.08;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = direction > 0 ? Math.min(oldScale * scaleBy, 3) : Math.max(oldScale / scaleBy, 0.2);

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };

    onViewportChange({
      x: newPos.x,
      y: newPos.y,
      scale: newScale,
    });
  };

  // Drag stage (panning)
  const handleStageDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (e.target === stageRef.current) {
      onViewportChange({
        x: e.target.x(),
        y: e.target.y(),
        scale: viewport.scale,
      });
    }
  };

  // Background click deselect
  const handleBackgroundClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (e.target === e.target.getStage() || e.target.name() === 'canvas-background') {
      onSelectId(null);
      setSelectedNode(null);
      if (editingTextItem) handleSaveTextEdit();
      if (editingColorItem) handleSaveColorEdit();
      if (editingIdeaItem) handleSaveIdeaEdit();
    }
  };

  // Drag & drop file or reference drawer item
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const canvasX = (clientX - viewport.x) / viewport.scale;
    const canvasY = (clientY - viewport.y) / viewport.scale;

    // Check for native file drops from OS (Desktop/Explorer)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onDropFiles(e.dataTransfer.files, { x: Math.round(canvasX - 100), y: Math.round(canvasY - 80) });
      return;
    }

    // Check for Reference Library drawer drop
    const rawData = e.dataTransfer.getData('application/json');
    if (rawData) {
      try {
        const refData = JSON.parse(rawData);
        onDropReference(refData, { x: Math.round(canvasX - 140), y: Math.round(canvasY - 100) });
      } catch {
        // Ignored
      }
    }
  };

  // Text item editing overlay
  const handleOpenTextEdit = (item: MoodboardItem) => {
    setEditingTextItem(item);
    const content = (item.content as TextItemContent) || { text: '' };
    setEditingTextValue(content.text || '');
  };

  const handleSaveTextEdit = () => {
    if (editingTextItem) {
      onUpdateText(editingTextItem.id, editingTextValue.trim());
      setEditingTextItem(null);
    }
  };

  // Color item editing overlay
  const handleOpenColorEdit = (item: MoodboardItem) => {
    setEditingColorItem(item);
    const content = (item.content as ColorItemContent) || { hex: '#D97706', label: '' };
    setEditingColorHex(content.hex || '#D97706');
    setEditingColorLabel(content.label || '');
  };

  const handleSaveColorEdit = () => {
    if (editingColorItem) {
      onUpdateColor(editingColorItem.id, editingColorHex.trim(), editingColorLabel.trim());
      setEditingColorItem(null);
    }
  };

  // Idea item editing overlay
  const handleOpenIdeaEdit = (item: MoodboardItem) => {
    setEditingIdeaItem(item);
    const content = (item.content as IdeaItemContent) || { title: '', notes: '' };
    setEditingIdeaTitle(content.title || '');
    setEditingIdeaNotes(content.notes || '');
  };

  const handleSaveIdeaEdit = () => {
    if (editingIdeaItem) {
      onUpdateIdea(editingIdeaItem.id, editingIdeaTitle.trim(), editingIdeaNotes.trim());
      setEditingIdeaItem(null);
    }
  };

  // Calculate screen position for overlay
  const getEditingOverlayStyle = useCallback(
    (targetItem: MoodboardItem | null) => {
      if (!targetItem) return {};
      const screenX = targetItem.x * viewport.scale + viewport.x;
      const screenY = targetItem.y * viewport.scale + viewport.y;
      const screenWidth = targetItem.width * viewport.scale;
      const screenHeight = targetItem.height * viewport.scale;

      return {
        left: `${screenX}px`,
        top: `${screenY}px`,
        width: `${Math.max(screenWidth, 200)}px`,
        minHeight: `${Math.max(screenHeight, 140)}px`,
        fontSize: `${Math.max(12, 14 * viewport.scale)}px`,
      };
    },
    [viewport]
  );

  const selectedItem = items.find((i) => i.id === selectedId);

  return (
    <div
      ref={containerRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative flex-1 w-full h-full overflow-hidden select-none bg-[#121211] cursor-default ${
        isDragOver ? 'ring-2 ring-inset ring-accent/60' : ''
      }`}
    >
      {/* Subtle Drag Over Indicator */}
      {isDragOver && (
        <div className="absolute inset-4 z-40 pointer-events-none rounded-xl border-2 border-dashed border-accent/60 bg-accent/5 flex items-center justify-center">
          <div className="rounded-lg bg-surface/90 border border-border px-4 py-2 text-xs font-medium text-foreground shadow-floating backdrop-blur-sm">
            Drop image onto creative playground
          </div>
        </div>
      )}

      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        x={viewport.x}
        y={viewport.y}
        scaleX={viewport.scale}
        scaleY={viewport.scale}
        draggable
        onWheel={handleWheel}
        onDragEnd={handleStageDragEnd}
        onClick={handleBackgroundClick}
        onTap={handleBackgroundClick}
      >
        <Layer>
          {/* Dotted Infinite Playground Canvas Background */}
          {dotPatternImage ? (
            <Rect
              name="canvas-background"
              x={-50000}
              y={-50000}
              width={100000}
              height={100000}
              fillPatternImage={dotPatternImage}
              fillPatternRepeat="repeat"
            />
          ) : (
            <Rect
              name="canvas-background"
              x={-50000}
              y={-50000}
              width={100000}
              height={100000}
              fill="#121211"
            />
          )}

          {/* Render All 5 Playground Objects */}
          {items.map((item) => {
            const isSelected = item.id === selectedId;

            if (item.type === 'text') {
              return (
                <CanvasTextItem
                  key={item.id}
                  item={item}
                  isSelected={isSelected}
                  onSelect={(node) => {
                    onSelectId(item.id);
                    setSelectedNode(node);
                  }}
                  onDragStart={() => {
                    onBringToFront(item.id);
                    onSelectId(item.id);
                  }}
                  onDragEnd={(id, x, y) => {
                    onUpdateItemLocal(id, { x, y });
                    onPersistGeometry(id, {
                      x,
                      y,
                      width: item.width,
                      height: item.height,
                      zIndex: item.z_index,
                    });
                  }}
                  onTransformEnd={(id, x, y, width, height) => {
                    onUpdateItemLocal(id, { x, y, width, height });
                    onPersistGeometry(id, { x, y, width, height, zIndex: item.z_index });
                  }}
                  onDoubleClick={handleOpenTextEdit}
                />
              );
            }

            if (item.type === 'image') {
              return (
                <CanvasImageItem
                  key={item.id}
                  item={item}
                  isSelected={isSelected}
                  onSelect={(node) => {
                    onSelectId(item.id);
                    setSelectedNode(node);
                  }}
                  onDragStart={() => {
                    onBringToFront(item.id);
                    onSelectId(item.id);
                  }}
                  onDragEnd={(id, x, y) => {
                    onUpdateItemLocal(id, { x, y });
                    onPersistGeometry(id, {
                      x,
                      y,
                      width: item.width,
                      height: item.height,
                      zIndex: item.z_index,
                    });
                  }}
                  onTransformEnd={(id, x, y, width, height) => {
                    onUpdateItemLocal(id, { x, y, width, height });
                    onPersistGeometry(id, { x, y, width, height, zIndex: item.z_index });
                  }}
                />
              );
            }

            if (item.type === 'color') {
              return (
                <CanvasColorItem
                  key={item.id}
                  item={item}
                  isSelected={isSelected}
                  onSelect={(node) => {
                    onSelectId(item.id);
                    setSelectedNode(node);
                  }}
                  onDragStart={() => {
                    onBringToFront(item.id);
                    onSelectId(item.id);
                  }}
                  onDragEnd={(id, x, y) => {
                    onUpdateItemLocal(id, { x, y });
                    onPersistGeometry(id, {
                      x,
                      y,
                      width: item.width,
                      height: item.height,
                      zIndex: item.z_index,
                    });
                  }}
                  onTransformEnd={(id, x, y, width, height) => {
                    onUpdateItemLocal(id, { x, y, width, height });
                    onPersistGeometry(id, { x, y, width, height, zIndex: item.z_index });
                  }}
                  onDoubleClick={handleOpenColorEdit}
                />
              );
            }

            if (item.type === 'idea') {
              return (
                <CanvasIdeaItem
                  key={item.id}
                  item={item}
                  isSelected={isSelected}
                  onSelect={(node) => {
                    onSelectId(item.id);
                    setSelectedNode(node);
                  }}
                  onDragStart={() => {
                    onBringToFront(item.id);
                    onSelectId(item.id);
                  }}
                  onDragEnd={(id, x, y) => {
                    onUpdateItemLocal(id, { x, y });
                    onPersistGeometry(id, {
                      x,
                      y,
                      width: item.width,
                      height: item.height,
                      zIndex: item.z_index,
                    });
                  }}
                  onTransformEnd={(id, x, y, width, height) => {
                    onUpdateItemLocal(id, { x, y, width, height });
                    onPersistGeometry(id, { x, y, width, height, zIndex: item.z_index });
                  }}
                  onDoubleClick={handleOpenIdeaEdit}
                />
              );
            }

            // Default: Reference Item
            return (
              <CanvasReferenceItem
                key={item.id}
                item={item}
                isSelected={isSelected}
                onSelect={(node) => {
                  onSelectId(item.id);
                  setSelectedNode(node);
                }}
                onDragStart={() => {
                  onBringToFront(item.id);
                  onSelectId(item.id);
                }}
                onDragEnd={(id, x, y) => {
                  onUpdateItemLocal(id, { x, y });
                  onPersistGeometry(id, {
                    x,
                    y,
                    width: item.width,
                    height: item.height,
                    zIndex: item.z_index,
                  });
                }}
                onTransformEnd={(id, x, y, width, height) => {
                  onUpdateItemLocal(id, { x, y, width, height });
                  onPersistGeometry(id, { x, y, width, height, zIndex: item.z_index });
                }}
              />
            );
          })}

          {/* Transformer */}
          <CanvasTransformer
            selectedNode={selectedNode}
            keepRatio={selectedItem?.type === 'reference' || selectedItem?.type === 'image'}
          />
        </Layer>
      </Stage>

      {/* 1. Inline Text Edit DOM Overlay */}
      {editingTextItem && (
        <div
          style={getEditingOverlayStyle(editingTextItem)}
          className="absolute z-30 flex flex-col rounded-md border border-accent bg-[#22211E] p-3 shadow-floating animate-in fade-in-50"
        >
          <textarea
            value={editingTextValue}
            onChange={(e) => setEditingTextValue(e.target.value)}
            onBlur={handleSaveTextEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSaveTextEdit();
              } else if (e.key === 'Escape') {
                setEditingTextItem(null);
              }
            }}
            autoFocus
            className="flex-1 w-full resize-none bg-transparent font-display text-foreground focus:outline-none leading-relaxed"
            placeholder="Type your creative note..."
          />
          <div className="flex items-center justify-between pt-2 border-t border-border-subtle text-[10px] text-muted-foreground">
            <span>Press Cmd+Enter to save</span>
            <button
              type="button"
              onClick={handleSaveTextEdit}
              className="text-accent hover:underline font-medium"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* 2. Color Swatch Edit DOM Overlay */}
      {editingColorItem && (
        <div
          style={getEditingOverlayStyle(editingColorItem)}
          className="absolute z-30 flex flex-col gap-2.5 rounded-lg border border-accent bg-surface p-3.5 shadow-floating animate-in fade-in-50"
        >
          <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            Edit Color Swatch
          </span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={editingColorHex}
              onChange={(e) => setEditingColorHex(e.target.value)}
              className="h-8 w-8 cursor-pointer rounded border border-border bg-transparent p-0"
            />
            <input
              type="text"
              value={editingColorHex}
              onChange={(e) => setEditingColorHex(e.target.value)}
              className="h-8 flex-1 rounded border border-border bg-surface-subtle px-2 font-mono text-xs text-foreground focus:outline-none focus:border-accent"
              placeholder="#HEX"
              autoFocus
            />
          </div>
          <input
            type="text"
            value={editingColorLabel}
            onChange={(e) => setEditingColorLabel(e.target.value)}
            className="h-8 w-full rounded border border-border bg-surface-subtle px-2 text-xs text-foreground focus:outline-none focus:border-accent"
            placeholder="Label (optional, e.g. Primary Amber)"
          />
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setEditingColorItem(null)}
              className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveColorEdit}
              className="rounded bg-accent px-2.5 py-1 text-xs font-medium text-white hover:bg-accent-hover"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* 3. Creative Idea Edit DOM Overlay */}
      {editingIdeaItem && (
        <div
          style={getEditingOverlayStyle(editingIdeaItem)}
          className="absolute z-30 flex flex-col gap-2.5 rounded-lg border border-accent bg-[#1C1B17] p-3.5 shadow-floating animate-in fade-in-50"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-accent">
              Creative Idea
            </span>
          </div>
          <input
            type="text"
            value={editingIdeaTitle}
            onChange={(e) => setEditingIdeaTitle(e.target.value)}
            className="w-full bg-transparent font-display text-sm font-medium italic text-foreground focus:outline-none border-b border-border focus:border-accent pb-1"
            placeholder="e.g. Editorial but energetic"
            autoFocus
          />
          <textarea
            value={editingIdeaNotes}
            onChange={(e) => setEditingIdeaNotes(e.target.value)}
            rows={2}
            className="w-full resize-none rounded border border-border/60 bg-surface-subtle/50 p-2 text-xs text-foreground focus:outline-none focus:border-accent"
            placeholder="Additional thoughts or notes..."
          />
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setEditingIdeaItem(null)}
              className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveIdeaEdit}
              className="rounded bg-accent px-2.5 py-1 text-xs font-medium text-white hover:bg-accent-hover"
            >
              Save Idea
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

