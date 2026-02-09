"use client";

import React, { useState, useCallback } from "react";
import Image from "next/image";
import { Loader2, GripVertical, Check, X, Plus, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface ScreenshotData {
  name: string;
  path: string;
  url: string;
  section: string;
  description: string;
  analysis?: {
    description: string;
    keyElements: string[];
    textContent: string;
    visualHierarchy: string;
    suggestedCaptions: string[];
  };
}

interface ScreenshotSelectorProps {
  screenshots: ScreenshotData[];
  logos?: { url: string; source: string; confidence: number }[];
  onSelectionChange: (selected: ScreenshotData[]) => void;
  onAddMore: () => void;
  isAnalyzing?: boolean;
}

export const ScreenshotSelector: React.FC<ScreenshotSelectorProps> = ({
  screenshots,
  logos = [],
  onSelectionChange,
  onAddMore,
  isAnalyzing = false,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(screenshots.map((s) => s.name))
  );
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [orderedScreenshots, setOrderedScreenshots] = useState(screenshots);

  const toggleSelection = useCallback((name: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      
      // Notify parent of changes
      const selected = orderedScreenshots.filter((s) => next.has(s.name));
      onSelectionChange(selected);
      
      return next;
    });
  }, [orderedScreenshots, onSelectionChange]);

  const handleDragStart = (name: string) => {
    setDraggedItem(name);
  };

  const handleDragOver = (e: React.DragEvent, targetName: string) => {
    e.preventDefault();
    if (draggedItem && draggedItem !== targetName) {
      const newOrder = [...orderedScreenshots];
      const draggedIndex = newOrder.findIndex((s) => s.name === draggedItem);
      const targetIndex = newOrder.findIndex((s) => s.name === targetName);
      
      if (draggedIndex !== -1 && targetIndex !== -1) {
        const [removed] = newOrder.splice(draggedIndex, 1);
        newOrder.splice(targetIndex, 0, removed);
        setOrderedScreenshots(newOrder);
        
        // Update selection with new order
        const selected = newOrder.filter((s) => selectedIds.has(s.name));
        onSelectionChange(selected);
      }
    }
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  return (
    <div className="space-y-6">
      {/* Extracted Logos */}
      {logos.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-yellow-400" />
            Extracted Logos ({logos.length})
          </h4>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {logos.map((logo, index) => (
              <div
                key={index}
                className="flex-shrink-0 w-16 h-16 bg-white rounded-lg p-2 flex items-center justify-center"
                title={`Source: ${logo.source} (${Math.round(logo.confidence * 100)}% confidence)`}
              >
                <Image
                  src={logo.url}
                  alt={`Logo ${index + 1}`}
                  width={48}
                  height={48}
                  className="object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Screenshot Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-white">
            Screenshots ({selectedIds.size}/{orderedScreenshots.length} selected)
          </h4>
          <Button
            variant="outline"
            size="sm"
            onClick={onAddMore}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Capture More
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {orderedScreenshots.map((screenshot) => {
            const isSelected = selectedIds.has(screenshot.name);
            const isDragged = draggedItem === screenshot.name;

            return (
              <div
                key={screenshot.name}
                draggable
                onDragStart={() => handleDragStart(screenshot.name)}
                onDragOver={(e) => handleDragOver(e, screenshot.name)}
                onDragEnd={handleDragEnd}
                className={`
                  relative bg-white/5 border rounded-lg overflow-hidden transition-all cursor-move
                  ${isSelected ? "border-white/30" : "border-white/10 opacity-60"}
                  ${isDragged ? "opacity-50 scale-95" : ""}
                `}
              >
                {/* Drag Handle */}
                <div className="absolute top-2 left-2 z-10 p-1 bg-black/50 rounded">
                  <GripVertical className="w-4 h-4 text-white/70" />
                </div>

                {/* Selection Toggle */}
                <button
                  onClick={() => toggleSelection(screenshot.name)}
                  className={`
                    absolute top-2 right-2 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-colors
                    ${isSelected ? "bg-green-500 text-white" : "bg-black/50 text-white/70 hover:bg-black/70"}
                  `}
                >
                  {isSelected ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
                </button>

                {/* Screenshot Image */}
                <div className="aspect-video relative">
                  <Image
                    src={screenshot.url}
                    alt={screenshot.description}
                    fill
                    className="object-cover"
                  />
                  
                  {/* Section Badge */}
                  <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 rounded text-xs text-white capitalize">
                    {screenshot.section}
                  </div>
                </div>

                {/* Analysis Info */}
                <div className="p-3 space-y-2">
                  <p className="text-sm text-white/90 line-clamp-2">
                    {screenshot.description}
                  </p>

                  {screenshot.analysis ? (
                    <div className="space-y-2 text-xs text-white/60">
                      <p className="line-clamp-2">{screenshot.analysis.description}</p>
                      
                      {screenshot.analysis.suggestedCaptions.length > 0 && (
                        <div className="pt-2 border-t border-white/10">
                          <p className="font-medium text-white/80 mb-1">Suggested captions:</p>
                          <ul className="space-y-1">
                            {screenshot.analysis.suggestedCaptions.slice(0, 2).map((caption, i) => (
                              <li key={i} className="line-clamp-1 italic">
                                &ldquo;{caption}&rdquo;
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : isAnalyzing ? (
                    <div className="flex items-center gap-2 text-xs text-white/50">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Analyzing...
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tips */}
      <div className="text-xs text-white/50 space-y-1">
        <p>💡 Drag screenshots to reorder them</p>
        <p>💡 Click the checkmark to select/deselect</p>
        <p>💡 AI analysis helps generate better video scripts</p>
      </div>
    </div>
  );
};

export default ScreenshotSelector;
