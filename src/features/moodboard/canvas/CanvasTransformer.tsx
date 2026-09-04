'use client';

import React, { useEffect, useRef } from 'react';
import { Transformer } from 'react-konva';
import type Konva from 'konva';

interface CanvasTransformerProps {
  selectedNode?: Konva.Node | null;
  selectedNodes?: Konva.Node[];
  keepRatio?: boolean;
  onTransformEnd?: () => void;
}

export function CanvasTransformer({
  selectedNode,
  selectedNodes,
  keepRatio = false,
}: CanvasTransformerProps) {
  const transformerRef = useRef<Konva.Transformer | null>(null);

  const activeNodes = React.useMemo(() => {
    if (selectedNodes && selectedNodes.length > 0) return selectedNodes;
    if (selectedNode) return [selectedNode];
    return [];
  }, [selectedNode, selectedNodes]);

  useEffect(() => {
    if (!transformerRef.current) return;
    transformerRef.current.nodes(activeNodes);
    transformerRef.current.getLayer()?.batchDraw();
  }, [activeNodes]);

  if (activeNodes.length === 0) return null;

  return (
    <Transformer
      ref={transformerRef}
      boundBoxFunc={(oldBox, newBox) => {
        // Limit minimum size
        if (newBox.width < 40 || newBox.height < 30) {
          return oldBox;
        }
        return newBox;
      }}
      keepRatio={keepRatio}
      shiftBehavior="inverted"
      rotateEnabled={false}
      borderStroke="#f59e0b"
      borderStrokeWidth={1.5}
      anchorFill="#f59e0b"
      anchorStroke="#181816"
      anchorStrokeWidth={1.5}
      anchorSize={8}
      anchorCornerRadius={2}
      padding={0}
      ignoreStroke={true}
      shouldOverdrawWholeArea={false}
    />
  );
}
