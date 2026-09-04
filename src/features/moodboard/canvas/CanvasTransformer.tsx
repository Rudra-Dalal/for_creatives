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
  keepRatio = true,
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
        if (newBox.width < 80 || newBox.height < 60) {
          return oldBox;
        }
        return newBox;
      }}
      keepRatio={keepRatio}
      rotateEnabled={false}
      borderStroke="#f59e0b"
      borderStrokeWidth={1.5}
      borderDash={[4, 4]}
      anchorFill="#181816"
      anchorStroke="#f59e0b"
      anchorStrokeWidth={1.5}
      anchorSize={8}
      anchorCornerRadius={2}
      padding={4}
    />
  );
}
