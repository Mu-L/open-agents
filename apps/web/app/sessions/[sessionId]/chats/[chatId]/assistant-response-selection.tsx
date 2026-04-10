"use client";

import { useRef, type ReactNode } from "react";
import { SelectionPopover } from "@/components/selection-popover";
import { cn } from "@/lib/utils";

type AssistantResponseSelectionProps = {
  children: ReactNode;
  className?: string;
  onAddToPrompt: (selectedText: string, comment: string) => void;
};

export function AssistantResponseSelection({
  children,
  className,
  onAddToPrompt,
}: AssistantResponseSelectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className={cn("group relative min-w-0", className)}>
      {children}
      <SelectionPopover
        containerRef={containerRef}
        onAddToPrompt={onAddToPrompt}
      />
    </div>
  );
}
