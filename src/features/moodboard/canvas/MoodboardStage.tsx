'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Stage, Layer, Rect } from 'react-konva';
import type Konva from 'konva';
import type { MoodboardItem, CanvasViewport, TextItemContent } from '../types';
import { CanvasReferenceItem } from './CanvasReferenceItem';
import { CanvasTextItem } from './CanvasTextItem';
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
  onDeleteItem: (id: string) => void;
  onDropReference: (referenceData: unknown, canvasPosition: { x: number; y: number }) => void;
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
  onDeleteItem,
  onDropReference,
}: MoodboardStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);

  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedNode, setSelectedNode] = useState<Konva.Node | null>(null);
  const [editingTextItem, setEditingTextItem] = useState<MoodboardItem | null>(null);
  const [editingTextValue, setEditingTextValue] = useState('');

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

  // Keyboard shortcut listener (Delete, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input or textarea
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        editingTextItem
      ) {
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        onDeleteItem(selectedId);
        onSelectId(null);
      } else if (e.key === 'Escape') {
        onSelectId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, editingTextItem, onDeleteItem, onSelectId]);

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

    // Determine direction
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
      if (editingTextItem) {
        handleSaveTextEdit();
      }
    }
  };

  // Drag & drop from library drawer
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const rawData = e.dataTransfer.getData('application/json');
    if (!rawData) return;

    try {
      const refData = JSON.parse(rawData);
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      // Transform to canvas coordinates
      const canvasX = (clientX - viewport.x) / viewport.scale - 140;
      const canvasY = (clientY - viewport.y) / viewport.scale - 100;

      onDropReference(refData, { x: Math.round(canvasX), y: Math.round(canvasY) });
    } catch {
      // Invalid data
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

  // Calculate screen position for editing textarea overlay
  const getEditingOverlayStyle = useCallback(() => {
    if (!editingTextItem) return {};
    const screenX = editingTextItem.x * viewport.scale + viewport.x;
    const screenY = editingTextItem.y * viewport.scale + viewport.y;
    const screenWidth = editingTextItem.width * viewport.scale;
    const screenHeight = editingTextItem.height * viewport.scale;

    return {
      left: `${screenX}px`,
      top: `${screenY}px`,
      width: `${screenWidth}px`,
      height: `${screenHeight}px`,
      fontSize: `${Math.max(12, 14 * viewport.scale)}px`,
    };
  }, [editingTextItem, viewport]);

  const selectedItem = items.find((i) => i.id === selectedId);

  return (
    <div
      ref={containerRef}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="relative flex-1 w-full h-full overflow-hidden select-none bg-[#121210] cursor-default"
    >
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
          {/* Subtle Canvas Background click receiver */}
          <Rect
            name="canvas-background"
            x={-50000}
            y={-50000}
            width={100000}
            height={100000}
            fill="#121210"
          />

          {/* Render Items */}
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
            keepRatio={selectedItem?.type === 'reference'}
          />
        </Layer>
      </Stage>

      {/* Inline Text Edit DOM Overlay */}
      {editingTextItem && (
        <div
          style={getEditingOverlayStyle()}
          className="absolute z-30 flex flex-col rounded-md border border-accent bg-[#22211e] p-3 shadow-floating animate-in fade-in-50"
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
    </div>
  );
}
